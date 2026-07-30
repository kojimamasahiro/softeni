// buildBracketTree が組んだツリーが、実データの matches と矛盾しないか全大会で検証する。
// 実行: npm run bracket:verify:tree
//
// verify-bracket-layout.mjs が「2 組が何回戦で当たるか」を検証するのに対し、
// こちらは**描画に使うツリーそのもの**を検証する。見るのは 2 点:
//
//   1. 網羅性 — knockout の全試合が、ツリーのどこかの枠に同じ対戦カードとして現れるか。
//      現れない試合があれば、その試合は表に描かれない＝表示から消える。
//   2. 整合性 — ツリーの枠に入った対戦カードが、実データと同じ**ラウンド番号**にあるか。
//
// 比較を「ラウンド名」ではなく「ラウンド番号」で行うのは、名前の付け方が大会によって
// 違うため。例えば highschool-kyushu-block/2026/team-none-boys は 16 校のドローで
// 決勝まで「1〜4回戦」と表記しており、`roundLabelOf` の「準々決勝/準決勝/決勝」とは
// 一致しない。これは構造の誤りではなく表記の違いなので、名前の差は情報として数えるだけに
// する（**描画では実データの round 名がある枠はそれを優先して表示すること**）。
//
// 「ツリーにあるが matches に無い」枠は**異常ではない**（未実施の試合＝空欄で線だけ繋ぐ、
// というのがこの機能の目的そのもの）ので、数えるだけで失敗にはしない。

import fs from 'fs';
import path from 'path';

import { buildBracketTree, describeBracketLayout, roundLabelOf } from '../lib/bracketLayout';
import type { RawDetail, RawMatch } from '../lib/tournamentRecords';

const ROOT = process.cwd();
const DETAILS = path.join(ROOT, 'data', 'tournaments', 'details');
const verbose = process.argv.includes('--verbose');

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'temp' ? [] : walk(p);
    return e.name.endsWith('.json') && !e.name.startsWith('og') ? [p] : [];
  });

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/** ラウンド名 → ラウンド index（0=1回戦）。判定できなければ null。 */
function roundIndexOf(name: string | null | undefined, totalRounds: number): number | null {
  if (!name) return null;
  if (name === '決勝') return totalRounds - 1;
  if (name === '準決勝') return totalRounds - 2;
  if (name === '準々決勝') return totalRounds - 3;
  const m = /^(\d+)回戦$/.exec(name);
  return m ? Number(m[1]) - 1 : null;
}

let files = 0;
let covered = 0;
let missing = 0;
let roundMismatch = 0;
let labelDiff = 0;
let emptySlots = 0;
let filledSlots = 0;
const badFiles: string[] = [];
const labelDiffFiles = new Set<string>();

for (const filePath of walk(DETAILS)) {
  let detail: RawDetail;
  try {
    detail = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    continue;
  }
  if (!detail || !Array.isArray(detail.entries)) continue;
  const knockout = (detail.matches ?? []).filter((m: RawMatch) => m.stage === 'knockout');
  if (knockout.length === 0) continue;

  const { layout } = describeBracketLayout(detail);
  if (!layout) continue;
  files += 1;

  const tree = buildBracketTree(layout, detail.matches);

  // ツリー上の対戦カード → そのラウンド index
  const inTree = new Map<string, number>();
  for (const round of tree.rounds) {
    for (const n of round) {
      const [a, b] = n.entries;
      if (a != null && b != null) {
        inTree.set(pairKey(a, b), n.roundIndex);
        filledSlots += 1;
      } else {
        emptySlots += 1;
      }
    }
  }

  const rel = path.relative(ROOT, filePath);
  let fileBad = 0;
  for (const m of knockout) {
    const [a, b] = m.entries ?? [];
    if (typeof a !== 'number' || typeof b !== 'number') continue;
    const treeIdx = inTree.get(pairKey(a, b));
    if (treeIdx == null) {
      missing += 1;
      fileBad += 1;
      if (verbose && fileBad <= 3) console.log(`  ${rel} 対戦 [${a},${b}](${m.round}) がツリーに無い`);
      continue;
    }
    const dataIdx = roundIndexOf(m.round, tree.totalRounds);
    if (dataIdx != null && dataIdx !== treeIdx) {
      roundMismatch += 1;
      fileBad += 1;
      if (verbose && fileBad <= 3) console.log(`  ${rel} 対戦 [${a},${b}] データ=${m.round}(idx${dataIdx}) ツリー=idx${treeIdx}`);
      continue;
    }
    covered += 1;
    // 構造は合っているが名前の付け方が違う（例: 16 校ドローで決勝を「4回戦」と表記）
    const treeLabel = roundLabelOf(treeIdx, tree.totalRounds);
    if (m.round && m.round !== treeLabel) {
      labelDiff += 1;
      labelDiffFiles.add(rel);
    }
  }
  if (fileBad > 0) badFiles.push(`${rel}（${fileBad} 件）`);
}

console.log('ブラケットツリーの検証');
console.log(`  対象: ${files} 大会`);
console.log(`  実データの試合がツリーと一致: ${covered} 件`);
console.log(`  ツリーに無い試合: ${missing} 件 / ラウンド番号の不一致: ${roundMismatch} 件`);
console.log(`  枠の充足: 対戦確定 ${filledSlots} / 空欄 ${emptySlots}`);
if (labelDiff > 0) {
  console.log(`  （参考）構造は一致するがラウンド名の表記が異なる: ${labelDiff} 件 / ${labelDiffFiles.size} 大会`);
  for (const f of [...labelDiffFiles].slice(0, 5)) console.log(`      ${f}`);
  console.log('      → 描画では実データの round 名を優先すること');
}

if (badFiles.length > 0) {
  console.log('\n要確認:');
  for (const f of badFiles.slice(0, 20)) console.log(`  ${f}`);
  if (badFiles.length > 20) console.log(`  ... 他 ${badFiles.length - 20} 件`);
}

process.exit(missing > 0 || roundMismatch > 0 ? 1 : 0);
