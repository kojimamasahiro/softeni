#!/usr/bin/env node
// チーム名マージレビューの進み具合を時系列で記録する。
//
// なぜ要るか（docs/raw/2026-09-06-idea-autonomous-improvement-agent.md）:
// 抜き取り監査は「機械が自動OKと判断したもののうち、人が覆した割合」を誤り率として使う。
// その割合は台帳（review-decisions.json）から今この瞬間の値なら計算できるが、
// **推移は残らない**。特に次の2つは後から復元できない:
//   - merge-candidates の件数（データ取り込みのたびに変わる。過去の値はどこにも無い）
//   - 上書きされた判断の、上書き前の内容（台帳は revisions の回数しか持たない）
//
// 記録は**数字が動いたときだけ**追記する。動いていない日を書き足しても情報が増えず、
// コミットとビルドだけが増えるため。
//
// 使い方:
//   node scripts/record-review-snapshot.mjs            # 変化があれば追記
//   node scripts/record-review-snapshot.mjs --dry-run  # 追記せず結果だけ出す
// 終了コード: 常に 0（追記の有無は標準出力とファイルの差分で判断する）

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { readLedger, summarize } from './lib/review-ledger.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HISTORY = path.join(ROOT, 'data', 'teams', 'review-history.json');
const CANDIDATES = path.join(ROOT, 'data', 'teams', 'merge-candidates.json');
const dryRun = process.argv.includes('--dry-run');

const ledger = summarize(readLedger());

// 候補の件数は「まだ人が見ていない量」の分母。データ取り込みで増減し、過去の値は復元できない。
let candidates = null;
let signalPlayers = null;
if (fs.existsSync(CANDIDATES)) {
  const cs = JSON.parse(fs.readFileSync(CANDIDATES, 'utf8'));
  candidates = cs.length;
  // signal:"players" は常に人手レビュー（自動OKにしない）ので、人にしか消化できない量。
  signalPlayers = cs.filter((c) => c.signal === 'players').length;
}

const snapshot = {
  date: new Date().toISOString().slice(0, 10),
  candidates,
  signalPlayers,
  decided: ledger.total,
  byHuman: ledger.human,
  byAuto: ledger.auto,
  merge: ledger.merge,
  separate: ledger.separate,
  // 抜き取り監査の素: 機械が自動OKと言ったもののうち、人が見た数と覆した数。
  autoOKReviewedByHuman: ledger.autoOKReviewedByHuman,
  autoOKOverturned: ledger.autoOKOverturned,
};

const history = fs.existsSync(HISTORY) ? JSON.parse(fs.readFileSync(HISTORY, 'utf8')) : [];
const last = history[history.length - 1];

function sameNumbers(a, b) {
  if (!a || !b) return false;
  return Object.keys(snapshot)
    .filter((k) => k !== 'date')
    .every((k) => a[k] === b[k]);
}

const rate =
  snapshot.autoOKReviewedByHuman > 0 ? (snapshot.autoOKOverturned / snapshot.autoOKReviewedByHuman).toFixed(3) : '—（人が見た自動OKが0件のため未測定）';

console.log(
  `候補 ${snapshot.candidates}（うち選手共有 ${snapshot.signalPlayers}） / ` +
    `判断済 ${snapshot.decided}（人 ${snapshot.byHuman}・自動 ${snapshot.byAuto}） / ` +
    `統合 ${snapshot.merge}・別チーム ${snapshot.separate}`,
);
console.log(`自動OKの誤り率: ${rate}（人が見た ${snapshot.autoOKReviewedByHuman} 件中 ${snapshot.autoOKOverturned} 件を覆した）`);

if (sameNumbers(last, snapshot)) {
  console.log(`変化なし（前回 ${last.date}）。追記しない。`);
  process.exit(0);
}
if (dryRun) {
  console.log('--dry-run のため追記しない。');
  process.exit(0);
}
history.push(snapshot);
fs.writeFileSync(HISTORY, JSON.stringify(history, null, 2) + '\n', 'utf8');
console.log(`追記した: ${path.relative(ROOT, HISTORY)}（通算 ${history.length} 点）`);
