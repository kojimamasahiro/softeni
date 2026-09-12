// 判断台帳に記録された「人の統合判断」を alias 表へ反映する。
//
// 2026-09-12 の方針変更（チーム名寄せは全件レビューへ縮小）:
// このスクリプトは以前「機械が自動OKと判定したクラスタを、人が見る前に一括統合する」ものだった。
// いまは **人が判断したものしか適用しない**。機械の判定（team-grouping.mjs）は
// 候補の既定グループを提案するところまでで、適用の引き金にはならない。
//
// なぜ変えたか（docs/raw/2026-09-06-idea-autonomous-improvement-agent.md 追記21）:
// 抜き取り監査は「一度に大量が流入する」場所でしか成立しない。チーム名寄せの実測では
// 新規に生まれる自動OKクラスタが 2026-09-06 以降で 1 件しかなく、母集団1件では
// 誤り率を測れない。この規模なら全件を人が見るほうが素直で正確なので、
// 自動適用と抜き取り（--draw / heldAuditKeys）を外し、レビュー画面での全件判断に一本化した。
// 抜き取り監査そのものは PDF 取り込み系（scripts/pdf-to-players/）へ移す。
//
// ID ずれのガード（2026-09-12 追加）:
// merge-candidates.json は teams.json の id を持つが、build-team-master.mjs が
// `const id = teams.length + 1` と位置で id を振るため、alias を反映してマスタを作り直すと
// id が総入れ替わりになる。ずれたまま統合すると**別チームの文脈をもとに統合**してしまう。
// 2026-09-12 に実際に 133 件ずれた状態が見つかったので、適用前に必ず検査する。
//
// 適用後は normalize-team-names.mjs + build-team-master.mjs の再実行が必要。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { applyAdditions } from './apply-team-aliases.mjs';
import { clusterKey, findDecision, readLedger } from './lib/review-ledger.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clusters = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'teams', 'merge-candidates.json'), 'utf8'));
const teams = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'teams', 'teams.json'), 'utf8'));

// ---- ガード: 候補とマスタの id がずれていないか ----
const byId = new Map(teams.map((t) => [t.id, t]));
let misaligned = 0;
for (const c of clusters) {
  for (const m of c.members || []) {
    const actual = byId.get(m.id);
    if (!actual || actual.name !== m.name) misaligned++;
  }
}
if (misaligned > 0) {
  console.error(`中止: merge-candidates.json と teams.json の id が ${misaligned} 件ずれている。`);
  console.error('この状態で統合すると、別チームの文脈（選手名・出場大会）をもとに判断したものを適用してしまう。');
  console.error('直し方: node scripts/build-team-merge-candidates.mjs で候補を作り直す。');
  console.error('（検査だけしたい場合: node scripts/check-team-id-alignment.mjs）');
  process.exit(1);
}

// ---- 人の判断だけを集める ----
const ledger = readLedger();
const additions = [];
let humanMerge = 0;
let humanSeparate = 0;
let undecided = 0;
let machineOnly = 0;

for (const c of clusters) {
  const key = clusterKey(c.members);
  // 完全一致が無くても、顔ぶれが減る前の記録から引き継ぐ（review-ledger.mjs の findDecision）。
  // これをしないと、統合を戻してメンバーが変わったクラスタが「未判断」に見え、
  // 人が「別チーム」と決めたものを機械が再び統合候補として扱ってしまう。
  const d = findDecision(c.members, ledger.decisions);
  if (!d) {
    undecided++;
    continue;
  }
  if (d.decidedBy !== 'human') {
    // 過去に機械が決めた記録。いまは適用の根拠にしない（人が見るまで待つ）。
    machineOnly++;
    continue;
  }
  if (d.verdict !== 'merge') {
    humanSeparate++;
    continue;
  }
  humanMerge++;
  // 統合の中身は**人の判断として記録されたもの**を使う。機械の既定グループで作り直さない
  // （人がグループを組み替えている場合、機械側で作り直すとその判断を無視することになる）。
  for (const e of d.merges || []) additions.push(e);
}

console.log('人の判断の反映（機械の自動統合は 2026-09-12 に廃止）');
console.log(`  候補 ${clusters.length} 件のうち`);
console.log(`    人が「統合」と判断: ${humanMerge} 件（別名 ${additions.length} 組）`);
console.log(`    人が「別チーム」と判断: ${humanSeparate} 件`);
console.log(`    機械の記録のみ（適用しない）: ${machineOnly} 件`);
console.log(`    未判断: ${undecided} 件${undecided ? '  → npm run team:review で判断する' : ''}`);

if (additions.length === 0) {
  console.log('反映するものが無いので終了する。');
  process.exit(0);
}

// 何が適用されるかを先に見られるようにする（統合は後戻りが高くつくため）。
if (process.argv.includes('--dry-run')) {
  console.log('[dry-run] 適用せずに終了する。反映される別名は次の通り:');
  for (const e of additions.slice(0, 20)) console.log(`  ${e.canonical} ← ${e.aliases.join(' / ')}${e.note ? `  (${e.note})` : ''}`);
  if (additions.length > 20) console.log(`  ... 他 ${additions.length - 20} 組`);
  process.exit(0);
}

const res = applyAdditions(additions);
console.log(`alias反映: 適用 ${res.applied.length} / スキップ ${res.skipped.length} / 競合 ${res.conflicts.length}`);
if (res.conflicts.length) for (const x of res.conflicts.slice(0, 10)) console.warn('  競合:', x.canonical, JSON.stringify(x.issues));

console.log('→ 次: node scripts/normalize-team-names.mjs --scope=all && node scripts/build-team-master.mjs');
