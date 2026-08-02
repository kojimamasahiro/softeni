// scripts/check-orphan-entries.mjs
// 「エントリーには居るのに、どの試合にも現れない」組を洗い出す。
//
// 背景: tools/tournament3 の出力バグで、不戦勝どうしの2回戦70試合が JSON に出ず、
// 敗者70組がエントリーごと消えていた（docs/raw/2026-08-01-bug-bye-derived-matches-not-exported.md）。
// この状態に気づかないまま集計すると、消えた組が分母から落ちて
// 「◯◯は勝ち残りが無くなった」のような誤った断定に繋がる。
//
// 大会インサイトを作る前の健全性チェックとして最初に回すこと。
//
// 使い方:
//   node scripts/check-orphan-entries.mjs                       # 結果が入っている全大会を走査
//   node scripts/check-orphan-entries.mjs -t highschool-championship -y 2026
//
// 終了コード: 1件でも見つかれば 1（結果未入力の大会は対象外なので誤検出しない）

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DETAILS_DIR = path.join(process.cwd(), 'data', 'tournaments', 'details');

const args = {};
for (let i = 2; i < process.argv.length; i += 1) {
  const a = process.argv[i];
  if (a === '-t' || a === '--tournament') args.tournament = process.argv[++i];
  else if (a === '-y' || a === '--year') args.year = process.argv[++i];
}

function* eachCategoryFile() {
  if (!fs.existsSync(DETAILS_DIR)) return;
  for (const tid of fs.readdirSync(DETAILS_DIR)) {
    if (args.tournament && tid !== args.tournament) continue;
    const tDir = path.join(DETAILS_DIR, tid);
    if (!fs.statSync(tDir).isDirectory()) continue;
    for (const year of fs.readdirSync(tDir)) {
      if (args.year && year !== String(args.year)) continue;
      const yDir = path.join(tDir, year);
      if (!fs.statSync(yDir).isDirectory()) continue;
      for (const f of fs.readdirSync(yDir)) {
        if (f.endsWith('.json')) yield { tid, year, categoryId: f.slice(0, -5), file: path.join(yDir, f) };
      }
    }
  }
}

const findings = [];
let scanned = 0;

for (const { tid, year, categoryId, file } of eachCategoryFile()) {
  let detail;
  try {
    detail = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    findings.push({ tid, year, categoryId, error: `JSONとして読めない（${e.message}）` });
    continue;
  }
  const matches = detail.matches ?? [];
  const entries = detail.entries ?? [];
  if (entries.length === 0) continue;

  // 結果が1件も入っていない大会（開幕前・ドローのみ）は対象外。
  // seed/extra は1回戦が不戦勝で最初から試合に現れないため、必ず誤検出になる。
  if (!matches.some((m) => m.winnerEntryNo != null)) continue;
  scanned += 1;

  const inMatch = new Set();
  for (const m of matches) for (const e of m.entries ?? []) if (e != null) inMatch.add(e);

  const orphans = entries.filter((e) => !inMatch.has(e.entryNo));
  if (orphans.length === 0) continue;

  const byId = new Map((detail.participants ?? []).map((p) => [p.id, p]));
  const label = (e) =>
    (e.playerIds ?? [])
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((p) => `${p.lastName ?? ''}${p.firstName ?? ''}`)
      .join('・');
  const types = orphans.reduce((acc, e) => ({ ...acc, [e.type ?? '(type未設定)']: (acc[e.type ?? '(type未設定)'] ?? 0) + 1 }), {});

  findings.push({
    tid,
    year,
    categoryId,
    total: entries.length,
    orphans: orphans.length,
    types,
    sample: orphans.slice(0, 5).map((e) => `No.${e.entryNo} ${label(e)}`),
  });
}

console.log(`結果が入っている ${scanned} 種目を検査しました。\n`);

if (findings.length === 0) {
  console.log('どの試合にも現れないエントリーはありません。');
  process.exit(0);
}

for (const f of findings) {
  if (f.error) {
    console.log(`[ERROR] ${f.tid}/${f.year}/${f.categoryId}: ${f.error}`);
    continue;
  }
  console.log(`[要確認] ${f.tid}/${f.year}/${f.categoryId}`);
  console.log(`  全${f.total}組のうち ${f.orphans}組がどの試合にも現れない  ${JSON.stringify(f.types)}`);
  for (const s of f.sample) console.log(`    ${s}`);
  if (f.orphans > f.sample.length) console.log(`    ...ほか ${f.orphans - f.sample.length}組`);
  console.log('');
}

console.log('この状態のまま集計すると、消えた組が分母から落ちて誤った断定に繋がります。');
console.log('type が seed/extra に偏っている場合は入力ツールの出力バグを疑い、再エクスポートしてください。');
console.log('詳細: docs/raw/2026-08-01-bug-bye-derived-matches-not-exported.md');
process.exit(1);
