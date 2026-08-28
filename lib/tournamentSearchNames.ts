// lib/tournamentSearchNames.ts
// 大会の「実際に検索される名前」を title / h1 / description に literal で出すための表示名ヘルパ。
//
// 背景（docs/wiki/seo.md「大会名の表記と検索語の乖離（missing literal）」）:
// 正式名称だけでページを作ると、検索する側が使う語がページ上に 1 回も存在せず、
// そのクエリで圏外になることがある。全中がその実例で、正式名称
// 「全国中学校体育大会」は**全競技共通の名称**（バレー・陸上・卓球…）であり、
// ソフトテニスの利用者が実際に打つのは「全中」「全国中学校ソフトテニス大会」だった。
// 2026-08-28 の実測では、全中ハブはそのどちらの literal も 0 回しか持たず、
// 「ソフトテニス 全中 2026 結果」の SERP 上位30件に当サイトは出ていない。
//
// データの置き場所は `data/tournaments/index.json` の `searchLabel` / `searchAliases`。
// SEO 上の振る舞いを index.json 側で制御する方式は `featurePath`（seo.md #3）と同じで、
// 大会を足すときにコードを触らずに済む。**未設定の大会は label をそのまま使い、
// 表示は一切変わらない**（オプトイン）。
//
// 略称マスタが他にも 2 つある（`lib/nationalTitles.ts` の aliases＝選手ページの勲章カード用、
// `lib/highschoolNationalTournamentMeta.ts` の aliases＝高校歴代ページ用）。ここを 3 つ目に
// しなかった理由: nationalTitles は「全国大会優勝」の判定マスタで対象が全国大会に限られ、
// 汎用ハブが扱う地区・地域大会を表現できない。また nationalTitles 自身が
// 「1 つのマスタで 2 つの対象集合を表現している」ことを冒頭で警告しており、
// 3 つ目の用途を相乗りさせると同じ混同を増やす。

export type TournamentSearchNames = {
  /**
   * title / h1 の主表記。略称があれば `略称（検索名）` の形。
   * 例: `全中（全国中学校ソフトテニス大会）`。未設定の大会では label と同一。
   */
  headingName: string;
  /** 略称（「〜とは」の主語に使う）。無ければ null */
  primaryAlias: string | null;
  /** サイト上の表記（`index.json` の label） */
  formalLabel: string;
};

/**
 * 表示名を組み立てる。`searchLabel` / `searchAliases` が未設定なら
 * `headingName === label` となり、呼び出し側の出力は従来と 1 文字も変わらない。
 */
export function buildTournamentSearchNames(label: string, searchLabel?: string | null, searchAliases?: string[] | null): TournamentSearchNames {
  const formalLabel = label;
  const primaryName = searchLabel?.trim() || label;

  // 主表記に既に出ている語を括弧で重ねない。高校ハブで
  // 「…（高校選抜）（高校選抜）」の二重表記を起こした失敗（seo.md #3・2026-08-05）と同じ罠。
  const alias = (searchAliases ?? []).map((a) => a?.trim()).find((a): a is string => !!a && a !== primaryName && a !== formalLabel) ?? null;

  const headingName = alias ? `${alias}（${primaryName}）` : primaryName;

  return { headingName, primaryAlias: alias, formalLabel };
}
