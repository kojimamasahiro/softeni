#!/usr/bin/env node
/**
 * 姓名の分割ゆれ（同一人物が `lastName + firstName` は同じなのに切り位置が違う）を検出する。
 *
 * 背景: 大会 PDF の取り込みでは氏名が 1 つの文字列として現れることが多く、姓と名の境界は
 * 推定するしかない。取り込みバッチごとに推定がぶれるため、同じ人物が
 * `谷|明日里` と `谷明|日里` のように 2 通りで登録される。選手 id は
 * `姓::名` の完全一致で解決される（lib/playersIndex.ts）ため、分割がぶれると
 * **1 人の戦績が 2 つの id に割れる**。
 *
 * 判断は人手で行う（どちらが正しいかは機械では決まらない）。確定したものは
 * data/players/name-split-aliases.json に蓄積し、scripts/normalize-name-splits.mjs で
 * データへ適用する。本スクリプトは人手の対応が要るものだけを報告する。
 *
 * 検出器は3つある。1つでは足りない理由もそれぞれ違う。
 *   A 分割衝突: 同じ氏名が2通りの切り方でデータに同居している。確実だが、
 *     **2通り無ければ気づけない**。1シリーズの大会にしか出ない氏名が全体の64%あり、
 *     そこに紛れた誤りはこの検出器では原理的に見つからない。
 *   B 辞書照合: 現在の切り方の片側がコーパスに1例も無く、かつ別の切り位置なら
 *     姓・名の両方に実例がある氏名を挙げる。**1回しか出ない氏名でも効く**ので、
 *     新しい大会を取り込んだ直後の点検はこちらが主役になる。
 *     ヒューリスティックなので既定では終了コードに影響しない（--strict で影響する）。
 *     見て正しかったものは name-split-aliases.json の "verified" に足すと消える。
 *   C 既知の誤分割の再混入: 表で alias（＝誤り）と決めた綴りがデータに入っている。
 *     **A も B も「人が判断済みの氏名」は見ない**ので、一度直した誤りが取り込みで
 *     1件だけ戻ってきた状態は、これが無いと誰も検出できない（実際 --strict を
 *     prebuild に入れる前の実験で素通りした）。人が誤りと断定済みの綴りなので、
 *     ヒューリスティックではなく常に終了コード 1 にする。
 *
 *   node scripts/check-name-splits.mjs           # A と C で判定（あれば終了コード 1）
 *   node scripts/check-name-splits.mjs --strict  # B も終了コードに含める（prebuild はこれ）
 *   node scripts/check-name-splits.mjs --all     # 登録済みも含めて全件出す
 *   node scripts/check-name-splits.mjs --json    # 機械可読出力
 *   node scripts/check-name-splits.mjs --list    # 確定済みの判断（alias 表）を1行ずつ見直す
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const ALIAS_PATH = path.join(ROOT, 'data/players/name-split-aliases.json');

const SHOW_ALL = process.argv.includes('--all');
const AS_JSON = process.argv.includes('--json');
const LIST_TABLE = process.argv.includes('--list');
const STRICT = process.argv.includes('--strict');

/** 姓名の辞書照合の対象にする文字種（漢字・かな・々）。ローマ字表記の外国人選手は対象外。 */
const JA_NAME = /^[\u3041-\u309f\u30a0-\u30ff\u3005\u4e00-\u9fff\uf900-\ufaff\u{20000}-\u{2ffff}\ufe00-\ufe0f\u{e0100}-\u{e01ef}]+$/u;

/** temp/ は取り込み途中の作業ファイル（形が異なる）。check-tournament-entries.mjs と同様に除外する。 */
function walkJson(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'temp') walkJson(full, out);
    } else if (e.isFile() && e.name.endsWith('.json')) out.push(full);
  }
  return out;
}

/** 任意の JSON から lastName/firstName を持つオブジェクトを再帰的に拾う。 */
function collectNames(node, visit) {
  if (Array.isArray(node)) {
    for (const v of node) collectNames(v, visit);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const { lastName, firstName } = node;
  if (typeof lastName === 'string' && lastName && typeof firstName === 'string' && firstName) {
    visit(node);
  }
  for (const v of Object.values(node)) collectNames(v, visit);
}

/** 大会 id / 年をパスから復元する（出典の独立性を数えるために使う）。 */
function sourceOf(relPath) {
  const m = relPath.match(/^data\/tournaments\/details\/([^/]+)\/(\d{4})\//);
  if (m) return { series: m[1], instance: `${m[1]}/${m[2]}` };
  const s = relPath.match(/^data\/([^/]+)\//);
  return { series: s ? s[1] : relPath, instance: relPath };
}

/** 確定済みの判断を1行ずつ出す（人が見直すため。データは走査しない）。 */
function listTable() {
  const table = JSON.parse(fs.readFileSync(ALIAS_PATH, 'utf8'));
  const entries = table.entries ?? [];
  for (const e of entries) {
    const from = (e.aliases ?? []).map((a) => a.join('|')).join(' , ');
    console.log(`${e.canonical.join('|')}\t← ${from}\t${e.reason ?? ''}`);
  }
  console.log(`\n確定済み ${entries.length} 件。直したいものは data/players/name-split-aliases.json の`);
  console.log('canonical と aliases を入れ替えて node scripts/normalize-name-splits.mjs を実行する。');
}

/**
 * 大会データの participants を "姓\t名" で索引する。
 * data/players/index.json は誤分割の残骸を count:0 で残すので、辞書にも照合にも使わない。
 */
function buildParticipantIndex() {
  const persons = new Map(); // "姓\t名" -> { count, files:Set, teams:Set }
  for (const file of walkJson(path.join(ROOT, 'data/tournaments/details'))) {
    let json;
    try {
      json = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    if (!Array.isArray(json.participants)) continue;
    const rel = path.relative(ROOT, file);
    for (const p of json.participants) {
      const ln = (p.lastName ?? '').trim();
      const fn = (p.firstName ?? '').trim();
      if (!ln || !fn) continue;
      const k = `${ln}\t${fn}`;
      let v = persons.get(k);
      if (!v) persons.set(k, (v = { count: 0, files: new Set(), teams: new Set() }));
      v.count += 1;
      v.files.add(rel);
      if (p.team) v.teams.add(p.team);
    }
  }
  return persons;
}

/**
 * 検出器C（既知の誤分割の再混入）。表で alias（＝誤り）と決めた綴りが、データに残っている
 * ／新しい取り込みで戻ってきた場合に挙げる。**判断済みの氏名は A も B も見ない**ため、
 * これが無いと「一度直した誤りが1件だけ再混入した」状態を誰も検出できない。
 * 誤りだと人が既に断定した綴りなので、ヒューリスティックではなく常にエラー扱いにする。
 */
function findKnownBadSplits(persons, aliasToCanonical) {
  const found = [];
  for (const [k, occ] of persons) {
    const canonical = aliasToCanonical.get(k);
    if (!canonical) continue;
    const [ln, fn] = k.split('\t');
    found.push({
      lastName: ln,
      firstName: fn,
      canonical,
      count: occ.count,
      teams: [...occ.teams].sort(),
      files: [...occ.files].sort(),
    });
  }
  return found.sort((a, b) => b.count - a.count);
}

/**
 * 検出器B（辞書照合）。大会データの participants から姓・名の実例辞書を作り、
 * 「現在の切り方の片側が他に1例も無い」かつ「別の切り位置なら姓・名とも実例がある」
 * 氏名を挙げる。
 */
function findDictionarySuspects(persons, verified, decided, reportedFullNames) {
  // 実人数（同一人物の重複出場を数えない）で辞書を作る
  const lastFreq = new Map();
  const firstFreq = new Map();
  for (const k of persons.keys()) {
    const [ln, fn] = k.split('\t');
    lastFreq.set(ln, (lastFreq.get(ln) ?? 0) + 1);
    firstFreq.set(fn, (firstFreq.get(fn) ?? 0) + 1);
  }

  const suspects = [];
  for (const [k, occ] of persons) {
    const [ln, fn] = k.split('\t');
    const count = occ.count;
    const full = ln + fn;
    if (full.length < 3 || !JA_NAME.test(full)) continue;
    if (verified.has(k)) continue;
    if (decided.has(full)) continue; // 人が既に決めた氏名
    if (reportedFullNames.has(full)) continue; // 検出器A で出ているので二重に出さない

    // 自分自身を除いた実例数。姓か名のどちらかが 0 のときだけ疑う。
    const lnOthers = (lastFreq.get(ln) ?? 0) - 1;
    const fnOthers = (firstFreq.get(fn) ?? 0) - 1;
    if (lnOthers > 0 && fnOthers > 0) continue;

    const alts = [];
    for (let i = 1; i < full.length; i += 1) {
      const a = full.slice(0, i);
      const b = full.slice(i);
      if (a === ln) continue;
      const la = lastFreq.get(a) ?? 0;
      const fb = firstFreq.get(b) ?? 0;
      if (la > 0 && fb > 0) alts.push({ lastName: a, firstName: b, lastFreq: la, firstFreq: fb });
    }
    if (!alts.length) continue;
    alts.sort((x, y) => y.lastFreq + y.firstFreq - (x.lastFreq + x.firstFreq));
    suspects.push({
      lastName: ln,
      firstName: fn,
      count,
      files: [...occ.files].sort(),
      teams: [...occ.teams].sort(),
      lastFreq: lnOthers,
      firstFreq: fnOthers,
      alternatives: alts,
      // 現在の切り方にも別解にも同程度しか裏づけが無い＝機械では決められない
      tie: alts[0].lastFreq <= 1 && alts[0].firstFreq <= 1,
    });
  }
  suspects.sort((a, b) => b.alternatives[0].lastFreq + b.alternatives[0].firstFreq - (a.alternatives[0].lastFreq + a.alternatives[0].firstFreq));
  return suspects;
}

function main() {
  if (LIST_TABLE) {
    listTable();
    process.exit(0);
  }

  // fullName -> 表に載っている分割（canonical + aliases）の集合。
  // 全ての変種がこの集合に収まっていれば「判断済み（適用待ち）」として既定では隠す。
  const known = new Map();
  const decided = new Set(); // 人が判断済みの氏名（連結後）
  const verified = new Set(); // 「見たが現状の切り方で正しい」と確認済みの姓名
  const aliasToCanonical = new Map(); // 誤りと決めた "姓\t名" -> 正しい [姓, 名]
  if (fs.existsSync(ALIAS_PATH)) {
    const table = JSON.parse(fs.readFileSync(ALIAS_PATH, 'utf8'));
    for (const e of table.entries ?? []) {
      const full = e.canonical.join('');
      const set = known.get(full) ?? new Set();
      set.add(e.canonical.join('\t'));
      for (const a of e.aliases ?? []) set.add(a.join('\t'));
      known.set(full, set);
      decided.add(full);
    }
    for (const v of table.verified ?? []) verified.add(v.join('\t'));
    for (const e of table.entries ?? []) {
      for (const a of e.aliases ?? []) aliasToCanonical.set(a.join('\t'), e.canonical);
    }
  }

  // fullName -> "姓\t名" -> { count, series:Set, instances:Set, teams:Map }
  const corpus = new Map();
  for (const file of walkJson(DATA_DIR)) {
    const rel = path.relative(ROOT, file);
    let json;
    try {
      json = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue; // 壊れた JSON は別のチェックの領分
    }
    const { series, instance } = sourceOf(rel);
    collectNames(json, (p) => {
      const full = p.lastName + p.firstName;
      const key = `${p.lastName}\t${p.firstName}`;
      let byFull = corpus.get(full);
      if (!byFull) corpus.set(full, (byFull = new Map()));
      let v = byFull.get(key);
      if (!v) byFull.set(key, (v = { count: 0, series: new Set(), instances: new Set(), teams: new Map(), files: new Set() }));
      v.count += 1;
      v.files.add(rel);
      // players/index.json などの派生ファイルは「出典」に数えない（二重計上になる）
      if (!rel.startsWith('data/players/')) {
        v.series.add(series);
        v.instances.add(instance);
      }
      if (p.team) v.teams.set(p.team, (v.teams.get(p.team) ?? 0) + 1);
    });
  }

  const conflicts = [];
  for (const [full, byFull] of corpus) {
    if (byFull.size < 2) continue;
    const table = known.get(full);
    const registered = Boolean(table) && [...byFull.keys()].every((k) => table.has(k));
    if (!SHOW_ALL && registered) continue;
    const variants = [...byFull.entries()]
      .map(([key, v]) => {
        const [lastName, firstName] = key.split('\t');
        return {
          lastName,
          firstName,
          count: v.count,
          series: [...v.series].sort(),
          instances: [...v.instances].sort(),
          teams: [...v.teams.keys()].sort(),
        };
      })
      .sort((a, b) => b.series.length - a.series.length || b.count - a.count);
    conflicts.push({ fullName: full, registered, variants });
  }
  conflicts.sort((a, b) => b.variants[0].series.length - a.variants[0].series.length || a.fullName.localeCompare(b.fullName, 'ja'));

  const persons = buildParticipantIndex();
  const knownBad = findKnownBadSplits(persons, aliasToCanonical);
  const suspects = findDictionarySuspects(persons, verified, decided, new Set(conflicts.map((c) => c.fullName)));

  if (AS_JSON) {
    console.log(JSON.stringify({ conflicts, knownBad, suspects }, null, 2));
  } else {
    for (const c of conflicts) {
      console.log(`## ${c.fullName}${c.registered ? '  [登録済]' : ''}`);
      for (const v of c.variants) {
        console.log(`   ${v.lastName} | ${v.firstName}  x${v.count}  出典系列${v.series.length} [${v.series.join(', ')}]`);
        console.log(`     所属: ${v.teams.join(' / ') || '(なし)'}`);
      }
    }
    console.log(`\n[A] 分割衝突 ${conflicts.length} 件${SHOW_ALL ? '（登録済を含む）' : '（未登録のみ。--all で全件）'}`);
    if (conflicts.length && !SHOW_ALL) {
      console.log('人手で正しい分割を決め、data/players/name-split-aliases.json に追記してから');
      console.log('node scripts/normalize-name-splits.mjs を実行すること。');
    }

    console.log('');
    for (const s2 of suspects) {
      const a = s2.alternatives[0];
      const side = s2.lastFreq === 0 ? '姓' : '名';
      console.log(`## ${s2.lastName} | ${s2.firstName}  x${s2.count}`);
      console.log(`   現在の切り方は${side}がコーパスに他に無い（姓他${s2.lastFreq} / 名他${s2.firstFreq}）`);
      console.log(
        `   別解: ${a.lastName} | ${a.firstName}  （姓${a.lastFreq}人 / 名${a.firstFreq}人が実在）${s2.tie ? '  ※どちらも裏づけが弱く機械では決められない' : ''}`,
      );
      console.log(`   所属: ${s2.teams.join(' / ') || '(なし)'}`);
      for (const f of s2.files) console.log(`     ${f}`);
    }
    console.log(`[B] 辞書照合の疑い ${suspects.length} 件（1度しか出ない氏名にも効く）`);
    if (suspects.length) {
      console.log('見て正しければ name-split-aliases.json の "verified" に ["姓","名"] を足すと消える。');
      console.log('誤りなら entries に canonical / aliases として足して normalize-name-splits.mjs を実行する。');
    }

    console.log('');
    for (const b of knownBad) {
      console.log(`## ${b.lastName} | ${b.firstName}  x${b.count}  → 正しくは ${b.canonical.join(' | ')}`);
      console.log(`   所属: ${b.teams.join(' / ') || '(なし)'}`);
      for (const f of b.files) console.log(`     ${f}`);
    }
    console.log(`[C] 既知の誤分割の再混入 ${knownBad.length} 件`);
    if (knownBad.length) {
      console.log('人が誤りと判断済みの綴りがデータに入っている。');
      console.log('node scripts/normalize-name-splits.mjs を実行すること。');
    }
  }

  // C は人が誤りと断定済みなので常にゲートする。B はヒューリスティックなので --strict のときだけ。
  const failing = (!SHOW_ALL && conflicts.length) || knownBad.length || (STRICT && suspects.length);
  process.exit(failing ? 1 : 0);
}

main();
