// entries[].type から復元したブラケットが、実際の matches と一致するか全データで検証する。
// 使い方: node scripts/verify-bracket-layout.mjs [--verbose]
//
// なぜ必要か:
//   トーナメント表の作り直し（docs/raw/2026-07-26-idea-bracket-redesign.md）は
//   「matches のツリーではなく entries から席順を復元する」ことが前提になっている。
//   復元が本当に正しいかは、完了済み大会の matches と突き合わせないと分からない。
//   突き合わせの基準は「2 組が実際に対戦したラウンド」＝復元した席順から計算した
//   合流ラウンドが一致するか。
//
//   lib/bracketLayout.ts はブラウザ向け TS なので、ここでは同じ手順を素の JS で
//   書き直している（二重管理だが、検証は「独立に書いたものと一致するか」に意味がある）。
//   ロジックを変えたら両方直すこと。
//
// 情報源が 2 つある（2026-08-22 追加）:
//   予選リーグ→決勝 T 形式の大会は `knockoutDraw`（席は「予選リーグの組」に属する）、
//   それ以外は `entries[].type`。詳細は docs/adr/ADR-015-knockout-draw-by-group.md。
//
// 実測（2026-08-22 時点）:
//   復元適用 374 大会 / 一致 27,635 試合 / **不一致 0 件**。復元不可は 7 大会。
//
// 実測（2026-07-31 時点。`knockoutDraw` 導入前）:
//   復元適用 173 大会 / 一致 18,901 試合 / **不一致 0 件**。
//   ほかに復元不可が 142 大会（シード未入力 132・枠数の整合性エラー 10）。
//   「1 回戦は隣接同士」は全データで例外なく成立している。
//
//   一時 zennihon-championship/2025/doubles-none-girls が entryNo 144-147 で
//   [144,146] [145,147] と隣接しない組み方になっており 5 件不一致だったが、
//   データ側の入力誤りと判明し修正済み（枠数は 2 冪のままなので、この種の誤りは
//   枠数チェックでは検出できない。このスクリプトでしか気付けない）。

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DETAILS = path.join(ROOT, 'data', 'tournaments', 'details');
const verbose = process.argv.includes('--verbose');

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'temp' ? [] : walk(p);
    return e.name.endsWith('.json') && !e.name.startsWith('og') ? [p] : [];
  });

/**
 * 予選リーグ→決勝 T 大会の席順を `knockoutDraw` から組む。
 * lib/bracketLayout.ts の layoutFromKnockoutDraw と同じ手順。
 */
function layoutFromDraw(data) {
  const slots = data?.knockoutDraw?.slots;
  if (!Array.isArray(slots) || slots.length === 0) return null;
  const size = slots.length;
  if ((size & (size - 1)) !== 0) return { failure: 'draw-slot-parity', size };

  const byGroupRank = new Map();
  for (const r of Array.isArray(data.results) ? data.results : []) {
    const rr = r?.roundrobin;
    if (r?.entryNo == null || !rr || rr.group == null || rr.rank == null) continue;
    byGroupRank.set(`${rr.group}/${rr.rank}`, r.entryNo);
  }

  const slotOf = new Map();
  slots.forEach((s, idx) => {
    if (!s) return;
    const no = byGroupRank.get(`${s.group}/${s.rank}`);
    if (no != null) slotOf.set(no, idx);
  });
  if (slotOf.size === 0) return { failure: 'draw-unresolved' };
  return { slotOf, size, totalRounds: Math.log2(size) };
}

/** lib/bracketLayout.ts の describeBracketLayout と同じ手順。失敗時は { failure } を返す。 */
function buildLayout(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return { failure: 'no-entries' };
  // 全件 packing かつ出場数が 2 冪なら bye 無しのドロー。seed/extra が無くても復元できる。
  // 出場数の 2 冪チェックが無いと、予選リーグ→決勝 T の大会（全件 packing になる）を
  // 誤復元する。詳細は lib/bracketLayout.ts のコメント。
  if (!entries.some((e) => e && (e.type === 'seed' || e.type === 'extra'))) {
    const n = entries.length;
    if (!(entries.every((e) => e && e.type === 'packing') && (n & (n - 1)) === 0)) return { failure: 'no-seed-info' };
  }

  const typeByNo = new Map(entries.map((e) => [e.entryNo, e.type ?? null]));
  const nos = [...typeByNo.keys()].sort((a, b) => a - b);

  const slots = [];
  for (let i = 0; i < nos.length; ) {
    const no = nos[i];
    const t = typeByNo.get(no);
    if (t === 'seed' || t === 'extra') {
      slots.push(no, null);
      i += 1;
    } else {
      slots.push(no, nos[i + 1] ?? null);
      i += 2;
    }
  }
  const size = slots.length;
  if (size === 0 || (size & (size - 1)) !== 0) return { failure: 'slot-parity', size };

  const slotOf = new Map();
  slots.forEach((no, idx) => {
    if (no != null) slotOf.set(no, idx);
  });
  return { slotOf, size, totalRounds: Math.log2(size) };
}

/** 'N回戦' / '準々決勝' / '準決勝' / '決勝' → ラウンド番号（1 始まり）。 */
function roundNumber(name, totalRounds) {
  if (!name) return null;
  if (name === '決勝') return totalRounds;
  if (name === '準決勝') return totalRounds - 1;
  if (name === '準々決勝') return totalRounds - 2;
  const m = /^(\d+)回戦$/.exec(name);
  return m ? Number(m[1]) : null;
}

const failureCounts = new Map();
const mismatches = [];
let applied = 0;
let ok = 0;
let fail = 0;

for (const filePath of walk(DETAILS)) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    continue;
  }
  if (!data || !Array.isArray(data.entries)) continue;
  const knockout = (Array.isArray(data.matches) ? data.matches : []).filter((m) => m && m.stage === 'knockout');
  if (knockout.length === 0) continue;

  const layout = layoutFromDraw(data) ?? buildLayout(data.entries);
  const rel = path.relative(ROOT, filePath);
  if (layout.failure) {
    failureCounts.set(layout.failure, (failureCounts.get(layout.failure) ?? 0) + 1);
    if (layout.failure === 'slot-parity' || layout.failure === 'draw-slot-parity')
      mismatches.push({ rel, reason: `枠数 ${layout.size} が2の冪でない`, count: null });
    continue;
  }
  applied += 1;

  let fileFail = 0;
  for (const m of knockout) {
    const [a, b] = m.entries ?? [];
    const p = layout.slotOf.get(a);
    const q = layout.slotOf.get(b);
    if (p == null || q == null || p === q) continue;
    const actual = roundNumber(m.round, layout.totalRounds);
    if (actual == null) continue;

    let expected = null;
    for (let k = 1; k <= layout.totalRounds; k++) {
      if (p >> k === q >> k) {
        expected = k;
        break;
      }
    }
    if (expected === actual) {
      ok += 1;
    } else {
      fail += 1;
      fileFail += 1;
      if (verbose && fileFail <= 3) {
        console.log(`  ${rel} ${m.matchId} [${a},${b}] データ=${m.round} 復元=${expected}回戦相当`);
      }
    }
  }
  if (fileFail > 0) mismatches.push({ rel, reason: '復元ラウンドが matches と不一致', count: fileFail });
}

console.log('ブラケット復元の検証');
console.log(`  復元適用: ${applied} 大会`);
for (const [reason, n] of [...failureCounts].sort()) console.log(`  復元不可(${reason}): ${n} 大会`);
console.log(`  試合の一致: ${ok} 件 / 不一致: ${fail} 件`);

if (mismatches.length > 0) {
  console.log('\n要確認:');
  for (const m of mismatches) {
    console.log(`  ${m.rel} — ${m.reason}${m.count ? `（${m.count} 件）` : ''}`);
  }
}

// 復元を適用した大会での不一致だけを失敗とする。
// slot-parity は復元を諦めているので（＝誤った表示は出ない）、ここでは警告に留める。
process.exit(fail > 0 ? 1 : 0);
