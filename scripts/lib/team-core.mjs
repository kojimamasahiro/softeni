// チーム名の「コア」（照合キー）を求める共通ロジック。
//
// build-team-merge-candidates.mjs（候補生成）と check-identity-health.mjs（ヘルスチェック）は
// 同じ定義を使わなければならない。片方だけ変えると、候補には出るのにヘルスチェックが
// 件数を過少報告する（実際 2026-07 に異体字対応を候補生成側だけに入れて発生した）。
//
// 正規化の内容:
//   - NFKC（全角半角・記号の揺れ）
//   - 異体字・旧字体 → 常用字体（scripts/lib/kanji-variants.mjs）
//   - 付 → 附
//   - 学校種別・クラブ系の接尾辞を反復除去（コアが2文字未満になる除去はしない）
//
// 注意: これは**照合キー専用**。表示名や大会データ本体の書き換えには使わない。

import { foldKanjiVariants } from './kanji-variants.mjs';

export const TEAM_SUFFIXES = [
  '高等学校', '高校', '中学校', '中学', '小学校', '小学', '大学',
  'ソフトテニスクラブ', 'テニスクラブ', 'スポーツ少年団', 'スポ少', '少年団',
  'ジュニアクラブ', 'ジュニア', 'クラブ', 'STC', 'JSC', 'JST', 'TC', 'SC',
  '中', '高', '小', '大',
];

/** チーム名から照合用のコアを取り出す。 */
export function teamCore(name) {
  let s = foldKanjiVariants(String(name).normalize('NFKC')).replace(/付/g, '附');
  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of TEAM_SUFFIXES) {
      if (s.endsWith(suf) && s.length - suf.length >= 2) {
        s = s.slice(0, -suf.length);
        changed = true;
        break;
      }
    }
  }
  return s;
}
