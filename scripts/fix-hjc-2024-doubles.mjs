#!/usr/bin/env node
/**
 * 一回限りのデータ修復スクリプト。
 *
 * data/tournaments/details/highschool-japan-cup/2024/doubles-none-boys.json には、
 * 隣接する和歌山勢（和歌山北など）の氏名・県名が混入したと見られる破損があり、
 * 参加者レコードの氏名/県名の取り違え・id 不整合、および 3 件の playerIds 参照切れが生じていた。
 *
 * 学校の所在県は一意に確定できる（向陽=和歌山, 明徳義塾=高知, 東福岡=福岡, 米子松蔭=鳥取, 長崎日大=長崎）。
 * 氏名は大会ドロー（entries の playerIds）を一次情報として採用した:
 *   - 下田: id が 下田_隼輝 になっていたが氏名フィールドは 悠貴 → 悠貴 を採用
 *   - 山下: 参加者は 來空(和歌山北の選手名が混入) だがドローは 将毅 → 将毅 を採用
 *           （丸田・山下ペア＝長崎日大 は実在を確認）
 *
 * 県名はこの段階では接尾辞なしの短縮形で統一し、接尾辞（県）の付与は
 * 後段の scripts/normalize-team-names.mjs に任せる。整形を壊さないようテキストへピンポイント置換する。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'data/tournaments/details/highschool-japan-cup/2024/doubles-none-boys.json');
const DRY_RUN = process.argv.includes('--dry-run');

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 参加者オブジェクト単位の修正: 現 id をアンカーに firstName / prefecture / id を書き換える
const participantFixes = [
  { cur: '照屋_盛也_向陽_沖縄', firstName: '盛也', prefecture: '和歌山', newId: '照屋_盛也_向陽_和歌山' },
  { cur: '渡邉_波輝_向陽_沖縄', firstName: '波輝', prefecture: '和歌山', newId: '渡邉_波輝_向陽_和歌山' },
  { cur: '加藤_歓基_明徳義塾_北海道', firstName: '歓基', prefecture: '高知', newId: '加藤_歓基_明徳義塾_高知' },
  { cur: '伊藤_駿平_東福岡_秋田', firstName: '駿平', prefecture: '福岡', newId: '伊藤_駿平_東福岡_福岡' },
  { cur: '下田_隼輝_米子松蔭_和歌山', firstName: '悠貴', prefecture: '鳥取', newId: '下田_悠貴_米子松蔭_鳥取' },
  { cur: '山下_來空_長崎日大_和歌山', firstName: '将毅', prefecture: '長崎', newId: '山下_将毅_長崎日大_長崎' },
];

// entries[].playerIds の参照を正しい id へ張り替える（完全一致, 参加者ブロック書き換え後に実行）。
// 氏名・県名を直した参加者がエントリーから参照されている場合は、旧 id -> 新 id をここで揃える。
const playerIdFixes = [
  // 県名を直した参加者（エントリーからも参照されている）
  { from: '照屋_盛也_向陽_沖縄', to: '照屋_盛也_向陽_和歌山' },
  { from: '渡邉_波輝_向陽_沖縄', to: '渡邉_波輝_向陽_和歌山' },
  { from: '加藤_歓基_明徳義塾_北海道', to: '加藤_歓基_明徳義塾_高知' },
  { from: '伊藤_駿平_東福岡_秋田', to: '伊藤_駿平_東福岡_福岡' },
  // 参照切れだったペア相手（参加者は別 id / 氏名で存在していた）
  { from: '下田_悠貴_米子松蔭_和歌山', to: '下田_悠貴_米子松蔭_鳥取' },
  { from: '小杉_優太_京都文教_北海道', to: '小杉_優太_京都文教_京都' },
];

function main() {
  let text = fs.readFileSync(FILE, 'utf8');
  let changed = 0;

  for (const fx of participantFixes) {
    const re = new RegExp(
      '(\\{\\s*"id": ")' + escapeRegex(fx.cur) +
      '(",\\s*"lastName": "[^"]*",\\s*"firstName": ")[^"]*(",\\s*"team": "[^"]*",\\s*"prefecture": ")[^"]*("\\s*\\})',
    );
    const before = text;
    text = text.replace(re, (m, g1, g2, g3, g4) => g1 + fx.newId + g2 + fx.firstName + g3 + fx.prefecture + g4);
    if (text === before) {
      console.error(`WARN: 参加者が見つかりません: ${fx.cur}`);
    } else {
      changed++;
    }
  }

  for (const fx of playerIdFixes) {
    const parts = text.split(`"${fx.from}"`);
    if (parts.length > 1) {
      changed += parts.length - 1;
      text = parts.join(`"${fx.to}"`);
    } else {
      console.error(`WARN: playerIds 参照が見つかりません: ${fx.from}`);
    }
  }

  // 検証: JSON 妥当性 + 参照切れ 0 + id 重複なし
  const d = JSON.parse(text);
  const ids = new Set(d.participants.map((p) => p.id));
  const dangling = [...new Set(d.entries.flatMap((e) => e.playerIds).filter((x) => !ids.has(x)))];
  const idDup = d.participants.length !== ids.size;
  const mism = d.participants.filter(
    (p) => p.id !== `${p.lastName ?? ''}_${p.firstName ?? ''}_${p.team ?? ''}_${p.prefecture ?? ''}`,
  );

  console.log(`${DRY_RUN ? '[dry-run] ' : ''}置換: ${changed} 箇所`);
  console.log(`検証 -> dangling: ${dangling.length}, id重複: ${idDup}, id/氏名不整合: ${mism.length}`);
  if (dangling.length) console.log('  残dangling:', dangling);
  if (mism.length) console.log('  残不整合:', mism.map((p) => p.id));

  if (!DRY_RUN) fs.writeFileSync(FILE, text, 'utf8');
}

main();
