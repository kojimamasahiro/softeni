#!/usr/bin/env node
/**
 * 大会結果データ（data/tournaments/details）の学校名・都道府県の表記揺れを統一する。
 *
 * 2種類の揺れを正規化する:
 *   1. 学校名: data/tournaments/team-name-aliases.json の対応表で別名 -> 正準名へ寄せる
 *   2. 都道府県: 接尾辞（県/府/都）が無い表記（例: 奈良 / 大阪 / 東京）に
 *      正しい接尾辞を補う（47都道府県の内蔵マップ）。
 *
 * 対象: participants[].team / participants[].prefecture / participants[].id と
 *       entries[].playerIds（参加者IDの参照）。id（`姓_名_チーム_都道府県`）を再計算し参照も張り替える。
 *
 * 重要: JSON 全体を再シリアライズすると playerIds 等のインライン配列の整形が変わり巨大な差分が出る。
 *       そこで JSON はパースして「どの文字列をどう置換すべきか」だけを算出し、元テキストへ
 *       ピンポイント置換する（整形を保つ）。冪等。
 *
 * 対象スコープ:
 *   既定では highschool-japan-cup（HJC）配下のみ。--scope=<tournamentId>（--scope=all で全大会）で変更可。
 *
 * 使い方:
 *   node scripts/normalize-team-names.mjs
 *   node scripts/normalize-team-names.mjs --dry-run
 *   node scripts/normalize-team-names.mjs --scope=all
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DETAILS_DIR = path.join(ROOT, 'data', 'tournaments', 'details');
const ALIAS_FILE = path.join(ROOT, 'data', 'tournaments', 'team-name-aliases.json');

const DRY_RUN = process.argv.includes('--dry-run');
const SCOPE_ARG = process.argv.find((a) => a.startsWith('--scope='));
const SCOPE = SCOPE_ARG ? SCOPE_ARG.slice('--scope='.length) : 'highschool-japan-cup';

// 47都道府県: 接尾辞なし表記 -> 正準表記
const PREF_CANON = (() => {
  const ken = [
    '青森', '岩手', '宮城', '秋田', '山形', '福島', '茨城', '栃木', '群馬', '埼玉',
    '千葉', '神奈川', '新潟', '富山', '石川', '福井', '山梨', '長野', '岐阜', '静岡',
    '愛知', '三重', '滋賀', '兵庫', '奈良', '和歌山', '鳥取', '島根', '岡山', '広島',
    '山口', '徳島', '香川', '愛媛', '高知', '福岡', '佐賀', '長崎', '熊本', '大分',
    '宮崎', '鹿児島', '沖縄',
  ];
  const m = new Map();
  for (const k of ken) m.set(k, k + '県');
  m.set('東京', '東京都');
  m.set('大阪', '大阪府');
  m.set('京都', '京都府');
  m.set('北海道', '北海道');
  return m;
})();

/** 都道府県を正準表記へ。既に接尾辞付き or 不明ならそのまま返す。 */
function canonPref(pref) {
  if (pref == null) return pref;
  if (/[都道府県]$/.test(pref)) return pref; // 既に接尾辞あり
  return PREF_CANON.get(pref) ?? pref; // 既知の短縮形のみ補完
}

/** チーム名のNFKC正規化（全角半角・空白・中黒の差を吸収）。マスタ生成と同じ規則。 */
function normTeam(s) {
  return s == null ? s : s.normalize('NFKC').replace(/[ 　]/g, '').replace(/[･•]/g, '・');
}

/** team別名 -> 正準名 のルックアップを構築（キーはNFKC正規化形で照合）。 */
function buildTeamAliasMap() {
  const raw = JSON.parse(fs.readFileSync(ALIAS_FILE, 'utf8'));
  const map = new Map();
  for (const e of raw.teamAliases ?? []) {
    for (const a of e.aliases ?? []) {
      const k = normTeam(a);
      if (map.has(k) && map.get(k) !== e.canonical) {
        throw new Error(`alias table conflict: "${a}" -> ${map.get(k)} / ${e.canonical}`);
      }
      map.set(k, e.canonical);
    }
  }
  return map;
}

function listDetailFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'temp') continue; // 中間生成物は対象外
      out.push(...listDetailFiles(full));
    } else if (ent.isFile() && ent.name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

function normalizeFile(file, teamAliasMap) {
  let text = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(text);
  if (!Array.isArray(data.participants)) return null;

  const teamRepl = new Map(); // oldTeam -> canonical
  const prefRepl = new Map(); // oldPref -> canonical
  const idRepl = []; // { oldId, newId }

  for (const p of data.participants) {
    const newTeam = teamAliasMap.get(normTeam(p.team)) ?? p.team;
    const newPref = canonPref(p.prefecture);
    if (newTeam !== p.team) teamRepl.set(p.team, newTeam);
    if (newPref !== p.prefecture && p.prefecture != null) prefRepl.set(p.prefecture, newPref);
    // normalize-core.js の makeIdFromParts と同じく空要素を除去してから join する
    // （filter なしだとチーム参加者= lastName/firstName が null の id が "__チーム_県" に壊れる）
    const newId = [p.lastName ?? '', p.firstName ?? '', newTeam, newPref ?? '']
      .filter(Boolean)
      .join('_');
    if (p.id && p.id !== newId) idRepl.push({ oldId: p.id, newId });
  }

  if (!teamRepl.size && !prefRepl.size && !idRepl.length) return null;

  let changed = 0;
  const apply = (needle, repl) => {
    const parts = text.split(needle);
    if (parts.length > 1) {
      changed += parts.length - 1;
      text = parts.join(repl);
    }
  };

  // team フィールド値（id 内部の部分文字列には当たらない）
  for (const [oldT, newT] of teamRepl) apply(`"team": "${oldT}"`, `"team": "${newT}"`);
  // prefecture フィールド値（同上）
  for (const [oldP, newP] of prefRepl) apply(`"prefecture": "${oldP}"`, `"prefecture": "${newP}"`);
  // 参加者ID（id フィールド + playerIds 等の配列要素）。
  // 裸の `"${oldId}"` 全文置換は禁止: prefecture 無しのチーム参加者では team/name の
  // フィールド値が oldId と一致し、置換のたびに team フィールドが壊れた id で上書き
  // されて実行回数分アンダースコアが増殖する事故があった（korea-cup 等）。
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const applyId = (oldId, newId) => {
    const o = escapeRegExp(oldId);
    for (const re of [
      new RegExp(`("id"\\s*:\\s*)"${o}"`, 'g'), // "id" フィールド
      new RegExp(`([\\[,]\\s*)"${o}"(?=\\s*[,\\]])`, 'g'), // playerIds / pair 等の配列要素
    ]) {
      const count = (text.match(re) || []).length;
      if (!count) continue;
      text = text.replace(re, (_, prefix) => `${prefix}"${newId}"`);
      changed += count;
    }
  };
  for (const { oldId, newId } of idRepl) applyId(oldId, newId);

  // 検証
  const after = JSON.parse(text);
  const seen = new Map();
  for (const p of after.participants) seen.set(p.id, (seen.get(p.id) ?? 0) + 1);
  const dups = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);

  if (changed && !DRY_RUN) fs.writeFileSync(file, text, 'utf8');
  return changed ? { changed, dups } : null;
}

function main() {
  const teamAliasMap = buildTeamAliasMap();
  const scopeRoot = SCOPE === 'all' ? DETAILS_DIR : path.join(DETAILS_DIR, SCOPE);
  if (!fs.existsSync(scopeRoot)) {
    console.error(`対象が見つかりません: ${path.relative(ROOT, scopeRoot)}`);
    process.exit(1);
  }
  console.log(`対象スコープ: ${SCOPE}`);
  const files = listDetailFiles(scopeRoot);
  let totalFiles = 0;
  let totalChanges = 0;
  const dupWarnings = [];

  for (const file of files) {
    let res;
    try {
      res = normalizeFile(file, teamAliasMap);
    } catch (err) {
      console.error(`ERROR ${path.relative(ROOT, file)}: ${err.message}`);
      process.exitCode = 1;
      continue;
    }
    if (!res) continue;
    totalFiles++;
    totalChanges += res.changed;
    console.log(`${DRY_RUN ? '[dry-run] ' : ''}${path.relative(ROOT, file)}: ${res.changed} 箇所置換`);
    if (res.dups && res.dups.length) dupWarnings.push({ file: path.relative(ROOT, file), dups: res.dups });
  }

  console.log(`\n${DRY_RUN ? '[dry-run] ' : ''}完了: ${totalFiles} ファイル / ${totalChanges} 箇所を置換`);
  if (dupWarnings.length) {
    console.warn('\n⚠ 同一IDへ統合された参加者があります（要確認）:');
    for (const w of dupWarnings) console.warn(`  ${w.file}: ${w.dups.join(', ')}`);
  }
}

main();
