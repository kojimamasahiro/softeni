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

export const LEDGER_VERSION = 2;

/**
 * クラスタの安定キー。メンバーの**チーム名**を正準化して昇順連結する。
 *
 * v1 では team id を使っていたが、これは誤りだった（2026-09-06 に実測して判明）。
 * `build-team-master.mjs` は `const id = teams.length + 1` と**位置でIDを振る**ため、
 * alias を反映してマスタを作り直すたびにIDが総入れ替わりになる。
 * 実測: 再生成の前後で 5,520件中 5,220件のIDが移動し、候補を作り直すと
 * 台帳426件の **idキー一致率は 0.0%**（名前キーなら 71.6%。残りは統合されて
 * 候補から消えたもので、失われたわけではない）。
 * つまり id キーは「再生成のたびに判断を捨てる」という、この台帳が直そうとした
 * 問題そのものを再現していた。
 *
 * 名前は判断の対象そのものなので、識別子としてこれ以上に安定なものが無い。
 * 表記ゆれの正準化（NFKC・空白除去）を挟み、`normalize-team-spacing` 等の
 * 揺れ吸収でキーが変わらないようにする。
 */
export function clusterKey(members) {
  return members
    .map((m) => (typeof m === 'string' ? m : m.name))
    .map((n) => String(n).normalize('NFKC').replace(/\s+/g, ''))
    .sort()
    .join('|');
}

export function emptyLedger() {
  return { version: LEDGER_VERSION, decisions: {} };
}

/** clusterKey と同じ正規化（1名分）。 */
const canonName = (n) => String(typeof n === 'string' ? n : n.name)
  .normalize('NFKC')
  .replace(/\s+/g, '');

/**
 * クラスタの判断を引き当てる。完全一致が無ければ、**顔ぶれが減る前の記録から
 * ペア単位で引き継ぐ**。
 *
 * なぜ要るか（2026-09-12 実測）:
 * 台帳のキーはメンバー名の連結なので、**クラスタの顔ぶれが変わるとキーが変わり、
 * 人の判断が孤児になる**。統合を戻したり、別の統合でメンバーが消えたりすると起きる。
 * 実例: `仙北STC|仙北クラブ|仙北スポ少|仙北スポ少大`（人が「別チーム」と判断）から
 * `仙北スポ少大` が消えると `仙北STC|仙北クラブ|仙北スポ少` になり、
 * **未判断として再登場して機械が「統合」を提案していた**（長野も同型。375件中2件）。
 * 自動統合を廃止していなければ、人が「別」と決めたものが黙って再統合されていた。
 *
 * 判断の実体は「どのメンバーとどのメンバーが同じか」というペアの集合なので、
 * 上位集合の記録があれば、生き残ったメンバーのペアだけを取り出せば一意に決まる。
 * 引き継いだ記録には `inheritedFrom` を付けて出所を追えるようにする。
 */
export function findDecision(members, decisions) {
  const key = clusterKey(members);
  if (decisions[key]) return { ...decisions[key], key };

  const names = members.map(canonName);
  let best = null;
  for (const [k, d] of Object.entries(decisions)) {
    const rec = (d.members || []).map(canonName);
    if (rec.length <= names.length) continue;
    if (!names.every((n) => rec.includes(n))) continue;
    // より近い（余分なメンバーが少ない）記録を優先する
    if (!best || rec.length < best.rec.length) best = { k, d, rec };
  }
  if (!best) return null;

  const raw = names.map((n) => (best.d.groups || [])[best.rec.indexOf(n)]);
  const uniq = [...new Set(raw)];
  const groups = raw.map((g) => uniq.indexOf(g));
  const counts = {};
  for (const g of groups) counts[g] = (counts[g] || 0) + 1;
  const verdict = Object.values(counts).some((n) => n >= 2) ? 'merge' : 'separate';
  // 統合の中身は、生き残ったメンバーだけで成立するものに限る
  const survive = new Set(names);
  const merges = (best.d.merges || []).filter((m) => [m.canonical, ...(m.aliases || [])].every((x) => survive.has(canonName(x))));

  return { ...best.d, key, members: members.map((m) => (typeof m === 'string' ? m : m.name)), groups, verdict, merges, inheritedFrom: best.k };
}

/**
 * v1（team id キー）→ v2（チーム名キー）へ移行する。
 * 各判断は `members` にチーム名を持っているので、そこから振り直せば失われない。
 */
export function migrateV1(raw) {
  const decisions = {};
  let collided = 0;
  for (const entry of Object.values(raw.decisions || {})) {
    if (!Array.isArray(entry.members) || entry.members.length === 0) continue;
    const key = clusterKey(entry.members);
    if (decisions[key]) collided++;
    decisions[key] = entry;
  }
  if (collided > 0) {
    console.warn(`[review-ledger] 移行中に同じ顔ぶれのクラスタが ${collided} 件重なった（後勝ち）。`);
  }
  return { version: LEDGER_VERSION, decisions };
}

export function readLedger() {
  if (!fs.existsSync(LEDGER_PATH)) return emptyLedger();
  const raw = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
  if (raw.version === 1) return migrateV1(raw);
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

/** 判断の中身（人が決めたこと）が同じか。decidedAt / revisions / decidedBy は比べない。 */
function sameDecision(a, b) {
  return (
    a.verdict === b.verdict &&
    JSON.stringify(a.groups ?? null) === JSON.stringify(b.groups ?? null) &&
    JSON.stringify(a.canon ?? null) === JSON.stringify(b.canon ?? null) &&
    JSON.stringify(a.merges ?? null) === JSON.stringify(b.merges ?? null)
  );
}

/**
 * 判断を1件取り込む。既存があれば上書きし、firstDecidedAt は最初の値を保つ
 * （「いつ最初に判断したか」と「最後に見直したか」を両方残すため）。
 *
 * 2026-09-12 に2つの不変条件を足した（欠陥4とその兄弟。raw 追記19・追記21）:
 *
 * 1. **中身が同じ再送信は記録しない。** レビュー画面の「確認済を反映」は、触っていない
 *    クラスタも含めて画面上の全件を毎回送る設計になっている。そのままだと無関係な
 *    クラスタの decidedAt が書き換わり revisions が増え続ける。実測では
 *    2026-09-12 のコミットで 358 件の revisions が一斉に +1 され、`revisions:25` が
 *    264 件並んでいた（人が25回迷ったのではなく、ボタンが25回押されただけ）。
 *    この汚染で「いつ・何回判断したか」は測定に使えなくなっていた。
 * 2. **human を auto へ下げない。** ブラウザの localStorage が古いと、既に人が確認した
 *    クラスタを `touched:false` のまま再送信し、decidedBy が human → auto へ巻き戻る
 *    （2026-09-11 に実データで41件発生）。抜き取り監査であれ全件レビューであれ、
 *    「誰が決めたか」は台帳の土台なので、下げる方向の更新は受け付けない。
 *
 * クライアント側（build-team-review-html.mjs）を直すだけでは、古いタブや古いキャッシュから
 * の送信を防げない。**サーバ側の不変条件として持つ**のが要点。
 */
export function recordDecision(ledger, entry) {
  const prev = ledger.decisions[entry.key];

  if (prev) {
    const downgrade = prev.decidedBy === 'human' && entry.decidedBy !== 'human';
    if (sameDecision(prev, entry)) {
      // 中身が同じ。auto → human の昇格（人が見て同意した）だけ反映し、それ以外は何もしない。
      if (prev.decidedBy !== 'human' && entry.decidedBy === 'human') {
        ledger.decisions[entry.key] = { ...prev, decidedBy: 'human', decidedAt: entry.decidedAt };
      }
      return ledger;
    }
    if (downgrade) {
      // 中身が違ううえに decidedBy を下げようとしている＝人の判断を機械/古い状態が
      // 上書きしようとしている。受け付けない。
      return ledger;
    }
  }

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

/**
 * 抜き取り監査で引かれたが、まだ人が判断していない（decidedBy:'human' の記録が無い）クラスタの
 * キー集合。
 *
 * なぜ要るか（docs/raw/2026-09-06-idea-autonomous-improvement-agent.md 追記15・追記16）:
 * 機械が「統合」と判定したクラスタは、そのままだと人が見る前に alias 適用され
 * `merge-candidates.json` から消える。**これが起きると誤統合を原理的に監査できない**
 * （実測: merge層の標本48件が1件も画面に出なかった）。
 * この集合に入っているキーは、機械が自動OKと判定していても**適用を保留**しなければならない
 * （`apply-auto-merges.mjs` 等、統合を自動適用するすべての経路が使うこと）。
 */
export function heldAuditKeys(rounds, decisions) {
  const held = new Set();
  for (const r of rounds || []) {
    for (const s of r.sample || []) {
      const now = decisions[s.key];
      if (!now || now.decidedBy !== 'human') held.add(s.key);
    }
  }
  return held;
}
