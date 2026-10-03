#!/usr/bin/env node
/**
 * 一回限りのデータ修復スクリプト。
 *
 * data/tournaments/details/highschool-japan-cup/2021/doubles-none-{boys,girls}.json の
 * ダブルスは、記録PDF（ドロー）が「姓・姓（県：学校）」しか載せていないため、
 * 名が取れなかった 13 名が `姓_学校_県` の3区切り id で入っていた。うち3名は列がずれて
 * 学校名が firstName、県名が team に入っていた:
 *   - 田渕_北海道_北海道 / 加藤_北海道_北海道（実際は 旭川実業）
 *   - 佐々木_高松商業_香川県_香川県（firstName=高松商業, team=香川県）
 * 3区切り id は高校パイプライン（03list/summary.py が id の [2] を学校とみなす）で
 * 県名を学校として数えさせ、scripts/highschool/01team/teams.json に架空校
 * hokkaidou(北海道) / kagawaken(香川県) を生んでいた。
 *
 * 氏名・学校の一次情報: ゴーセン公式「2021年 ハイスクールジャパンカップ 参加選手一覧」
 *   http://www.gosen-sp.jp/hjs/participant/ （Wayback 20210802100355）
 * 学校はドロー PDF（http://www.gosen-sp.jp/hjs/result/up_img/1622093391-476838_{1,2}.pdf）とも一致。
 *
 * team は PDF の表記で入れ、正準形（旭川実業→旭川実 等）への寄せは後段の
 * scripts/normalize-team-names.mjs（既定スコープ highschool-japan-cup）に任せる。
 * 整形を壊さないようテキストへピンポイント置換する（id は matches/results の参照ごと置換）。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'data/tournaments/details/highschool-japan-cup/2021');
const DRY_RUN = process.argv.includes('--dry-run');

// oldId → 正しい { lastName, firstName, team, prefecture }
const FIXES = {
  'doubles-none-boys.json': {
    原田_伊勢工業_三重県: ['原田', '諒太', '伊勢工業', '三重県'],
    加藤_伊勢工業_三重県: ['加藤', '聖奈', '伊勢工業', '三重県'],
    田渕_北海道_北海道: ['田渕', '直', '旭川実業', '北海道'],
    加藤_北海道_北海道: ['加藤', '匠吾', '旭川実業', '北海道'],
  },
  'doubles-none-girls.json': {
    植松_済美_愛媛県: ['植松', 'こころ', '済美', '愛媛県'],
    西田_済美_愛媛県: ['西田', '美織', '済美', '愛媛県'],
    安楽_滝川_北海道: ['安楽', '未渉', '滝川', '北海道'],
    石黒_滝川_北海道: ['石黒', '茉子', '滝川', '北海道'],
    下山_札幌龍谷学園_北海道: ['下山', '佳那琉', '札幌龍谷学園', '北海道'],
    本多_旭川東_北海道: ['本多', '桃子', '旭川東', '北海道'],
    川村_旭川東_北海道: ['川村', '未来', '旭川東', '北海道'],
    佐々木_高松商業_香川県_香川県: ['佐々木', '安葉', '高松商業', '香川県'],
    後藤_松阪_三重県: ['後藤', '紗和', '松阪', '三重県'],
    野村_松阪_三重県: ['野村', '遥', '松阪', '三重県'],
  },
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let failed = false;
for (const [file, fixes] of Object.entries(FIXES)) {
  const p = path.join(DIR, file);
  let text = fs.readFileSync(p, 'utf8');
  for (const [oldId, [lastName, firstName, team, prefecture]] of Object.entries(fixes)) {
    const newId = `${lastName}_${firstName}_${team}_${prefecture}`;
    const recRe = new RegExp(`\\{"id":"${escapeRegex(oldId)}"[^}]*\\}`);
    if (!recRe.test(text)) {
      console.error(`✗ ${file}: 参加者 ${oldId} が見つからない（適用済み？）`);
      failed = true;
      continue;
    }
    const rec = JSON.stringify({ id: newId, lastName, firstName, team, prefecture });
    text = text.replace(recRe, rec);
    const refs = text.split(`"${oldId}"`).length - 1;
    text = text.split(`"${oldId}"`).join(`"${newId}"`);
    console.log(`${file}: ${oldId} → ${newId}（参照 ${refs} 件）`);
  }
  JSON.parse(text);
  if (!DRY_RUN) fs.writeFileSync(p, text);
}
if (DRY_RUN) console.log('(dry-run: 書き込みなし)');
process.exit(failed ? 1 : 0);
