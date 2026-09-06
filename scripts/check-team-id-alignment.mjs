#!/usr/bin/env node
// マージ候補(merge-candidates.json)とチームマスタ(teams.json)のIDがずれていないか検査する。
//
// 背景（docs/raw/2026-09-06-idea-autonomous-improvement-agent.md 追記8）:
// `scripts/build-team-master.mjs` は `const id = teams.length + 1` と**位置でIDを振る**ため、
// alias を反映してマスタを作り直すとIDが総入れ替わりになる（実測: 5,520件中5,220件が移動）。
// 一方 `merge-candidates.json` は作り直さない限り**旧IDを持ち続ける**。
//
// この状態でレビュー画面を開くと、メンバーの文脈（選手名・年・出場大会）は
// `team-context.json` を**IDで**引くので、**別チームの経歴が別チームの名前で表示される**。
// 2026-09-06 に実際に起きた: 「白鴎大足利高校」の欄に小学生クラブ「いすみジュニア」の
// 出場大会（zennihon-primaryschool ほか）が出ていた。実測では
// **1,223メンバー中1,211がずれ、一致はわずか12**だった。
//
// 表示が静かに嘘になるだけでデータは壊れないため、人が気付ける手掛かりが乏しい。
// 実際、発見は「小学生大会に高校が出ているのはおかしい」という利用者の違和感からだった。
// 機械なら一致率を数えるだけで確実に落とせる。
//
// 直し方: node scripts/build-team-merge-candidates.mjs で候補を作り直す。
// （かつては「レビュー中は候補を作り直さない（番号がずれるため）」と運用していたが、
//   判断台帳がチーム名キーになった 2026-09-06 以降その制約は無い。）
//
// 使い方: node scripts/check-team-id-alignment.mjs [--json]
// 終了コード: ずれが1件でもあれば 1。

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANDIDATES = path.join(ROOT, 'data', 'teams', 'merge-candidates.json');
const TEAMS = path.join(ROOT, 'data', 'teams', 'teams.json');
const CONTEXT = path.join(ROOT, 'data', 'teams', 'team-context.json');
const asJson = process.argv.includes('--json');

if (!fs.existsSync(CANDIDATES)) {
  console.log('merge-candidates.json が無いので検査をスキップする。');
  process.exit(0);
}
if (!fs.existsSync(TEAMS)) {
  console.error('teams.json が無い。先に node scripts/build-team-master.mjs を実行すること。');
  process.exit(1);
}

const clusters = JSON.parse(fs.readFileSync(CANDIDATES, 'utf8'));
const teams = JSON.parse(fs.readFileSync(TEAMS, 'utf8'));
const context = fs.existsSync(CONTEXT) ? JSON.parse(fs.readFileSync(CONTEXT, 'utf8')) : {};

const byId = new Map(teams.map((t) => [t.id, t]));

const mismatches = [];
let checked = 0;
for (const cluster of clusters) {
  for (const member of cluster.members || []) {
    checked++;
    const actual = byId.get(member.id);
    if (!actual) {
      mismatches.push({ name: member.name, id: member.id, actual: null, reason: 'IDがマスタに無い' });
    } else if (actual.name !== member.name) {
      mismatches.push({ name: member.name, id: member.id, actual: actual.name, reason: '同じIDが別チームを指している' });
    }
  }
}

// 文脈が引けないメンバー（表示が空になる）も併せて数える。ずれの副作用として出る。
const noContext = [];
for (const cluster of clusters) {
  for (const member of cluster.members || []) {
    if (!context[member.id]) noContext.push(member.name);
  }
}

if (asJson) {
  console.log(JSON.stringify({ checked, mismatches, noContext: noContext.length }, null, 2));
} else {
  console.log(`マージ候補とチームマスタのID照合`);
  console.log(`  クラスタ: ${clusters.length} / メンバー: ${checked}`);
  console.log(`  一致: ${checked - mismatches.length} / ずれ: ${mismatches.length}`);
  if (noContext.length) console.log(`  文脈(team-context)が引けないメンバー: ${noContext.length}`);
  if (mismatches.length) {
    console.log('');
    console.log('ずれの例（最大10件）:');
    for (const m of mismatches.slice(0, 10)) {
      console.log(`  「${m.name}」 id=${m.id} → マスタでは「${m.actual ?? '（該当なし）'}」（${m.reason}）`);
    }
    console.log('');
    console.log('レビュー画面の文脈（選手名・年・出場大会）が別チームのものになっている。');
    console.log('直し方: node scripts/build-team-merge-candidates.mjs で候補を作り直す。');
  }
}

process.exit(mismatches.length ? 1 : 0);
