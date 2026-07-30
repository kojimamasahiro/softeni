// 既存の大会データに `entries[].type`（seed / packing / extra）を matches から逆算して書き戻す。
//
// 使い方:
//   node scripts/backfill-entry-type.mjs            # 差分だけ出す（既定・書き込まない）
//   node scripts/backfill-entry-type.mjs --apply    # 実際に書き込む
//   node scripts/backfill-entry-type.mjs --verbose  # 対象外の理由も出す
//
// なぜ必要か:
//   トーナメント表（BracketSheets）は `entryNo` ＋ `entries[].type` から席順を復元して描く。
//   `type` が無い／間違っている大会は復元できず従来描画にフォールバックする。
//   完了済みの純トーナメントなら `matches` から `type` を確定できるので、埋めれば新描画に乗る。
//
// 対象にしないもの:
//   - **予選リーグを含む大会**。決勝トーナメントの枠はリーグの順位で決まり `entryNo` の
//     ドロー順とは無関係なので、そもそも復元してはいけない（埋めるべき欠損ではない）。
//   - 既に復元できている大会。触る必要が無い。
//
// 安全装置:
//   逆算した type を入れた状態でブラケットを組み直し、**knockout の全試合が正しい
//   ラウンドに配置されること**を確認できたファイルだけ書き込む。1 件でもずれたら見送る。
//   `calculateEntryType` の結果を信じるのではなく、結果で検算している。
//
// 書き換え方:
//   JSON を再シリアライズすると既存の整形（1 エントリー 1 行 / 複数行の 2 種類が混在）が
//   崩れて差分が巨大になるため、`"type": ...` の値だけをテキストで置換する。
//   `type` キーは entries にしか無く、全 entry が必ず持っていることを確認済み。
//
// 検討記録: docs/raw/2026-07-26-idea-bracket-redesign.md

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DETAILS = path.join(ROOT, 'data', 'tournaments', 'details');
const apply = process.argv.includes('--apply');
const verbose = process.argv.includes('--verbose');

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'temp' ? [] : walk(p);
    return e.name.endsWith('.json') && !e.name.startsWith('og') ? [p] : [];
  });

const pairKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/** 現在の type で席順を復元できるか（lib/bracketLayout.ts と同じ判定）。 */
function restorable(entries) {
  if (!entries?.length) return false;
  if (!entries.some((e) => e.type === 'seed' || e.type === 'extra')) {
    const n = entries.length;
    if (!(entries.every((e) => e.type === 'packing') && (n & (n - 1)) === 0)) return false;
  }
  const byNo = new Map(entries.map((e) => [e.entryNo, e.type ?? null]));
  const nos = [...byNo.keys()].sort((a, b) => a - b);
  let slots = 0;
  for (let i = 0; i < nos.length; ) {
    slots += 2;
    i += byNo.get(nos[i]) === 'seed' || byNo.get(nos[i]) === 'extra' ? 1 : 2;
  }
  return slots > 0 && (slots & (slots - 1)) === 0;
}

/**
 * matches の 1 回戦から席順を組み直し、各 entryNo の type を決める。
 *
 * 手順:
 *   1. entryNo 昇順に見て、隣同士が 1 回戦で対戦していれば実試合の枠（2 枠消費）、
 *      そうでなければ不戦勝の枠（本人＋bye で 2 枠消費）。
 *   2. できた 1 回戦の枠列に対し、実試合の枠の両者は `packing`。
 *      不戦勝の枠は、隣の枠が実試合なら `seed`、隣も不戦勝なら `extra`。
 *      （tools/tournament3 の buildEntriesMeta と同じ規約）
 */
function inferTypes(entries, matches) {
  const r1 = new Set(
    matches.filter((m) => m.stage === 'knockout' && m.round === '1回戦' && (m.entries ?? []).length === 2).map((m) => pairKey(m.entries[0], m.entries[1])),
  );
  if (r1.size === 0) return null;

  const nos = entries.map((e) => e.entryNo).sort((a, b) => a - b);
  /** 1 回戦の枠。[a, b] か [a, null]。 */
  const frames = [];
  for (let i = 0; i < nos.length; ) {
    const a = nos[i];
    const b = i + 1 < nos.length ? nos[i + 1] : null;
    if (b != null && r1.has(pairKey(a, b))) {
      frames.push([a, b]);
      i += 2;
    } else {
      frames.push([a, null]);
      i += 1;
    }
  }

  const size = frames.length * 2;
  if (size === 0 || (size & (size - 1)) !== 0) return null;

  const types = new Map();
  frames.forEach((f, m) => {
    if (f[1] != null) {
      types.set(f[0], 'packing');
      types.set(f[1], 'packing');
    } else {
      // 隣の枠（同じ 2 回戦へ合流する側）が実試合なら seed、そちらも不戦勝なら extra
      const neighbour = frames[m ^ 1];
      types.set(f[0], neighbour && neighbour[1] != null ? 'seed' : 'extra');
    }
  });
  return types;
}

/** 与えた type で組んだブラケットが、knockout の全試合と同じラウンドになるか検算する。 */
function verify(entries, matches, types) {
  const byNo = new Map(entries.map((e) => [e.entryNo, types.get(e.entryNo) ?? null]));
  const nos = [...byNo.keys()].sort((a, b) => a - b);
  const slots = [];
  for (let i = 0; i < nos.length; ) {
    const t = byNo.get(nos[i]);
    if (t === 'seed' || t === 'extra') {
      slots.push(nos[i], null);
      i += 1;
    } else {
      slots.push(nos[i], nos[i + 1] ?? null);
      i += 2;
    }
  }
  const size = slots.length;
  if (size === 0 || (size & (size - 1)) !== 0) return { ok: false, reason: `枠数 ${size} が2の冪でない` };

  const totalRounds = Math.log2(size);
  const pos = new Map();
  slots.forEach((no, i) => no != null && pos.set(no, i));

  const roundIndexOf = (name) => {
    if (!name) return null;
    if (name === '決勝') return totalRounds;
    if (name === '準決勝') return totalRounds - 1;
    if (name === '準々決勝') return totalRounds - 2;
    const m = /^(\d+)回戦$/.exec(name);
    return m ? Number(m[1]) : null;
  };

  let checked = 0;
  for (const m of matches) {
    if (m.stage !== 'knockout') continue;
    const [a, b] = m.entries ?? [];
    const p = pos.get(a);
    const q = pos.get(b);
    if (p == null || q == null) continue;
    const want = roundIndexOf(m.round);
    if (want == null) continue;
    let got = null;
    for (let k = 1; k <= totalRounds; k++) {
      if (p >> k === q >> k) {
        got = k;
        break;
      }
    }
    if (got !== want) return { ok: false, reason: `対戦 [${a},${b}] がデータ=${m.round} に対し復元=${got}回戦相当` };
    checked += 1;
  }
  return checked > 0 ? { ok: true, checked } : { ok: false, reason: '照合できる試合が無い' };
}

/** entries 内の `"type": ...` の値だけを差し替える（整形を壊さないため）。 */
function rewriteTypes(text, types) {
  let changed = 0;
  const out = text.replace(/("entryNo"\s*:\s*(\d+)[\s\S]*?"type"\s*:\s*)(?:"[a-z]+"|null)/g, (whole, head, no) => {
    const t = types.get(Number(no));
    if (t == null) return whole;
    const next = `${head}"${t}"`;
    if (next !== whole) changed += 1;
    return next;
  });
  return { out, changed };
}

const summary = { skipRestorable: 0, skipRoundRobin: 0, fixed: [], failed: [] };

for (const filePath of walk(DETAILS)) {
  let data;
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
    data = JSON.parse(text);
  } catch {
    continue;
  }
  if (!data || !Array.isArray(data.entries) || !Array.isArray(data.matches)) continue;
  if (!data.matches.some((m) => m.stage === 'knockout')) continue;

  const rel = path.relative(ROOT, filePath);
  if (restorable(data.entries)) {
    summary.skipRestorable += 1;
    continue;
  }
  if (data.matches.some((m) => m.stage === 'roundrobin')) {
    summary.skipRoundRobin += 1;
    if (verbose) console.log(`  skip(予選リーグ) ${rel}`);
    continue;
  }

  const types = inferTypes(data.entries, data.matches);
  if (!types) {
    summary.failed.push({ rel, reason: '1回戦から席順を組めない' });
    continue;
  }
  const v = verify(data.entries, data.matches, types);
  if (!v.ok) {
    summary.failed.push({ rel, reason: v.reason });
    continue;
  }

  const before = new Map(data.entries.map((e) => [e.entryNo, e.type ?? null]));
  const diff = [...types].filter(([no, t]) => before.get(no) !== t);
  const { out, changed } = rewriteTypes(text, types);

  summary.fixed.push({ rel, checked: v.checked, changed: diff.length, sample: diff.slice(0, 3) });
  if (apply && changed > 0) fs.writeFileSync(filePath, out);
}

console.log(apply ? 'entries[].type の逆算・書き込み' : 'entries[].type の逆算（dry-run。書き込みません）');
console.log(`  既に復元できている: ${summary.skipRestorable} 大会（対象外）`);
console.log(`  予選リーグを含む: ${summary.skipRoundRobin} 大会（構造的に対象外）`);
console.log(`  ${apply ? '書き込んだ' : '書き込める'}: ${summary.fixed.length} 大会`);
console.log(`  逆算できなかった: ${summary.failed.length} 大会`);

if (summary.fixed.length > 0) {
  console.log('\n--- 対象 ---');
  for (const f of summary.fixed) {
    const sample = f.sample.map(([no, t]) => `${no}→${t}`).join(', ');
    console.log(`  ${f.rel}  ${f.changed}件変更（${f.checked}試合で検算OK）  例: ${sample}`);
  }
}
if (summary.failed.length > 0) {
  console.log('\n--- 逆算できなかった（手作業が要る） ---');
  for (const f of summary.failed) console.log(`  ${f.rel} — ${f.reason}`);
}
