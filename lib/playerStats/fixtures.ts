// lib/playerStats/fixtures.ts
// 検証用の代表選手（固定リスト）。golden 突合・回帰テストに使う。
// curated（data/players/<slug> に analysis.json を持つ）選手は既存実値と突合できる。
// 出場が多い選手・国際/高校/団体を含む選手を検証観点として併記する。

export interface FixturePlayer {
  id: number;
  slug?: string;
  name: string;
  /** analysis.json を持ち golden 突合できるか。 */
  curated: boolean;
  note?: string;
}

/** curated 選手（id 1..22）。全員 analysis.json を持つ。 */
export const CURATED_FIXTURES: FixturePlayer[] = [
  { id: 1, slug: 'ando-kesuke', name: '安藤圭祐', curated: true },
  { id: 2, slug: 'ando-yusaku', name: '安藤優作', curated: true },
  { id: 3, slug: 'funemizu-hayato', name: '船水颯人', curated: true, note: '国際大会・多数優勝' },
  { id: 4, slug: 'hashiba-toichiro', name: '橋場柊一郎', curated: true, note: '出場多' },
  { id: 5, slug: 'hashimoto-asahi', name: '橋本旭陽', curated: true },
  { id: 6, slug: 'hirooka-sora', name: '広岡宙', curated: true, note: '出場多' },
  { id: 7, slug: 'iwata-kohei', name: '岩田皓平', curated: true },
  { id: 8, slug: 'kataoka-aki', name: '片岡暁紀', curated: true },
  { id: 9, slug: 'kawasaki-kohei', name: '川﨑康平', curated: true },
  { id: 10, slug: 'kurosaka-takuya', name: '黒坂卓矢', curated: true, note: '出場多' },
  { id: 11, slug: 'marunaka-taimei', name: '丸中大明', curated: true },
  { id: 12, slug: 'maruyama-kaito', name: '丸山海斗', curated: true, note: '出場多' },
  { id: 13, slug: 'motokura-kentaro', name: '本倉健太郎', curated: true },
  { id: 14, slug: 'nagae-koichi', name: '長江光一', curated: true },
  { id: 15, slug: 'shimizu-shun', name: '清水駿', curated: true },
  { id: 16, slug: 'uchida-riku', name: '内田理久', curated: true },
  { id: 17, slug: 'uchimoto-takafumi', name: '内本隆文', curated: true, note: 'ダブルス' },
  { id: 18, slug: 'ueda-rio', name: '植田璃音', curated: true },
  { id: 19, slug: 'uematsu-toshiki', name: '上松俊貴', curated: true, note: '出場最多・ダブルス' },
  { id: 20, slug: 'ueoka-shunsuke', name: '上岡俊介', curated: true },
  { id: 21, slug: 'yano-soto', name: '矢野颯人', curated: true },
  { id: 22, slug: 'yonekawa-yuto', name: '米川結翔', curated: true },
];

/** 出場が多い非 curated 選手（性能・線形性の観点）。 */
export const HIGH_VOLUME_FIXTURES: FixturePlayer[] = [
  { id: 35, name: '菊山太陽', curated: false, note: '出場多' },
  { id: 122, name: '浅見竣一朗', curated: false, note: '出場多' },
  { id: 125, name: '前田梨緒', curated: false, note: '女子・出場多' },
  { id: 69, name: '佐藤心美', curated: false, note: '女子・出場多' },
];

export const ALL_FIXTURES: FixturePlayer[] = [...CURATED_FIXTURES, ...HIGH_VOLUME_FIXTURES];
