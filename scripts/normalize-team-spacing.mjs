// チーム名の機械的な揺れ（全角半角・スペース・中黒記号）を大会データ本体で正準化する。
// NFKC正規化で同一になる生文字列を、最頻出の表記へ寄せる（人手判断不要・冪等）。
// 例: 「one team」/「oneteam」、「Up Rise」/「UpRise」、「ＵＢＥ」/「UBE」 を1つに統一。
// 対象: participants[].team / participants[].id / entries[].playerIds（normalize-team-names と同方式）。
// 使い方: node scripts/normalize-team-spacing.mjs [--dry-run]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DETAILS = path.join(ROOT, 'data', 'tournaments', 'details');
const DRY = process.argv.includes('--dry-run');

const nfkc = (s) => (s == null ? s : s.normalize('NFKC').replace(/[ 　]/g, '').replace(/[･•]/g, '・'));

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? (e.name === 'temp' ? [] : walk(p)) : (e.name.endsWith('.json') ? [p] : []);
});
const files = walk(DETAILS);

// 1パス目: NFKCキー -> 生表記の出現数
const groups = new Map();
for (const f of files) {
  let d; try { d = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
  for (const p of d.participants || []) {
    if (!p.team) continue;
    const k = nfkc(p.team);
    let c = groups.get(k); if (!c) groups.set(k, (c = new Map()));
    c.set(p.team, (c.get(p.team) || 0) + 1);
  }
}
// 各グループの正準（最頻出→同数は文字列昇順で決定的）
const canon = new Map(); // 生表記 -> 正準表記
for (const [, c] of groups) {
  if (c.size < 2) continue;
  const best = [...c.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
  for (const raw of c.keys()) if (raw !== best) canon.set(raw, best);
}
console.log(`正準化対象の生表記: ${canon.size} 種`);

// 2パス目: 置換
let totalFiles = 0, totalChanges = 0;
for (const f of files) {
  let text = fs.readFileSync(f, 'utf8');
  let data; try { data = JSON.parse(text); } catch { continue; }
  if (!Array.isArray(data.participants)) continue;
  const teamRepl = new Map(); const idRepl = [];
  for (const p of data.participants) {
    const nt = canon.get(p.team);
    if (!nt) continue;
    teamRepl.set(p.team, nt);
    // normalize-core.js の makeIdFromParts と同じく空要素を filter(Boolean) で除去してから join
    // （filter なしだとチーム参加者= lastName/firstName が null の正しい id と一致せず更新が漏れる）
    const oldId = [p.lastName ?? '', p.firstName ?? '', p.team ?? '', p.prefecture ?? ''].filter(Boolean).join('_');
    if (p.id && p.id === oldId) {
      const newId = [p.lastName ?? '', p.firstName ?? '', nt, p.prefecture ?? ''].filter(Boolean).join('_');
      if (newId !== p.id) idRepl.push({ oldId: p.id, newId });
    }
  }
  if (!teamRepl.size && !idRepl.length) continue;
  let changed = 0;
  const apply = (needle, repl) => { const parts = text.split(needle); if (parts.length > 1) { changed += parts.length - 1; text = parts.join(repl); } };
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // "team" とコロンの間・コロンと値の間の空白（半角/全角/改行）はファイルごとに
  // 圧縮形式（"team":"x"）と整形形式（"team": "x"）が混在するため、区切りを
  // キャプチャして温存しつつ値だけ置換する（フォーマット崩れによる巨大diffを防ぐ）。
  const applyTeamField = (o, n) => {
    const pattern = `("team"\\s*:\\s*)"${escapeRegExp(o)}"`;
    const count = (text.match(new RegExp(pattern, 'g')) || []).length;
    if (!count) return;
    text = text.replace(new RegExp(pattern, 'g'), (_, prefix) => `${prefix}"${n}"`);
    changed += count;
  };
  for (const [o, n] of teamRepl) applyTeamField(o, n);
  // 参加者ID置換は "id" フィールドと配列要素（playerIds / pair 等）に限定する。
  // 裸の `"${oldId}"` 全文置換は team/name フィールド値が oldId と一致した場合に巻き込むため禁止。
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
  if (changed) {
    totalFiles++; totalChanges += changed;
    if (!DRY) fs.writeFileSync(f, text, 'utf8');
  }
}
console.log(`${DRY ? '[dry-run] ' : ''}完了: ${totalFiles} ファイル / ${totalChanges} 箇所を置換`);
