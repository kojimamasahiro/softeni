#!/usr/bin/env node
/**
 * 一回限りのデータ修復スクリプト。
 *
 * data/tournaments/details/zennihon-secondaryschool-versus/2024/doubles-none-girls.json の
 * エントリー114（土浦クラブ・茨城県）は、**ペアの2人の氏名の境目**がずれていた:
 *
 *   林楓 | 恋荒  ＋  川 | 琴美      （誤）
 *   林   | 楓恋  ＋  荒川 | 琴美    （正）
 *
 * 「林楓恋・荒川琴美」の連結文字列を1文字ずらして切ったもの。姓名の分割ゆれ
 * （data/players/name-split-aliases.json）は「連結後の氏名は正しく、切り位置だけが違う」
 * 前提なので、この型は表では表現できない（連結後の文字列そのものが人ごとに違う）。
 *
 * 副作用として、この壊れたレコードは `林楓` を実在の姓として辞書に登録してしまい、
 * scripts/check-name-splits.mjs の辞書照合が正しい `林|楓恋` を「別解 林楓|恋 姓1人」として
 * 疑う原因になっていた。**壊れたデータが自分の誤りの裏づけを作る**型なので、
 * 辞書照合の結果を見るときは裏づけ件数が 1 の別解を疑うこと。
 *
 *   node scripts/fix-versus-2024-name-boundary.mjs --dry-run
 *   node scripts/fix-versus-2024-name-boundary.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'data/tournaments/details/zennihon-secondaryschool-versus/2024/doubles-none-girls.json');
const DRY_RUN = process.argv.includes('--dry-run');

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 現 id をアンカーに、氏名フィールドと id を差し替える
const fixes = [
  { oldId: '林楓_恋荒_土浦クラブ_茨城県', lastName: '林', firstName: '楓恋', newId: '林_楓恋_土浦クラブ_茨城県' },
  { oldId: '川_琴美_土浦クラブ_茨城県', lastName: '荒川', firstName: '琴美', newId: '荒川_琴美_土浦クラブ_茨城県' },
];

function main() {
  let text = fs.readFileSync(FILE, 'utf8');
  const before = JSON.parse(text);
  let changed = 0;

  for (const f of fixes) {
    const target = before.participants.find((p) => p.id === f.oldId);
    if (!target) {
      console.log(`  ${f.oldId} は見つからなかった（適用済み？）`);
      continue;
    }
    // 参加者ブロック: id をアンカーにして、続く lastName / firstName ごと置換する
    const block = new RegExp(
      `("id"\\s*:\\s*)"${escapeRegExp(f.oldId)}"(\\s*,\\s*"lastName"\\s*:\\s*)"${escapeRegExp(target.lastName)}"(\\s*,\\s*"firstName"\\s*:\\s*)"${escapeRegExp(target.firstName)}"`,
      'g',
    );
    const n = (text.match(block) || []).length;
    if (n !== 1) throw new Error(`${f.oldId}: 参加者ブロックが ${n} 件（1件のはず）`);
    text = text.replace(block, (_, a, b, c) => `${a}"${f.newId}"${b}"${f.lastName}"${c}"${f.firstName}"`);
    changed += n;

    // playerIds / pair 等の配列要素（裸の全文置換はしない。normalize-team-names.mjs と同じ方針）
    const ref = new RegExp(`([\\[,]\\s*)"${escapeRegExp(f.oldId)}"(?=\\s*[,\\]])`, 'g');
    const m = (text.match(ref) || []).length;
    if (m) {
      text = text.replace(ref, (_, prefix) => `${prefix}"${f.newId}"`);
      changed += m;
    }
    console.log(`  ${f.oldId} -> ${f.newId}（参加者1 + 参照${m}）`);
  }

  if (!changed) {
    console.log('変更なし');
    return;
  }

  // 検証: 再パースできること・id が重複しないこと・参照切れが無いこと
  const after = JSON.parse(text);
  const ids = new Set();
  for (const p of after.participants) {
    if (ids.has(p.id)) throw new Error(`id が重複した: ${p.id}`);
    ids.add(p.id);
  }
  for (const e of after.entries ?? []) {
    for (const pid of e.playerIds ?? []) {
      if (!ids.has(pid)) throw new Error(`参照切れ: ${pid}`);
    }
  }

  if (!DRY_RUN) fs.writeFileSync(FILE, text, 'utf8');
  console.log(`${DRY_RUN ? '[dry-run] ' : ''}${changed} 箇所を書き換え`);
}

main();
