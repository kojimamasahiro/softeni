#!/usr/bin/env node
/**
 * チーム参加者IDのアンダースコア破損を修復する一回限りのクリーンアップスクリプト。
 * 背景: docs/team-id-underscore-bug.md
 *
 * 修復対象の破損パターン:
 *   1. id が "__チーム_県" 形式（normalize-team-names.mjs の filter(Boolean) 欠落による）
 *   2. team フィールド自体が "______JAPAN_JAPAN___" / "______チーム_東京_東京都_東京都_東京都"
 *      のように汚染されているもの（tournament ツールの結合済みラベル混入 + 裸の全文置換の
 *      巻き込みが正規化実行のたびに積み増しされたもの）
 *
 * 復元ロジック（機械的・決定的）:
 *   - 先頭/末尾のアンダースコアを除去し、'_' でトークン分割
 *   - 連続重複トークンを畳み込み（JAPAN_JAPAN → JAPAN）
 *   - 末尾が都道府県正準表記ならそれを prefecture 候補として除去し、
 *     さらにその短縮形（東京 等）が残っていれば除去 → 残りがチーム名
 *   - id は normalize-core.js の makeIdFromParts と同じ
 *     [lastName, firstName, team, prefecture].filter(Boolean).join('_') で再計算
 *   - entries[].playerIds 等の参照も追従（"id" フィールドと配列要素に限定して置換）
 *
 * JSON整形を保つため全体の再シリアライズはせず、対象文字列のみピンポイント置換する。冪等。
 *
 * 使い方:
 *   node scripts/repair-team-participant-ids.mjs --dry-run   # 変更内容の確認
 *   node scripts/repair-team-participant-ids.mjs             # 適用
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DETAILS_DIR = path.join(ROOT, 'data', 'tournaments', 'details');
const DRY_RUN = process.argv.includes('--dry-run');

// 47都道府県 + 北海道 の正準表記と短縮形
const PREFS = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];
const PREF_SET = new Set(PREFS);
const SHORT_OF = new Map(
  PREFS.filter((p) => p !== '北海道').map((p) => [p, p.replace(/[都道府県]$/, '')]),
);

/** normalize-core.js の makeIdFromParts と同一ロジック */
function makeIdFromParts(last, first, team, prefecture) {
  return [last || '', first || '', team || '', prefecture || '']
    .filter(Boolean)
    .join('_');
}

/**
 * 汚染された team 文字列から { team, pref } を復元する。
 * 汚染されていなければそのまま返す（pref: null）。
 */
function recoverTeam(rawTeam) {
  if (!rawTeam || !rawTeam.startsWith('_')) return { team: rawTeam, pref: null };
  const stripped = rawTeam.replace(/^_+/, '').replace(/_+$/, '');
  const tokens = stripped.split('_').filter(Boolean);
  // 連続重複トークンの畳み込み
  const dedup = [];
  for (const t of tokens) if (dedup[dedup.length - 1] !== t) dedup.push(t);
  // 末尾の都道府県トークンを prefecture として分離
  let pref = null;
  if (dedup.length > 1 && PREF_SET.has(dedup[dedup.length - 1])) {
    pref = dedup.pop();
    // その短縮形（東京 / 山形 等）が直前に残っていれば除去
    if (dedup.length > 1 && SHORT_OF.get(pref) === dedup[dedup.length - 1]) dedup.pop();
  }
  return { team: dedup.join('_'), pref };
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

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function repairFile(file) {
  let text = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(text);
  if (!Array.isArray(data.participants)) return null;

  const idRepl = []; // { oldId, newId }
  const teamRepl = new Map(); // 汚染 team -> 復元 team
  const prefFix = []; // { oldTeamRaw, pref } prefecture が null のまま復元された場合（現状は未使用想定）
  const newIds = new Map(); // newId -> oldId（衝突検出）

  for (const p of data.participants) {
    const { team: cleanTeam, pref: recoveredPref } = recoverTeam(p.team);
    const pref = p.prefecture ?? recoveredPref ?? null;
    if (recoveredPref && p.prefecture && recoveredPref !== p.prefecture) {
      throw new Error(
        `${path.relative(ROOT, file)}: 復元した都道府県(${recoveredPref})と既存フィールド(${p.prefecture})が矛盾: ${p.id}`,
      );
    }
    if (recoveredPref && !p.prefecture) prefFix.push({ id: p.id, pref: recoveredPref });
    const newId = makeIdFromParts(p.lastName, p.firstName, cleanTeam, pref);
    if (newIds.has(newId) && newIds.get(newId) !== p.id) {
      throw new Error(
        `${path.relative(ROOT, file)}: 修復後IDが衝突: "${newIds.get(newId)}" と "${p.id}" → "${newId}"（要手動確認）`,
      );
    }
    newIds.set(newId, p.id);
    if (cleanTeam !== p.team) teamRepl.set(p.team, cleanTeam);
    if (p.id !== newId) idRepl.push({ oldId: p.id, newId });
  }

  if (!idRepl.length && !teamRepl.size) return null;

  let changed = 0;
  // team フィールド（汚染値は必ず '_' 始まりで一意なため安全）
  for (const [oldT, newT] of teamRepl) {
    const re = new RegExp(`("team"\\s*:\\s*)"${escapeRegExp(oldT)}"`, 'g');
    const count = (text.match(re) || []).length;
    if (count) {
      text = text.replace(re, (_, prefix) => `${prefix}"${newT}"`);
      changed += count;
    }
  }
  // id フィールドと配列要素（playerIds / pair 等）に限定して置換。
  // 裸の全文置換は team/name フィールドを巻き込む事故の原因だったため禁止。
  for (const { oldId, newId } of idRepl) {
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
  }

  // 検証: パース可能 / 破損IDの残存なし / ID重複なし / playerIds 参照解決 / id 再計算一致
  const after = JSON.parse(text);
  const ids = new Set();
  for (const p of after.participants) {
    if (ids.has(p.id)) throw new Error(`${path.relative(ROOT, file)}: 修復後にID重複: ${p.id}`);
    ids.add(p.id);
    if (p.id.startsWith('_')) throw new Error(`${path.relative(ROOT, file)}: 破損IDが残存: ${p.id}`);
    if (p.team && p.team.startsWith('_'))
      throw new Error(`${path.relative(ROOT, file)}: 破損teamが残存: ${p.team}`);
    const expect = makeIdFromParts(p.lastName, p.firstName, p.team, p.prefecture);
    if (p.id !== expect)
      throw new Error(`${path.relative(ROOT, file)}: idがフィールド再構成と不一致: ${p.id} ≠ ${expect}`);
  }
  for (const e of after.entries ?? []) {
    for (const pid of e.playerIds ?? []) {
      if (!ids.has(pid))
        throw new Error(`${path.relative(ROOT, file)}: playerIds が未解決: ${pid}`);
    }
  }

  if (!DRY_RUN) fs.writeFileSync(file, text, 'utf8');
  return { changed, idRepl, teamRepl };
}

function main() {
  const files = listDetailFiles(DETAILS_DIR);
  let totalFiles = 0;
  let totalChanges = 0;

  for (const file of files) {
    let res;
    try {
      res = repairFile(file);
    } catch (err) {
      console.error(`ERROR ${path.relative(ROOT, file)}: ${err.message}`);
      process.exitCode = 1;
      continue;
    }
    if (!res) continue;
    totalFiles++;
    totalChanges += res.changed;
    console.log(`${DRY_RUN ? '[dry-run] ' : ''}${path.relative(ROOT, file)}: ${res.changed} 箇所置換`);
    for (const [oldT, newT] of res.teamRepl) console.log(`  team: "${oldT}" -> "${newT}"`);
    for (const { oldId, newId } of res.idRepl.slice(0, 5))
      console.log(`  id:   "${oldId}" -> "${newId}"`);
    if (res.idRepl.length > 5) console.log(`  id:   ...他 ${res.idRepl.length - 5} 件`);
  }

  console.log(`\n${DRY_RUN ? '[dry-run] ' : ''}完了: ${totalFiles} ファイル / ${totalChanges} 箇所を置換`);
}

main();
