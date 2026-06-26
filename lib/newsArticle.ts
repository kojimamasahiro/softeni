// lib/newsArticle.ts
// /news 記事（プレビュー / 結果速報）の記録スキーマと、記事ビューの組み立て。
// 記事は「一次成果物＝文脈ブロック」の再利用先の一つ（ADR-005）。本文は LLM を使わず
// 既存の文脈ブロック（historical-winners / milestone / career-record）から決定的に構成する。
//
// 設計: docs/wiki/news-context-blocks.md / docs/raw/2026-06-21-news-auto-draft-design.md / ADR-005。
// fs を使うため getStaticProps / ビルドスクリプトからのみ import すること。
//
// 公開フロー（human-in-the-loop）: 記事レコードは data/news/<articleId>.json。
//   state: 'draft' → 'review' → 'published'。公開（getStaticPaths 対象）は published のみ。
//   プレビュー→結果の昇格は同一 articleId で type を 'preview'→'result' に変えて行う。

import fs from 'fs';
import path from 'path';

import { getChampionMilestones, type MilestoneEvent } from './milestones';
import {
  buildParticipantMap,
  getHistoricalWinners,
  parseCategoryFile,
  readYearDetail,
  resolveEntryToChampion,
  type ChampionEntry,
  type RawDetail,
} from './tournamentRecords';

export type NewsArticleType = 'preview' | 'result';
export type NewsArticleState = 'draft' | 'review' | 'published';

export type NewsArticleRecord = {
  articleId: string;
  type: NewsArticleType;
  state: NewsArticleState;
  tournamentId: string;
  year: number;
  /** 省略 / null は全種目対象 */
  categoryId?: string | null;
  /** テンプレ生成のため通常は空。明示指定があれば優先 */
  title?: string;
  description?: string;
  /**
   * OGP 画像のパス（"/og/news/<id>-<hash>.png"）。
   * tools/sns-images/news_og.py がローカル生成して書き戻す（result の published のみ）。
   * 設計: docs/raw/2026-06-22-news-ogp-image-design.md
   */
  ogImage?: string;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * プレビューに出す選手参照。
 * playerId は `/players/{id}/results`（結果ページ）の数値 ID。
 * curated プロフィール（`/players/{slug}`）とは別系統で、count>=5 の全選手が対象。
 * 結果ページを持たない選手は null（リンク無し・名前のみ）。
 */
export type PreviewPlayerRef = {
  name: string;
  playerId: number | null;
  /** 今大会も出場するか */
  returning: boolean;
};

/** プレビュー: 前回王者の今大会への出場状況（連覇・防衛ウォッチ） */
export type TitleDefenseWatch = {
  /** 前回王者の表示（ペア/校）。団体戦や選手が空のとき用 */
  defendingChampionDisplay: string;
  /** 前回優勝年 */
  defendingYear: number;
  /** 所属校（表示用・正規化済み）。団体戦は校名 */
  team: string | null;
  /** 前回王者の選手（個人戦/ダブルス。団体は空）。returning で継続可否を持つ */
  players: PreviewPlayerRef[];
  /**
   * intact: ペア/校がそのまま出場（連覇に挑む）
   * partial: ダブルスで片方の選手のみ継続出場（新ペアで連覇に挑む）
   * absent: 前回王者は不在（新王者へ）
   */
  status: 'intact' | 'partial' | 'absent';
};

/** プレビュー: 前回入賞者（準優勝/ベスト4）で今大会も出場 */
export type ReturningPlacer = {
  placement: '準優勝' | 'ベスト4';
  /** 前回の表示（ペア/校）。団体戦用 */
  display: string;
  /** 所属校（表示用・正規化済み） */
  team: string | null;
  /** 入賞時の選手（個人戦/ダブルス。団体は空） */
  players: PreviewPlayerRef[];
  /** ペア/校の全員が継続出場か */
  intact: boolean;
};

/** プレビュー: 過去の優勝者（前々回以前）で今大会も出場 */
export type ReturningFormerChampion = {
  /** 優勝した年（新しい順） */
  years: number[];
  /** 当時の優勝表示 */
  display: string;
  /** 所属校（表示用・正規化済み） */
  team: string | null;
  /** 当時の優勝選手（個人戦/ダブルス。団体は空） */
  players: PreviewPlayerRef[];
};

/** プレビュー: 出場規模・勢力図（純粋な事実） */
export type FieldOverview = {
  /** 出場ペア/選手/校の数（エントリー数） */
  entryCount: number;
  /** 都道府県別エントリー数（多い順・上位） */
  topPrefectures: Array<{ prefecture: string; count: number }>;
  /** 複数エントリーを送り込む所属校（2 以上・多い順） */
  multiEntryTeams: Array<{ team: string; count: number }>;
};

export type NewsCategoryBlock = {
  categoryId: string;
  categoryLabel: string;
  /** 前回王者（year-1 の優勝者）。無ければ null */
  previousChampion: string | null;
  /** 歴代優勝者（新しい年が先頭） */
  historicalWinners: Array<{ year: number; display: string | null }>;
  /** 結果速報のみ: その年の優勝者表示 */
  champion: string | null;
  /** 結果速報のみ: milestone（連覇/初優勝など） */
  milestones: Array<{
    kind: string;
    label: string;
    confidence: MilestoneEvent['confidence'];
    scopeNote?: string | null;
  }>;
  /** プレビューのみ: 連覇・防衛ウォッチ（前回王者の出場状況）。算出不能なら null */
  titleDefense: TitleDefenseWatch | null;
  /** プレビューのみ: 前回入賞者（準優勝/ベスト4）で今大会も出場する者 */
  returningPlacers: ReturningPlacer[];
  /** プレビューのみ: 前々回以前の優勝者で今大会も出場する者 */
  returningFormerChampions: ReturningFormerChampion[];
  /** プレビューのみ: 出場規模・勢力図。算出不能なら null */
  fieldOverview: FieldOverview | null;
  /** その年・種目の結果ページ（年度別）への内部リンク。算出不能なら null */
  resultHref: string | null;
};

export type NewsArticleView = {
  record: NewsArticleRecord;
  tournamentLabel: string;
  /** 大会の generationId（内部リンク URL 構築用） */
  generation: string;
  /** 大会ハブ（歴代まとめ）への内部リンク */
  hubHref: string;
  title: string;
  description: string;
  categories: NewsCategoryBlock[];
};

const NEWS_ROOT = ['data', 'news'];
const DETAILS_ROOT = ['data', 'tournaments', 'details'];

function resolveRoot(): string {
  return process.cwd();
}

function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function tournamentMetaOf(tournamentId: string): {
  label: string;
  generationId: string;
} {
  const idx = readJson<
    Array<{ tournamentId: string; label?: string; generationId?: string }>
  >(path.join(resolveRoot(), 'data', 'tournaments', 'index.json'));
  const hit = idx?.find((t) => t.tournamentId === tournamentId);
  return {
    label: hit?.label ?? tournamentId,
    generationId: hit?.generationId ?? '',
  };
}

/** categoryId（`category-age-gender`）を URL 構成パーツに分解する */
function categoryPathParts(
  categoryId: string,
): { category: string; age: string; gender: string } | null {
  const parts = categoryId.split('-');
  if (parts.length < 3) return null;
  const gender = parts.pop() as string;
  const age = parts.pop() as string;
  const category = parts.join('-');
  return { category, age, gender };
}

/** 記事レコードを読む */
export function getArticleRecord(articleId: string): NewsArticleRecord | null {
  return readJson<NewsArticleRecord>(
    path.join(resolveRoot(), ...NEWS_ROOT, `${articleId}.json`),
  );
}

/** 全記事レコード（state 問わず） */
export function listArticleRecords(): NewsArticleRecord[] {
  const dir = path.join(resolveRoot(), ...NEWS_ROOT);
  if (!fs.existsSync(dir)) return [];
  const out: NewsArticleRecord[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const rec = readJson<NewsArticleRecord>(path.join(dir, f));
    if (rec?.articleId) out.push(rec);
  }
  return out;
}

/** 公開（published）記事のみ。getStaticPaths / 一覧で使う */
export function listPublishedArticles(): NewsArticleRecord[] {
  return listArticleRecords()
    .filter((r) => r.state === 'published')
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
}

/** 対象 tournamentId/year に存在する categoryId 一覧（details 実体から） */
function listCategoryIds(tournamentId: string, year: number): string[] {
  const dir = path.join(
    resolveRoot(),
    ...DETAILS_ROOT,
    tournamentId,
    String(year),
  );
  if (!fs.existsSync(dir)) return [];
  const ids: string[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const parsed = parseCategoryFile(f);
    if (parsed) ids.push(parsed.categoryId);
  }
  return ids;
}

/**
 * 今大会（対象年・種目）の出場者インデックス。前年データとの照合に使う。
 * すべて当サイト掲載のエントリーデータから決定的に算出する（LLM/curation 非依存）。
 */
type FieldIndex = {
  entryCount: number;
  /** 出場選手の playerKey（名前@所属）集合。個人の継続出場判定に使う */
  playerKeySet: Set<string>;
  /** 各エントリーの championKey 集合。ペア/校単位の一致判定に使う */
  championKeySet: Set<string>;
  /** 都道府県別エントリー数 */
  prefectureCount: Map<string, number>;
  /** 所属校別エントリー数 */
  teamCount: Map<string, number>;
};

// 年度間で所属校の表記が揺れる（2025「嬉野」 vs 2026「嬉野_佐賀県」など、
// 末尾に "_<都道府県>" が付くデータが混在）。照合キー・表示の両方でこれを吸収する。
function normPart(s: string): string {
  return s.replace(/\s+/g, '').normalize('NFKC');
}

/** 所属校名の末尾 "_<都道府県>" を除去（"_" 区切りは通常の校名に出ないため安全） */
function normalizeTeam(team: string): string {
  return team.replace(/_[^_]+?[都道府県]$/u, '');
}

/** 表示文字列中の "_<都道府県>" を除去（例: 高田商_奈良県 → 高田商） */
function cleanDisplay(s: string): string {
  return s.replace(/_[^_・（）()]+?[都道府県]/gu, '');
}

/** 選手の照合キー（名前@正規化所属）。所属不明なら名前のみ */
function playerMatchKey(name: string, team: string | undefined | null): string {
  const t = team ? normPart(normalizeTeam(team)) : '';
  return t ? `${normPart(name)}@${t}` : normPart(name);
}

/**
 * 姓名 → 結果ページの数値 ID（`/players/{id}/results`）。
 * `data/players/index.json` を唯一の正とし、結果ページが実在する選手（count>=5、
 * `players/[id]/results.tsx` の getStaticPaths と同条件）のみを姓名一致で解決する。
 * 同姓同名は最初の ID を使う（学校ページ・高校歴代ページと同じ既存規約）。
 * 注意: これは curated プロフィール `/players/{slug}` とは別系統（区別は public-pages.md 参照）。
 */
let cachedPlayerIdMap: Map<string, number> | null = null;
function getPlayerIdMap(): Map<string, number> {
  if (cachedPlayerIdMap) return cachedPlayerIdMap;
  const m = new Map<string, number>();
  const idx = readJson<
    Array<{ id: number; lastName: string; firstName: string; count: number }>
  >(path.join(resolveRoot(), 'data', 'players', 'index.json'));
  if (idx) {
    for (const p of idx) {
      if (p.count < 5) continue;
      const key = normPart(`${p.lastName}${p.firstName}`);
      if (!m.has(key)) m.set(key, p.id); // 同姓同名は最初の ID
    }
  }
  cachedPlayerIdMap = m;
  return m;
}

/** フルネーム（姓名連結）から結果ページ ID を解決。無ければ null */
function resolvePlayerId(fullName: string): number | null {
  return getPlayerIdMap().get(normPart(fullName)) ?? null;
}

/** ペア/校の照合キー（正規化所属で構築。championKey と同じ思想） */
function teamMatchKey(c: ChampionEntry): string | null {
  if (!c.display) return null;
  const teams = c.teams.map((t) => normPart(normalizeTeam(t))).sort();
  const names = c.players.map((n) => normPart(n)).sort();
  const base =
    names.length > 0
      ? `${names.join('|')}@${teams.join('|')}`
      : teams.join('|');
  return base || null;
}

/** 対象年・種目のエントリーから出場者インデックスを構築する */
function buildFieldIndex(
  tournamentId: string,
  year: number,
  categoryId: string,
): FieldIndex | null {
  const detail = readYearDetail(tournamentId, year, categoryId);
  if (!detail || !detail.entries || detail.entries.length === 0) return null;
  const pmap = buildParticipantMap(detail);

  const playerKeySet = new Set<string>();
  const championKeySet = new Set<string>();
  const prefectureCount = new Map<string, number>();
  const teamCount = new Map<string, number>();
  let entryCount = 0;

  for (const e of detail.entries) {
    entryCount += 1;
    const names: string[] = [];
    const teams: string[] = [];
    let firstPref: string | null = null;
    for (const pid of e.playerIds) {
      const p = pmap.get(pid);
      const name = p ? `${p.lastName ?? ''}${p.firstName ?? ''}`.trim() : pid;
      const team = p?.team ?? '';
      if (name) {
        names.push(name);
        playerKeySet.add(playerMatchKey(name, team));
      }
      if (team) {
        const nt = normalizeTeam(team);
        if (!teams.includes(nt)) teams.push(nt);
      }
      if (!firstPref && p?.prefecture) firstPref = p.prefecture;
    }
    const namesSorted = names.map(normPart).sort();
    const teamsSorted = teams.map(normPart).sort();
    const ck =
      names.length > 0
        ? `${namesSorted.join('|')}@${teamsSorted.join('|')}`
        : teamsSorted.join('|');
    if (ck) championKeySet.add(ck);
    if (firstPref) {
      prefectureCount.set(firstPref, (prefectureCount.get(firstPref) ?? 0) + 1);
    }
    const team0 = teams[0];
    if (team0) teamCount.set(team0, (teamCount.get(team0) ?? 0) + 1);
  }

  return {
    entryCount,
    playerKeySet,
    championKeySet,
    prefectureCount,
    teamCount,
  };
}

/** ChampionEntry が今大会に「継続出場」しているかを判定する（所属表記揺れを吸収） */
function returningOf(
  c: ChampionEntry,
  field: FieldIndex,
): { status: 'intact' | 'partial' | 'absent'; players: PreviewPlayerRef[] } {
  const isTeam = c.players.length === 0;
  if (isTeam) {
    const ck = teamMatchKey(c);
    const present = ck ? field.championKeySet.has(ck) : false;
    return { status: present ? 'intact' : 'absent', players: [] };
  }
  // 個人は「名前@正規化所属」が一致すれば継続出場とみなす（同姓同名は所属で区別）。
  const players: PreviewPlayerRef[] = c.players.map((name) => ({
    name,
    playerId: resolvePlayerId(name),
    returning: c.teams.some((t) =>
      field.playerKeySet.has(playerMatchKey(name, t)),
    ),
  }));
  const returningCount = players.filter((p) => p.returning).length;
  let status: 'intact' | 'partial' | 'absent' = 'absent';
  if (returningCount === players.length) status = 'intact';
  else if (returningCount > 0) status = 'partial';
  return { status, players };
}

/** ChampionEntry の表示用所属校（正規化＋サフィックス除去）。無ければ null */
function teamDisplayOf(c: ChampionEntry): string | null {
  return c.teams[0] ? cleanDisplay(c.teams[0]) : null;
}

/** 前年 results の rank を入賞ラベルへ。優勝は別ブロック（連覇ウォッチ）が扱うため除く */
function placerLabel(
  rank: { kind?: string; bestLevel?: number } | undefined | null,
): '準優勝' | 'ベスト4' | null {
  if (!rank) return null;
  if (rank.kind === 'runnerup') return '準優勝';
  if (rank.kind === 'best' && rank.bestLevel === 4) return 'ベスト4';
  return null;
}

/** プレビュー: 連覇・防衛ウォッチ（前回王者の今大会出場状況） */
function buildTitleDefense(
  prevChampionEntry: ChampionEntry | null,
  field: FieldIndex | null,
): TitleDefenseWatch | null {
  if (!prevChampionEntry || !prevChampionEntry.display || !field) return null;
  const { status, players } = returningOf(prevChampionEntry, field);
  return {
    defendingChampionDisplay: cleanDisplay(prevChampionEntry.display),
    defendingYear: prevChampionEntry.year,
    team: teamDisplayOf(prevChampionEntry),
    players,
    status,
  };
}

/** プレビュー: 前回入賞者（準優勝/ベスト4）で今大会も出場する者 */
function buildReturningPlacers(
  detail: RawDetail | null,
  field: FieldIndex | null,
  prevYear: number,
): ReturningPlacer[] {
  if (!detail || !detail.entries || !detail.results || !field) return [];
  const pmap = buildParticipantMap(detail);
  const entryByNo = new Map(detail.entries.map((e) => [e.entryNo, e] as const));
  const out: ReturningPlacer[] = [];
  const order: Record<ReturningPlacer['placement'], number> = {
    準優勝: 0,
    ベスト4: 1,
  };
  for (const r of detail.results) {
    const label = placerLabel(r.tournament?.rank);
    if (!label) continue;
    const entry = entryByNo.get(r.entryNo);
    if (!entry) continue;
    const ce = resolveEntryToChampion(entry, pmap, prevYear);
    if (!ce.display) continue;
    const { status, players } = returningOf(ce, field);
    if (status === 'absent') continue;
    out.push({
      placement: label,
      display: cleanDisplay(ce.display),
      team: teamDisplayOf(ce),
      players,
      intact: status === 'intact',
    });
  }
  out.sort((a, b) => order[a.placement] - order[b.placement]);
  return out;
}

/** プレビュー: 前々回以前の優勝者で今大会も出場する者（前回王者は連覇ウォッチで扱うため除く） */
function buildReturningFormerChampions(
  champions: ChampionEntry[],
  field: FieldIndex | null,
  year: number,
): ReturningFormerChampion[] {
  if (!field) return [];
  // championKey でまとめ、複数年優勝を集約する（players/team は最新年のものを採用）
  const byKey = new Map<
    string,
    {
      years: number[];
      display: string;
      team: string | null;
      players: PreviewPlayerRef[];
    }
  >();
  for (const c of champions) {
    if (c.year >= year - 1) continue; // 前回王者・当年は除外
    if (!c.display) continue;
    const { status, players } = returningOf(c, field);
    if (status === 'absent') continue;
    const key = teamMatchKey(c) ?? c.display;
    const cur = byKey.get(key);
    if (cur) {
      cur.years.push(c.year);
    } else {
      byKey.set(key, {
        years: [c.year],
        display: cleanDisplay(c.display),
        team: teamDisplayOf(c),
        players,
      });
    }
  }
  return Array.from(byKey.values())
    .map((v) => ({
      years: v.years.sort((a, b) => b - a),
      display: v.display,
      team: v.team,
      players: v.players,
    }))
    .sort((a, b) => b.years[0] - a.years[0]);
}

/** プレビュー: 出場規模・勢力図 */
function buildFieldOverview(field: FieldIndex | null): FieldOverview | null {
  if (!field || field.entryCount === 0) return null;
  const topPrefectures = Array.from(field.prefectureCount.entries())
    .map(([prefecture, count]) => ({ prefecture, count }))
    .sort(
      (a, b) => b.count - a.count || a.prefecture.localeCompare(b.prefecture),
    )
    .slice(0, 5);
  const multiEntryTeams = Array.from(field.teamCount.entries())
    .filter(([, count]) => count >= 2)
    .map(([team, count]) => ({ team, count }))
    .sort((a, b) => b.count - a.count || a.team.localeCompare(b.team));
  return { entryCount: field.entryCount, topPrefectures, multiEntryTeams };
}

function buildCategoryBlock(
  record: NewsArticleRecord,
  categoryId: string,
  generation: string,
): NewsCategoryBlock | null {
  const { tournamentId, year, type } = record;
  const hw = getHistoricalWinners(tournamentId, categoryId, {
    targetYear: year,
  });
  if (!hw) return null;

  const previousChampion =
    hw.champions.find((c) => c.year === year - 1)?.display ?? null;
  const champion = hw.champions.find((c) => c.year === year)?.display ?? null;

  let milestones: NewsCategoryBlock['milestones'] = [];
  let titleDefense: TitleDefenseWatch | null = null;
  let returningPlacers: ReturningPlacer[] = [];
  let returningFormerChampions: ReturningFormerChampion[] = [];
  let fieldOverview: FieldOverview | null = null;

  if (type === 'result') {
    const ms = getChampionMilestones(tournamentId, categoryId, year);
    milestones = (ms?.events ?? []).map((e) => ({
      kind: e.kind,
      label: e.label,
      confidence: e.confidence,
      scopeNote: e.scopeNote ?? null,
    }));
  } else {
    // プレビュー: 当サイト掲載のエントリー＋前年データを照合し、決定的に展望を構成する。
    const field = buildFieldIndex(tournamentId, year, categoryId);
    const prevChampionEntry =
      hw.champions.find((c) => c.year === year - 1) ?? null;
    const prevDetail = readYearDetail(tournamentId, year - 1, categoryId);
    titleDefense = buildTitleDefense(prevChampionEntry, field);
    returningPlacers = buildReturningPlacers(prevDetail, field, year - 1);
    returningFormerChampions = buildReturningFormerChampions(
      hw.champions,
      field,
      year,
    );
    fieldOverview = buildFieldOverview(field);
  }

  // その年・種目の結果ページは details ファイルが存在する場合のみ生成される
  // （結果ページの getStaticPaths が details ディレクトリを走査するため）。
  // プレビューでは公開時点で結果が未掲載のことがあるので、実在する場合のみリンクを張る。
  const parts = generation ? categoryPathParts(categoryId) : null;
  const hasResultDetail = Boolean(readYearDetail(tournamentId, year, categoryId));
  const resultHref =
    parts && hasResultDetail
      ? `/tournaments/${generation}/${tournamentId}/${year}/${parts.category}/${parts.age}/${parts.gender}/`
      : null;

  return {
    categoryId,
    categoryLabel: hw.categoryLabel,
    previousChampion,
    historicalWinners: hw.champions.map((c) => ({
      year: c.year,
      display: c.display,
    })),
    champion: type === 'result' ? champion : null,
    milestones,
    titleDefense,
    returningPlacers,
    returningFormerChampions,
    fieldOverview,
    resultHref,
  };
}

function defaultTitle(
  record: NewsArticleRecord,
  tournamentLabel: string,
): string {
  return record.type === 'preview'
    ? `${tournamentLabel} ${record.year} 展望・連覇/前回王者・出場校`
    : `${tournamentLabel} ${record.year} 結果・優勝・歴代まとめ`;
}

function defaultDescription(
  record: NewsArticleRecord,
  tournamentLabel: string,
): string {
  return record.type === 'preview'
    ? `ソフトテニス「${tournamentLabel}」${record.year}年の展望。前回王者の連覇挑戦・前回入賞者の再登場・出場規模・歴代優勝者を当サイト掲載データからまとめています。`
    : `ソフトテニス「${tournamentLabel}」${record.year}年の結果。優勝者・連覇/初優勝などの記録を歴代データと合わせてまとめています。`;
}

/** 記事レコードから描画用ビューを組み立てる */
export function buildNewsArticleView(
  record: NewsArticleRecord,
): NewsArticleView {
  const { label: tournamentLabel, generationId } = tournamentMetaOf(
    record.tournamentId,
  );
  const categoryIds =
    record.categoryId && record.categoryId.length > 0
      ? [record.categoryId]
      : listCategoryIds(record.tournamentId, record.year);

  const categories: NewsCategoryBlock[] = [];
  for (const cid of categoryIds) {
    const block = buildCategoryBlock(record, cid, generationId);
    if (block) categories.push(block);
  }

  const hubHref = generationId
    ? `/tournaments/${generationId}/${record.tournamentId}/`
    : '';

  return {
    record,
    tournamentLabel,
    generation: generationId,
    hubHref,
    title: record.title || defaultTitle(record, tournamentLabel),
    description:
      record.description || defaultDescription(record, tournamentLabel),
    categories,
  };
}
