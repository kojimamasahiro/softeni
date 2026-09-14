// scripts/import-popular-pages.ts
//
// GA4 の「ページとスクリーン」CSV から、トップページの「よく見られている選手」「よく見られているチーム」の上位を
// data/popular-pages.json に書き出す。手順は docs/wiki/public-pages.md「トップページのよく見られているページ」。
//
// 使い方:
//   npm run popular:import -- ~/Downloads/ページとスクリーン.csv            # 書き出す
//   npm run popular:import -- ~/Downloads/ページとスクリーン.csv --dry-run  # 表示だけ
//
// リポジトリは公開なので、JSON には**順位（リンク先の並び）だけ**を残し表示回数は書かない。
// 表示回数はこのスクリプトの出力でだけ確認する。
// ページが無くなった（掲載閾値を下回った等）リンク先はここで落とし、ビルド時にも同じ判定をもう一度かける。

import fs from 'fs';
import path from 'path';

import { parseGa4PagesCsv, rankPopularPages, type RankedPage } from '../lib/popularPages';
import { POPULAR_PAGES_PATH, resolvePopularCard, type PopularPagesFile } from '../lib/popularPagesData';

/** JSON に残す件数。表示は3件だが、ビルドまでにページが消えたときの控えを持っておく */
const KEEP = 10;
/** これより前のデータには自分の next dev の閲覧が混ざっている（ADR-018 と同日に dev では GA4 を読み込まないようにした） */
const DEV_TRAFFIC_EXCLUDED_FROM = '2026-09-09';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const csvPath = args.find((a) => !a.startsWith('--'));
if (!csvPath) {
  console.error('使い方: npm run popular:import -- <GA4 の CSV> [--dry-run]');
  process.exit(1);
}

const root = process.cwd();

/** プロフィールページ（/players/{slug}/）を結果ページの ID に寄せる。同姓同名で ID が1つに決まらないものは寄せない */
function buildProfileSlugToId(): Map<string, string> {
  const index = JSON.parse(fs.readFileSync(path.join(root, 'data', 'players', 'index.json'), 'utf-8')) as { id: number; lastName: string; firstName: string }[];
  const idsByName = new Map<string, string[]>();
  for (const p of index) {
    const key = `${p.lastName}|${p.firstName}`;
    idsByName.set(key, [...(idsByName.get(key) ?? []), String(p.id)]);
  }
  const map = new Map<string, string>();
  const playersDir = path.join(root, 'data', 'players');
  for (const slug of fs.readdirSync(playersDir)) {
    const infoPath = path.join(playersDir, slug, 'information.json');
    if (!fs.existsSync(infoPath)) continue;
    const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8')) as { lastName?: string; firstName?: string };
    const ids = idsByName.get(`${info.lastName}|${info.firstName}`) ?? [];
    if (ids.length === 1) map.set(slug, ids[0]);
  }
  return map;
}

function pickResolvable(label: string, ranked: RankedPage[]): string[] {
  const kept: string[] = [];
  const dropped: RankedPage[] = [];
  console.log(`\n${label}（表示回数の多い順・上位${KEEP}件を保存）`);
  for (const r of ranked) {
    if (kept.length >= KEEP) break;
    const card = resolvePopularCard(r.href);
    if (!card) {
      dropped.push(r);
      continue;
    }
    kept.push(r.href);
    const mark = kept.length <= 3 ? '*' : ' ';
    console.log(`  ${mark}${String(kept.length).padStart(2)}. ${String(r.views).padStart(6)}回  ${card.title}（${card.subtitle}）  ${r.href}`);
  }
  if (dropped.length) {
    console.log(`  ページが無いため除外: ${dropped.map((d) => `${d.href}（${d.views}回）`).join(', ')}`);
  }
  if (kept.length < 3)
    console.log(`  ! 3件に満たない（${kept.length}件）。${label === '選手' ? '足りない分は固定の選手で埋める' : 'カードはこの件数だけ出る'}`);
  return kept;
}

const parsed = parseGa4PagesCsv(fs.readFileSync(csvPath, 'utf-8'));
const { players, teams } = rankPopularPages(parsed.rows, buildProfileSlugToId());

console.log(`読み込んだ行: ${parsed.rows.length} / 期間: ${parsed.startDate ?? '不明'} 〜 ${parsed.endDate ?? '不明'}`);
if (!parsed.startDate || !parsed.endDate) {
  console.log('! CSV に期間のコメント行（# 開始日 / # 終了日）が無い。トップページには期間を出さない');
} else {
  const days = Math.round((Date.parse(parsed.endDate) - Date.parse(parsed.startDate)) / 86_400_000) + 1;
  if (days !== 28) console.log(`! 期間が ${days} 日。運用は直近28日で揃えている`);
  if (parsed.startDate < DEV_TRAFFIC_EXCLUDED_FROM) console.log(`! ${DEV_TRAFFIC_EXCLUDED_FROM} より前を含む。その期間は開発中の自分の閲覧が混ざっている`);
}

const output: PopularPagesFile = {
  source: 'GA4 ページとスクリーン（表示回数）の CSV を npm run popular:import で取り込み',
  startDate: parsed.startDate,
  endDate: parsed.endDate,
  players: pickResolvable('選手', players),
  teams: pickResolvable('チーム', teams),
};

if (dryRun) {
  console.log('\n--dry-run のため書き出していない（* がトップページに出る3件）');
} else {
  fs.writeFileSync(path.join(root, POPULAR_PAGES_PATH), `${JSON.stringify(output, null, 2)}\n`);
  console.log(`\n${POPULAR_PAGES_PATH} を更新した（* がトップページに出る3件）。コミットすると次のビルドで入れ替わる`);
}
