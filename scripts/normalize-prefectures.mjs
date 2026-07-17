#!/usr/bin/env node
/**
 * 大会結果データ（data/tournaments/details）の都道府県の表記揺れを正準化する。
 *
 * 正規化の段階:
 *   Tier A（機械的・安全）:
 *     - NFKC ＋ 空白除去、区切り文字 • → ・
 *     - 接尾辞欠落の短縮形（例: 東京→東京都 / 愛知→愛知県）
 *     - 地域接頭辞つき（例: 関東・埼玉県 / 近畿・大阪府 / 開催地・北海道 / 信越・新潟県）
 *       → 区切りで割って末尾の県名を採用し再帰的に正準化
 *     - 外国名に県が誤付与（例: 韓国県→韓国 / 中華台北県→中華台北）→ 県を外し値として保持
 *   Tier B（崩れ・誤字。明示マップで一意復元）:
 *     - 先頭欠落（奈川県→神奈川県 等）、異体字/OCR（德島県→徳島県、愛緩県→愛媛県 等）
 *   保持（都道府県でない区分。表記だけ整える）:
 *     - 連盟名（日本学連 / 学連 / 高体連 / 中体連 / 日本連盟）。
 *       誤付与の県だけ外す（日本連盟県→日本連盟）が、別の都道府県扱いの値として残す。
 *
 * 対象: participants[].prefecture と、それを含む participants[].id（`姓_名_team_都道府県`）
 *       および entries[].playerIds の参照。id を再計算し参照も張り替える。
 *       team フィールドには触れない（チーム名寄せは normalize-team-names.mjs の管轄）。
 *
 * 重要: JSON 全体を再シリアライズせず、元テキストへピンポイント置換して整形を保つ。冪等。
 *
 * 使い方:
 *   node scripts/normalize-prefectures.mjs --dry-run   # 既定で全スコープ
 *   node scripts/normalize-prefectures.mjs             # 適用
 *   node scripts/normalize-prefectures.mjs --scope=highschool-championship
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DETAILS_DIR = path.join(ROOT, 'data', 'tournaments', 'details');

const DRY_RUN = process.argv.includes('--dry-run');
const SCOPE_ARG = process.argv.find((a) => a.startsWith('--scope='));
const SCOPE = SCOPE_ARG ? SCOPE_ARG.slice('--scope='.length) : 'all';

// 47都道府県の正準表記
const CANON = new Set(
  ['北海道', '東京都', '大阪府', '京都府'].concat(
    (
      '青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 神奈川 新潟 富山 石川 福井 ' +
      '山梨 長野 岐阜 静岡 愛知 三重 滋賀 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 ' +
      '香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄'
    )
      .split(/\s+/)
      .map((k) => k + '県'),
  ),
);

// 接尾辞欠落の短縮形 -> 正準
const SUFFIX = new Map();
for (const k of '青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 神奈川 新潟 富山 石川 福井 山梨 長野 岐阜 静岡 愛知 三重 滋賀 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄'.split(
  /\s+/,
)) {
  SUFFIX.set(k, k + '県');
}
SUFFIX.set('東京', '東京都');
SUFFIX.set('大阪', '大阪府');
SUFFIX.set('京都', '京都府');
SUFFIX.set('北海道', '北海道');

// 地域接頭辞（X・都道府県 の X 部分）
const REGIONS = new Set([
  '北海道', '東北', '関東', '北信越', '信越', '東海', '近畿', '中国', '四国', '九州',
  '開催地', '催地',
]);

// 外国名（誤付与の県を外して値として保持）
const COUNTRIES = new Set(['韓国', '台湾', '中華台北', 'モンゴル']);

// 連盟など都道府県でない区分（表記だけ整え、別の都道府県扱いの値として保持）
const FEDERATION_KEEP = new Set([
  '日本学連', '学連', '高体連', '中体連', '日本連盟', 'フリー',
]);
// 誤付与の県を外すマップ（学連県→学連 等）は FEDERATION_KEEP から機械的に導出する。
// 個別エントリの列挙だと漏れる（実際に 学連県 が漏れて east-japan/2026 の汚染を
// 救えなかった）ため、保持集合と常に同期させる。
const FEDERATIONS = new Map(
  [...FEDERATION_KEEP].map((k) => [k + '県', k]),
);

// Tier B: 崩れ・誤字の明示マップ（一意に復元できるもの）
const CORRECTIONS = new Map([
  ['奈川県', '神奈川県'],
  ['歌山県', '和歌山県'],
  ['児島県', '鹿児島県'],
  ['海道', '北海道'],
  ['北海道・北海道', '北海道'],
  ['德島県', '徳島県'], // 異体字 德→徳
  ['愛緩県', '愛媛県'], // OCR 緩→媛
  ['愛緩県', '愛媛県'],
  ['和獣山県', '和歌山県'], // OCR 獣→歌
  ['沖県', '沖縄県'],
  ['伊勢県', '三重県'], // 伊勢は三重県
  ['熊', '熊本県'],
]);

/** 都道府県/区分を正準表記へ。未解決はそのまま返す（呼び出し側で記録）。 */
export function canonPref(raw) {
  if (raw == null) return raw;
  let s = raw.normalize('NFKC').replace(/[\s　]/g, '').replace(/[•･]/g, '・');
  if (s === '') return raw;

  // 連盟など保持対象
  if (FEDERATIONS.has(s)) return FEDERATIONS.get(s);
  if (FEDERATION_KEEP.has(s)) return s;

  // 地域接頭辞つき: X・<県> → <県> を再帰正準化
  if (s.includes('・')) {
    const parts = s.split('・').filter(Boolean);
    if (parts.length >= 2 && REGIONS.has(parts[0])) {
      const tail = parts.slice(1).join('・');
      const c = canonPref(tail);
      if (c !== tail || CANON.has(c)) return c;
      return c;
    }
    // 重複（北海道・北海道 等）は CORRECTIONS で処理済み。残りは明示マップへ。
  }

  // Tier B 明示マップ
  if (CORRECTIONS.has(s)) return CORRECTIONS.get(s);

  // 既に正準
  if (CANON.has(s)) return s;

  // 外国名 + 県 の誤付与
  if (s.endsWith('県')) {
    const base = s.slice(0, -1);
    if (COUNTRIES.has(base)) return base;
  }
  if (COUNTRIES.has(s)) return s;

  // 接尾辞欠落の短縮形
  if (SUFFIX.has(s)) return SUFFIX.get(s);

  // 未解決
  return s === raw ? raw : s; // NFKC 等の正規化分だけは反映
}

function listDetailFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'temp') continue;
      out.push(...listDetailFiles(full));
    } else if (ent.isFile() && ent.name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

const UNRESOLVED = new Map(); // 未解決値 -> 件数

function normalizeFile(file) {
  let text = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(text);
  if (!Array.isArray(data.participants)) return null;

  const prefRepl = new Map(); // oldPref -> newPref
  const idRepl = []; // { oldId, newId }

  for (const p of data.participants) {
    if (p.prefecture == null) continue;
    const newPref = canonPref(p.prefecture);
    if (newPref !== p.prefecture) prefRepl.set(p.prefecture, newPref);

    // 未解決チェック（正準でも連盟でも外国でもない値を記録）
    if (
      newPref != null &&
      !CANON.has(newPref) &&
      !FEDERATION_KEEP.has(newPref) &&
      !COUNTRIES.has(newPref)
    ) {
      UNRESOLVED.set(newPref, (UNRESOLVED.get(newPref) ?? 0) + 1);
    }

    // id は team を保ったまま pref 部分だけ追従。元 id がフィールド再構成と一致する時のみ張替（崩れ id は触らない）。
    // normalize-core.js の makeIdFromParts と同じく空要素を除去してから join する
    // （filter なしだとチーム参加者= lastName/firstName が null の期待値が "__チーム_県" になり、
    //  正しい id "チーム_県" と一致せず id 更新が漏れて prefecture フィールドと乖離する）。
    const expectOld = [p.lastName ?? '', p.firstName ?? '', p.team ?? '', p.prefecture ?? '']
      .filter(Boolean)
      .join('_');
    if (p.id && p.id === expectOld) {
      const newId = [p.lastName ?? '', p.firstName ?? '', p.team ?? '', newPref ?? '']
        .filter(Boolean)
        .join('_');
      if (newId !== p.id) idRepl.push({ oldId: p.id, newId });
    }
  }

  if (!prefRepl.size && !idRepl.length) return null;

  let changed = 0;
  // フィールド置換はコロン前後の空白差（"prefecture": "X" / "prefecture":"X"）を許容する。
  // 固定文字列 `"prefecture": "` での置換だとコンパクト整形のファイルにマッチせず
  // 置換漏れが起きるため正規表現で行う。
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const apply = (field, oldV, newV) => {
    const re = new RegExp(`("${field}"\\s*:\\s*)"${escapeRegExp(oldV)}"`, 'g');
    const count = (text.match(re) || []).length;
    if (!count) return;
    changed += count;
    text = text.replace(re, (_, prefix) => `${prefix}"${newV}"`);
  };

  for (const [oldP, newP] of prefRepl) apply('prefecture', oldP, newP);
  // 参加者ID置換は "id" フィールドと配列要素（playerIds / pair 等）に限定する。
  // 裸の `"${oldId}"` 全文置換は、prefecture が空のチーム参加者で team/name フィールド値が
  // oldId と一致した場合に team フィールドまで巻き込んで破壊するため禁止。
  const applyId = (oldId, newId) => {
    const o = escapeRegExp(oldId);
    for (const re of [
      new RegExp(`("id"\\s*:\\s*)"${o}"`, 'g'),
      new RegExp(`([\\[,]\\s*)"${o}"(?=\\s*[,\\]])`, 'g'),
    ]) {
      const count = (text.match(re) || []).length;
      if (!count) continue;
      text = text.replace(re, (_, prefix) => `${prefix}"${newId}"`);
      changed += count;
    }
  };
  for (const { oldId, newId } of idRepl) applyId(oldId, newId);

  // 検証: id 重複が生まれていないか
  const after = JSON.parse(text);
  const seen = new Map();
  for (const p of after.participants) seen.set(p.id, (seen.get(p.id) ?? 0) + 1);
  const dups = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);

  if (changed && !DRY_RUN) fs.writeFileSync(file, text, 'utf8');
  return changed ? { changed, dups } : null;
}

function main() {
  const scopeRoot = SCOPE === 'all' ? DETAILS_DIR : path.join(DETAILS_DIR, SCOPE);
  if (!fs.existsSync(scopeRoot)) {
    console.error(`対象が見つかりません: ${path.relative(ROOT, scopeRoot)}`);
    process.exit(1);
  }
  console.log(`対象スコープ: ${SCOPE}${DRY_RUN ? '（dry-run）' : ''}`);
  const files = listDetailFiles(scopeRoot);
  let totalFiles = 0;
  let totalChanges = 0;
  const dupWarnings = [];

  for (const file of files) {
    let res;
    try {
      res = normalizeFile(file);
    } catch (err) {
      console.error(`ERROR ${path.relative(ROOT, file)}: ${err.message}`);
      process.exitCode = 1;
      continue;
    }
    if (!res) continue;
    totalFiles++;
    totalChanges += res.changed;
    if (res.dups && res.dups.length) dupWarnings.push({ file: path.relative(ROOT, file), dups: res.dups });
  }

  console.log(`\n${DRY_RUN ? '[dry-run] ' : ''}完了: ${totalFiles} ファイル / ${totalChanges} 箇所を置換`);

  if (UNRESOLVED.size) {
    console.warn('\n⚠ 未解決（正準・連盟・外国 のいずれにも該当しない値。要確認）:');
    for (const [v, n] of [...UNRESOLVED.entries()].sort((a, b) => b[1] - a[1])) {
      console.warn(`  ${n}件  ${JSON.stringify(v)}`);
    }
  }
  if (dupWarnings.length) {
    console.warn('\n⚠ 同一IDへ統合された参加者があります（要確認）:');
    for (const w of dupWarnings) console.warn(`  ${w.file}: ${w.dups.join(', ')}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
