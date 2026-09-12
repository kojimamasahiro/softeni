#!/usr/bin/env node
// team-grouping.mjs の既定グループ分けの回帰テスト。
//
// 中身は**人が実際に下した判断**（2026-09-12 の抜き取り点検20件）をそのまま固定したもの。
// 機械だけで決めた統合49件から20件を無作為抽出して人が点検し、誤統合が11件（55%）あった。
// 同じ誤りに戻らないよう、その20件の結論をテストにしてある。
//
// 実行: node scripts/lib/team-grouping.test.mjs
import { defaultGroups, machineVerdict, level } from './team-grouping.mjs';

let pass = 0;
const failed = [];
const check = (name, cond, detail = '') => {
  if (cond) {
    pass++;
    console.log(`OK  : ${name}`);
  } else {
    failed.push(`${name}${detail ? ' — ' + detail : ''}`);
    console.log(`FAIL: ${name}${detail ? ' — ' + detail : ''}`);
  }
};

/** context は id → { genres } だけ使う。テストでは名前の並び順を id に見立てる。 */
function run(members, genres = {}) {
  const ms = members.map((name, i) => ({ id: i, name }));
  const ctx = {};
  ms.forEach((m, i) => (ctx[i] = { genres: genres[m.name] ?? [] }));
  return { verdict: machineVerdict({ members: ms }, ctx), groups: defaultGroups(ms, ctx) };
}

console.log('--- 名前から読める段階 ---');
check('中学校はS:中', level('三春中学校') === '中');
check('高校はS:高', level('洲本高等学校') === '高');
check('スポ少はS:小', level('東出雲スポ少') === '小');
check('ジュニアはS:小', level('七尾ジュニアクラブ') === '小');
check('STCはS:ク', level('仙北STC') === 'ク');
check('素の地名は判定しない', level('綾瀬') === null);

console.log('\n--- 人の判断: 別チーム（統合してはいけない） ---');
// 「学校」とクラブは別。出場大会のジャンルが中学だけでも、名前がクラブなら別扱いにする。
check('三春STC / 三春中学校', run(['三春STC', '三春中学校'], { 三春STC: ['中', '成'] }).verdict === 'separate');
check('東出雲スポ少 / 東出雲中学校', run(['東出雲スポ少', '東出雲中学校'], { 東出雲スポ少: ['小'] }).verdict === 'separate');
check('七尾ジュニアクラブ / 七尾中学校', run(['七尾ジュニアクラブ', '七尾中学校'], { 七尾ジュニアクラブ: ['小', '中'] }).verdict === 'separate');
check('丸岡中学校 / 丸岡クラブ', run(['丸岡中学校', '丸岡クラブ']).verdict === 'separate');
check('今市ジュニア / 今市中学校', run(['今市ジュニア', '今市中学校']).verdict === 'separate');
check('南関ジュニア / 南関中学校', run(['南関ジュニア', '南関中学校']).verdict === 'separate');
check('杉戸中学校 / 杉戸ジュニアスポ少', run(['杉戸中学校', '杉戸ジュニアスポ少']).verdict === 'separate');
check('清武ジュニア / 清武中学校', run(['清武ジュニア', '清武中学校']).verdict === 'separate');
check('甲賀中学校 / 甲賀スポ少', run(['甲賀中学校', '甲賀スポ少']).verdict === 'separate');
// 小・中・高は同時に発生しない
check('敦賀スポーツ少年団 / 敦賀高校（小と高）', run(['敦賀スポーツ少年団', '敦賀高校']).verdict === 'separate');
check('松平 / 松平中学校（素の地名と中学校）', run(['松平', '松平中学校'], { 松平: ['高', '中'] }).verdict === 'separate');
check('綾瀬 / 綾瀬テニスクラブ', run(['綾瀬', '綾瀬テニスクラブ'], { 綾瀬: ['中', '成'] }).verdict === 'separate');
check('飛騨高山 / 飛騨高山クラブ', run(['飛騨高山', '飛騨高山クラブ'], { 飛騨高山: ['高', '成'] }).verdict === 'separate');
check('南方JST / 南方', run(['南方JST', '南方'], { 南方JST: ['小', '中'] }).verdict === 'separate');
check('洲本 / 洲本ジュニアクラブ / 洲本高等学校', run(['洲本', '洲本ジュニアクラブ', '洲本高等学校'], { 洲本: ['高', '成'], 洲本ジュニアクラブ: ['小'] }).verdict === 'separate');

console.log('\n--- 人の判断: 同一（統合してよい） ---');
// 正式名称と略称。段階が一致していれば名前の長短は問わない。
check('長岡商業 / 長岡商業高校', run(['長岡商業', '長岡商業高校'], { 長岡商業: ['高'] }).verdict === 'merge');
check('防府商工 / 防府商工高校', run(['防府商工', '防府商工高校'], { 防府商工: ['高'] }).verdict === 'merge');
check('式下中 / 式下中学校', run(['式下中', '式下中学校'], { 式下中: ['中'] }).verdict === 'merge');
check('木脇 / 木脇中学校', run(['木脇', '木脇中学校'], { 木脇: ['中'] }).verdict === 'merge');

console.log('\n--- 段階が読めない者どうしは、まとめない（人に回す） ---');
check('素の地名2つは別グループ', JSON.stringify(run(['沼田', '南方']).groups) === JSON.stringify([0, 1]));

const total = pass + failed.length;
console.log(`\n${pass}/${total} passed`);
if (failed.length) {
  console.log('失敗:');
  for (const f of failed) console.log('  - ' + f);
  process.exit(1);
}
