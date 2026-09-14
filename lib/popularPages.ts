// lib/popularPages.ts
//
// トップページの「よく見られている選手」「よく見られているチーム」に出す上位ページを、GA4 の書き出し（CSV）から求める。
// 仕様・手順は docs/wiki/public-pages.md「トップページのよく見られているページ」。
//
// ここは純関数だけを置く（fs を触らない）。取り込みは scripts/import-popular-pages.ts、
// 表示名の解決は lib/popularPagesData.ts。テスト: npm run popular:test
//
// 設計の要点:
// - 同じ選手・チームに複数の URL がある場合は1件にまとめる（クエリ文字列の違い、チームの年度別ページ）。
//   カードのリンク先はまとめた先の代表 URL にする
// - 学校ページ（高校・中学・小学）は /teams/[id] と別の実体として数える。高校は男女でページが分かれているので別件
// - 選手のプロフィールページ（/players/{slug}/）は結果ページの ID に寄せる。寄せ先の対応は呼び出し側が渡す

import { normalizePath } from './analytics';

export type PopularKind = 'player' | 'team' | 'hs_school' | 'jhs_team' | 'es_team';

export interface PopularTarget {
  kind: PopularKind;
  /** カードのリンク先（末尾スラッシュ付き） */
  href: string;
}

export interface Ga4PageRow {
  path: string;
  views: number;
}

export interface Ga4PagesExport {
  rows: Ga4PageRow[];
  /** YYYY-MM-DD。CSV 冒頭のコメント行から読む。無ければ null */
  startDate: string | null;
  endDate: string | null;
}

/**
 * そのページを見た回数に数えない URL の変種。
 * - `?q=`: 検索窓の入力。1文字ごとに1行になる（「き」「きっ」「きっさか」…）。2026-09-14 の実物の CSV では
 *   `/players/4898/results/` の141回のうち46回がこれで、中身は別の選手名だった。選手・チームのページは `q` を使わない。
 *   なぜ結果ページの URL に付くのかは未特定（ローカルで「検索 → 結果ページ → 戻る」をたどっても再現しない）
 * - `#google_vignette`: AdSense のビニエット広告が URL に付けるハッシュ。同じページの閲覧がもう1回数えられる
 * utm_* など、それ以外のクエリ文字列は外部からの着地なので数える。
 */
function isNoiseVariant(pathOrHref: string): boolean {
  const [beforeHash, hash = ''] = pathOrHref.split('#');
  if (hash === 'google_vignette') return true;
  return new URLSearchParams(beforeHash.split('?')[1] ?? '').has('q');
}

/** 数えるパス。判定順に並べる（具体的なものが先）。 */
export function classifyPopularPath(pathOrHref: string, profileSlugToId?: ReadonlyMap<string, string>): PopularTarget | null {
  if (isNoiseVariant(pathOrHref.trim())) return null;
  const p = normalizePath(pathOrHref.trim());
  let m: RegExpMatchArray | null;

  if ((m = p.match(/^\/players\/(\d+)\/results\/$/))) return { kind: 'player', href: `/players/${m[1]}/results/` };
  if ((m = p.match(/^\/players\/([^/]+)\/$/))) {
    const id = profileSlugToId?.get(decodeURIComponent(m[1]));
    return id ? { kind: 'player', href: `/players/${id}/results/` } : null;
  }
  // チームの年度別ページ（/teams/{id}/{year}/{gender}/）はチームページに寄せる
  if ((m = p.match(/^\/teams\/([^/]+)\/(?:\d{4}\/[^/]+\/)?$/))) return { kind: 'team', href: `/teams/${m[1]}/` };
  if ((m = p.match(/^\/highschool\/(boys|girls)\/([^/]+)\/([^/]+)\/$/))) return { kind: 'hs_school', href: m[0] };
  // /secondaryschool/pathways/{gender}/ は同じ形なので除く
  if ((m = p.match(/^\/secondaryschool\/([^/]+)\/([^/]+)\/$/)) && m[1] !== 'pathways') return { kind: 'jhs_team', href: m[0] };
  if ((m = p.match(/^\/primaryschool\/([^/]+)\/([^/]+)\/$/)) && m[1] !== 'pathways') return { kind: 'es_team', href: m[0] };
  return null;
}

/** 1行を CSV のセルに分ける（ダブルクォート・"" のエスケープに対応。セル内改行は GA4 の書き出しに出ないので扱わない）。 */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  cells.push(cur);
  return cells.map((s) => s.trim());
}

// 列名は GA4 の表示言語で変わる。「ページパス + クエリ文字列」「ページパスとスクリーン クラス」のどちらでもよい
const PATH_HEADER = /ページ\s*パス|page\s*path/i;
// 「ユーザーあたりのビュー」「Views per user」を拾わないよう完全一致にする
const VIEWS_HEADER = /^(表示回数|views|screenPageViews)$/i;

function toIsoDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

/**
 * GA4「レポート > エンゲージメント > ページとスクリーン」の CSV 書き出しを読む。
 * 1ファイルに複数の表が入ることがあるので、パス列と表示回数列を両方持つ表だけを読む。
 */
export function parseGa4PagesCsv(text: string): Ga4PagesExport {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const rows: Ga4PageRow[] = [];
  let startDate: string | null = null;
  let endDate: string | null = null;
  let pathIdx = -1;
  let viewsIdx = -1;
  let sawHeader = false;

  for (const line of lines) {
    if (line.startsWith('#')) {
      const s = line.match(/(?:開始日|Start date)\s*[:：]\s*(\d{8})/i);
      if (s) startDate = toIsoDate(s[1]);
      const e = line.match(/(?:終了日|End date)\s*[:：]\s*(\d{8})/i);
      if (e) endDate = toIsoDate(e[1]);
      // 探索（自由形式）の書き出しは「# 20260817-20260913」の1行で期間を持つ
      const range = line.match(/^#\s*(\d{8})\s*-\s*(\d{8})\s*$/);
      if (range) {
        startDate = toIsoDate(range[1]);
        endDate = toIsoDate(range[2]);
      }
      continue;
    }
    if (!line.trim()) {
      pathIdx = viewsIdx = -1; // 表の区切り
      continue;
    }
    const cells = splitCsvLine(line);
    const p = cells.findIndex((c) => PATH_HEADER.test(c));
    const v = cells.findIndex((c) => VIEWS_HEADER.test(c));
    if (p >= 0 && v >= 0) {
      pathIdx = p;
      viewsIdx = v;
      sawHeader = true;
      continue;
    }
    if (pathIdx < 0) continue;
    const path = cells[pathIdx] ?? '';
    const views = Number((cells[viewsIdx] ?? '').replace(/[,\s]/g, ''));
    if (!path.startsWith('/') || !Number.isFinite(views)) continue; // 合計行など
    rows.push({ path, views });
  }

  if (!sawHeader) {
    throw new Error(
      'パス列（「ページパス + クエリ文字列」等）と「表示回数」列を持つ表が見つからない。GA4 の「ページとスクリーン」レポートを CSV で書き出したか確認すること。',
    );
  }
  return { rows, startDate, endDate };
}

export interface RankedPage extends PopularTarget {
  views: number;
}

/** 行を選手・チームに振り分け、同じリンク先をまとめて表示回数の多い順に並べる。 */
export function rankPopularPages(rows: Ga4PageRow[], profileSlugToId?: ReadonlyMap<string, string>): { players: RankedPage[]; teams: RankedPage[] } {
  const byHref = new Map<string, RankedPage>();
  for (const row of rows) {
    const target = classifyPopularPath(row.path, profileSlugToId);
    if (!target) continue;
    const cur = byHref.get(target.href);
    if (cur) cur.views += row.views;
    else byHref.set(target.href, { ...target, views: row.views });
  }
  const sorted = [...byHref.values()].sort((a, b) => b.views - a.views || a.href.localeCompare(b.href));
  return {
    players: sorted.filter((r) => r.kind === 'player'),
    teams: sorted.filter((r) => r.kind !== 'player'),
  };
}
