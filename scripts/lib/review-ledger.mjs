// チーム名マージレビューの「判断台帳」。
//
// なぜ要るか（docs/raw/2026-09-06-idea-autonomous-improvement-agent.md）:
// レビューHTMLの判断は localStorage にしか無く、しかも配列インデックス（state[i]）で
// 保持していた。merge-candidates.json は再生成されるたびに並びが変わるので、
// 過去の判断は**取り違えるか、KEY のバージョンを上げて捨てるか**の二択になっていた
// （実際 KEY は v9 まで上がっている）。結果、リポジトリに残っている人の判断は
// team-alias-additions-auto-reviewed.json の6件だけ。
//
// さらに buildOutput() は「統合する」判断しか書き出さない。
// 「これは別チームだ」という**否定の判断は一切残らない**が、機械の自動OK判定が
// 正しかったかを後から測るには、むしろ否定のほうが要る。
//
// この台帳は次の3つを直す:
//   1. クラスタを**メンバーの team id** で識別する（並び順に依存しない）
//   2. 「統合しない」判断も verdict:"separate" として残す
//   3. 機械が何を提案していたか（proposedAutoOK）を一緒に残す
//      → 後から「自動OKにしたが人が覆した」件数＝機械の誤り率が数えられる
//
// 生成物ではなく**再生成できない記録**なので、リポジトリに置く。

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const LEDGER_PATH = path.join(ROOT, 'data', 'teams', 'review-decisions.json');

export const LEDGER_VERSION = 1;

/**
 * クラスタの安定キー。メンバーの team id の昇順連結。
 * 候補生成のたびに順序や件数が変わっても、同じ顔ぶれなら同じキーになる。
 */
export function clusterKey(members) {
  return members
    .map((m) => m.id)
    .slice()
    .sort((a, b) => a - b)
    .join('-');
}

export function emptyLedger() {
  return { version: LEDGER_VERSION, decisions: {} };
}

export function readLedger() {
  if (!fs.existsSync(LEDGER_PATH)) return emptyLedger();
  const raw = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
  if (raw.version !== LEDGER_VERSION) {
    throw new Error(`review-decisions.json の version が ${raw.version}（期待: ${LEDGER_VERSION}）。移行を書くまで読み込まない。`);
  }
  return raw;
}

/** キー順に並べて書く（差分を読めるようにするため）。 */
export function writeLedger(ledger) {
  const sorted = {};
  for (const k of Object.keys(ledger.decisions).sort()) sorted[k] = ledger.decisions[k];
  const out = { version: LEDGER_VERSION, decisions: sorted };
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
  return out;
}

/**
 * 判断を1件取り込む。既存があれば上書きし、firstDecidedAt は最初の値を保つ
 * （「いつ最初に判断したか」と「最後に見直したか」を両方残すため）。
 */
export function recordDecision(ledger, entry) {
  const prev = ledger.decisions[entry.key];
  ledger.decisions[entry.key] = {
    ...entry,
    firstDecidedAt: prev?.firstDecidedAt || entry.decidedAt,
    revisions: prev ? (prev.revisions || 0) + 1 : 0,
  };
  delete ledger.decisions[entry.key].key;
  return ledger;
}

/** 機械の提案を人が覆した件数。抜き取り監査の誤り率の素になる。 */
export function summarize(ledger) {
  const d = Object.values(ledger.decisions);
  const human = d.filter((x) => x.decidedBy === 'human');
  const overturned = human.filter((x) => x.proposedAutoOK === true && x.verdict === 'separate');
  const confirmed = human.filter((x) => x.proposedAutoOK === true && x.verdict === 'merge');
  return {
    total: d.length,
    human: human.length,
    auto: d.filter((x) => x.decidedBy === 'auto').length,
    merge: d.filter((x) => x.verdict === 'merge').length,
    separate: d.filter((x) => x.verdict === 'separate').length,
    autoOKReviewedByHuman: overturned.length + confirmed.length,
    autoOKOverturned: overturned.length,
  };
}
