#!/usr/bin/env node
/**
 * data/players/name-split-aliases.json の人手判断を大会データへ適用する（冪等）。
 *
 * 姓名の分割ゆれ（`谷|明日里` と `谷明|日里`）は、選手 id が `姓::名` の完全一致で
 * 解決されるため 1 人の戦績を 2 つの選手ページに割ってしまう。検出は
 * scripts/check-name-splits.mjs、判断の蓄積は data/players/name-split-aliases.json。
 *
 *   node scripts/normalize-name-splits.mjs --dry-run
 *   node scripts/normalize-name-splits.mjs
 *
 * 整形を壊さないよう JSON を再シリアライズせず、テキストへピンポイント置換する
 * （scripts/normalize-team-names.mjs と同じ方針）。置換対象は
 *   - 参加者の lastName / firstName（隣接ペアを一括で見て、他人に当たらないようにする）
 *   - participants[].id と、それを参照する playerIds / pair 等の配列要素
 * data/players/index.json は「表に載っている氏名の count だけ」を更新する。
 * scripts/extract-players.mjs による丸ごとの再生成はしない: 同スクリプトは閾値未満の名前も
 * 既定（minOccur=1）で新規採番するため、現データにあって index に無い数千名を一気に
 * 採番してしまい、分割修正と無関係な大改変になる（docs/wiki/team-player-identity.md 参照）。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ALIAS_PATH = path.join(ROOT, 'data/players/name-split-aliases.json');
const TARGET_DIRS = ['data/tournaments/details', 'data/st-league'];
const INDEX_PATH = path.join(ROOT, 'data/players/index.json');
/** 選手ページ（/players/{id}/results）が実在する下限。lib/playersIndex.ts と同じ規約。 */
const PLAYER_PAGE_MIN_COUNT = 5;

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function walkJson(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    // temp/ は取り込み途中の作業ファイル（participants を持たない別形式）。他のチェックと同様に触らない。
    if (e.isDirectory()) {
      if (e.name !== 'temp') walkJson(full, out);
    } else if (e.isFile() && e.name.endsWith('.json')) out.push(full);
  }
  return out;
}

/** 誤分割 "姓\t名" -> 正しい [姓, 名] */
function buildAliasMap() {
  const table = JSON.parse(fs.readFileSync(ALIAS_PATH, 'utf8'));
  const map = new Map();
  for (const e of table.entries ?? []) {
    const [ln, fn] = e.canonical;
    for (const [aln, afn] of e.aliases ?? []) {
      const key = `${aln}\t${afn}`;
      if (map.has(key)) throw new Error(`重複した alias: ${aln}|${afn}`);
      if (aln + afn !== ln + fn) throw new Error(`連結後の氏名が canonical と一致しない: ${aln}|${afn} vs ${ln}|${fn}`);
      map.set(key, [ln, fn]);
    }
  }
  return map;
}

function fixFile(file, aliasMap) {
  let text = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(text);
  const participants = Array.isArray(data.participants) ? data.participants : null;
  if (!participants) return null;

  const nameRepl = []; // { oldLn, oldFn, newLn, newFn }
  const idRepl = []; // { oldId, newId }
  const seenNames = new Set();

  for (const p of participants) {
    if (typeof p.lastName !== 'string' || typeof p.firstName !== 'string') continue;
    const hit = aliasMap.get(`${p.lastName}\t${p.firstName}`);
    if (!hit) continue;
    const [newLn, newFn] = hit;
    const key = `${p.lastName}\t${p.firstName}`;
    if (!seenNames.has(key)) {
      seenNames.add(key);
      nameRepl.push({ oldLn: p.lastName, oldFn: p.firstName, newLn, newFn });
    }
    // id は「姓_名_チーム_県」（空要素は除く）。normalize-team-names.mjs と同じ組み立て。
    const newId = [newLn, newFn, p.team ?? '', p.prefecture ?? ''].filter(Boolean).join('_');
    if (p.id && p.id !== newId) idRepl.push({ oldId: p.id, newId });
  }
  if (!nameRepl.length) return null;

  let changed = 0;

  // lastName / firstName は必ず隣接して現れる（participants の並びは id, lastName, firstName, ...）。
  // 2 フィールドをまとめて見ることで、姓だけ一致する別人へ誤爆しない。
  for (const { oldLn, oldFn, newLn, newFn } of nameRepl) {
    const re = new RegExp(`("lastName"\\s*:\\s*)"${escapeRegExp(oldLn)}"(\\s*,\\s*"firstName"\\s*:\\s*)"${escapeRegExp(oldFn)}"`, 'g');
    const count = (text.match(re) || []).length;
    if (!count) throw new Error(`${file}: ${oldLn}|${oldFn} のフィールド置換に失敗（lastName/firstName が隣接していない？）`);
    text = text.replace(re, (_, a, b) => `${a}"${newLn}"${b}"${newFn}"`);
    changed += count;
  }

  // 裸の `"${oldId}"` 全文置換は禁止（team 等のフィールド値と衝突しうる）。
  // normalize-team-names.mjs と同じく id フィールドと配列要素に限定する。
  for (const { oldId, newId } of idRepl) {
    const o = escapeRegExp(oldId);
    for (const re of [new RegExp(`("id"\\s*:\\s*)"${o}"`, 'g'), new RegExp(`([\\[,]\\s*)"${o}"(?=\\s*[,\\]])`, 'g')]) {
      const count = (text.match(re) || []).length;
      if (!count) continue;
      text = text.replace(re, (_, prefix) => `${prefix}"${newId}"`);
      changed += count;
    }
  }

  // 検証: 再パースできること・participants の id が重複しないこと
  const after = JSON.parse(text);
  const seen = new Map();
  for (const p of after.participants) seen.set(p.id, (seen.get(p.id) ?? 0) + 1);
  const dups = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  if (dups.length) throw new Error(`${file}: id が重複した -> ${dups.join(', ')}`);

  if (!DRY_RUN) fs.writeFileSync(file, text, 'utf8');
  return { changed, names: nameRepl.map((n) => `${n.oldLn}|${n.oldFn} -> ${n.newLn}|${n.newFn}`) };
}

/**
 * data/players/index.json の count を、表に載っている氏名についてだけ数え直す。
 * count は「その氏名が現れた大会ファイル数」（scripts/extract-players.mjs と同じ定義）。
 * 1行1オブジェクトの整形を保つため、行単位で count の数値だけ差し替える。
 */
function updateIndexCounts(aliasMap) {
  // 表に出てくる全ての姓名（canonical と alias の両方）
  const table = JSON.parse(fs.readFileSync(ALIAS_PATH, 'utf8'));
  const affected = new Set();
  for (const e of table.entries ?? []) {
    affected.add(e.canonical.join('\t'));
    for (const a of e.aliases ?? []) affected.add(a.join('\t'));
  }
  for (const k of aliasMap.keys()) affected.add(k);

  // 現データでの出現数（extract-players.mjs と同じ数え方: participants を持つ大会ファイル単位）
  const counts = new Map();
  for (const file of walkJson(path.join(ROOT, 'data/tournaments/details'))) {
    let json;
    try {
      json = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    if (!Array.isArray(json.participants)) continue;
    for (const p of json.participants) {
      const ln = (p.lastName ?? '').trim();
      const fn = (p.firstName ?? '').trim();
      if (!ln || !fn) continue;
      const k = `${ln}\t${fn}`;
      if (affected.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }

  const text = fs.readFileSync(INDEX_PATH, 'utf8');
  const lineRe = /^(\s*\{ "id": \d+, "lastName": "(.*?)", "firstName": "(.*?)", "count": )(\d+)( \},?)$/;
  const lines = text.split('\n');
  const crossed = [];
  let updated = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const m = lineRe.exec(lines[i]);
    if (!m) continue;
    const k = `${m[2]}\t${m[3]}`;
    if (!affected.has(k)) continue;
    const next = counts.get(k) ?? 0;
    const prev = Number(m[4]);
    if (next === prev) continue;
    lines[i] = `${m[1]}${next}${m[5]}`;
    updated += 1;
    if (prev < PLAYER_PAGE_MIN_COUNT !== next < PLAYER_PAGE_MIN_COUNT) {
      crossed.push(`${m[2]}|${m[3]} ${prev} -> ${next}`);
    }
  }
  if (updated && !DRY_RUN) fs.writeFileSync(INDEX_PATH, lines.join('\n'), 'utf8');
  return { updated, crossed };
}

function main() {
  const aliasMap = buildAliasMap();
  const files = TARGET_DIRS.flatMap((d) => walkJson(path.join(ROOT, d)));

  let touched = 0;
  let changed = 0;
  const applied = new Map();
  for (const file of files) {
    const r = fixFile(file, aliasMap);
    if (!r) continue;
    touched += 1;
    changed += r.changed;
    for (const n of r.names) applied.set(n, (applied.get(n) ?? 0) + 1);
    if (VERBOSE) console.log(`${path.relative(ROOT, file)}: ${r.changed}箇所 (${r.names.join(', ')})`);
  }

  console.log(`${DRY_RUN ? '[dry-run] ' : ''}${touched} ファイル / ${changed} 箇所を書き換え（分割 ${applied.size} 種）`);
  const unused = [...aliasMap.entries()].filter(([k]) => {
    const [ln, fn] = k.split('\t');
    const [nl, nf] = aliasMap.get(k);
    return !applied.has(`${ln}|${fn} -> ${nl}|${nf}`);
  });
  if (unused.length) {
    console.log(`未使用の alias ${unused.length} 件（適用済みなら正常）:`);
    for (const [k] of unused.slice(0, 20)) console.log(`  ${k.replace('\t', '|')}`);
  }

  const idx = updateIndexCounts(aliasMap);
  console.log(`${DRY_RUN ? '[dry-run] ' : ''}data/players/index.json: count を ${idx.updated} 行更新`);
  if (DRY_RUN && changed) {
    console.log('  ※ dry-run では大会データを書いていないので、count は現状のまま数えている（0 と出るのは正常）。');
  }
  for (const c of idx.crossed) console.log(`  ${PLAYER_PAGE_MIN_COUNT} を跨いだ（結果ページの有無が変わる）: ${c}`);

  if (changed || idx.updated) {
    console.log('');
    console.log('data/tournaments/details/highschool-* を変更した場合は npm run highschool:pipeline を再実行すること');
    console.log('（data/highschool/** の playerIds にも id が焼き込まれているため）。');
  }
}

main();
