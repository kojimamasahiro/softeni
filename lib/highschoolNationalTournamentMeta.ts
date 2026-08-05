// lib/highschoolNationalTournamentMeta.ts
// 高校カテゴリ「全国大会 歴代記録」の**純粋なメタ定義**（fs を使わない）。
//
// なぜ lib/highschoolNationalTournaments.ts から切り出したか:
// あちらは冒頭で `import fs` しているためサーバー専用で、クライアントにも載る
// コンポーネント（TournamentCard など）から import できない。しかし大会ハブへの
// リンク先解決（getTournamentHubHref）はそうしたコンポーネントでこそ必要になる。
// メタだけをここに置き、サーバー側モジュールは本ファイルを re-export する
// （＝定義の二重管理を作らない）。

/** URL スラッグ（/highschool/tournaments/[tournament]） */
export type HsNationalTournamentSlug = 'championship' | 'japan-cup' | 'senbatsu';

export type HsNationalTournamentMeta = {
  slug: HsNationalTournamentSlug;
  tournamentId: string;
  /** 正式名称 */
  label: string;
  /** 短縮・通称（見出し向け） */
  shortLabel: string;
  /**
   * 検索略称（例: ハイジャパ）。タイトル/見出し/FAQ に literal で出して
   * 略称クエリを拾うために使う。専用ページは作らず、この大会ハブに集約する。
   * 詳細は docs/wiki/seo.md #3。
   */
  aliases?: string[];
  officialUrl: string;
  /** カードや概要に出す短い説明 */
  description: string;
};

/** 高校カテゴリで歴代記録を出す全国大会の定義 */
export const HS_NATIONAL_TOURNAMENTS: Record<HsNationalTournamentSlug, HsNationalTournamentMeta> = {
  championship: {
    slug: 'championship',
    tournamentId: 'highschool-championship',
    label: '全国高等学校総合体育大会',
    shortLabel: 'インターハイ',
    officialUrl: 'https://www.zen-koutairen.com/',
    description:
      '全国高等学校総合体育大会（インターハイ）ソフトテニス競技は、各都道府県予選を勝ち上がった代表が男子・女子の団体戦と個人戦（ダブルス）で全国一を争う、高校ソフトテニス最大級の全国大会です。本ページでは歴代の優勝校・準優勝・ベスト4を年度別・種目別にまとめています。',
  },
  'japan-cup': {
    slug: 'japan-cup',
    tournamentId: 'highschool-japan-cup',
    label: 'ハイスクールジャパンカップ',
    shortLabel: 'ハイスクールジャパンカップ',
    aliases: ['ハイジャパ'],
    officialUrl: 'https://www.gosen-sp.jp/hjs/',
    description:
      'ゴーセン杯争奪ハイスクールジャパンカップ（通称「ハイジャパ」）は、高校生個人の日本一を決めるソフトテニスの全国大会です。男子・女子それぞれシングルスとダブルスを実施し、各地区の代表選手が頂点を争います。本ページでは歴代の優勝・準優勝・ベスト4を年度別・種目別にまとめ、出場校の戦績ページへもリンクしています。',
  },
  senbatsu: {
    slug: 'senbatsu',
    tournamentId: 'highschool-senbatsu',
    label: '全日本高等学校選抜ソフトテニス大会',
    shortLabel: '高校選抜',
    aliases: ['高校選抜'],
    officialUrl: 'https://www.zen-koutairen.com/',
    description:
      '全日本高等学校選抜ソフトテニス大会（高校選抜）は、毎年3月に開催される男子・女子の団体戦の全国大会です。各地区予選を勝ち上がった代表校が、新チームでの日本一を争います。インターハイ・ハイスクールジャパンカップと並ぶ高校三大タイトルの一つで、本ページでは歴代の優勝校・準優勝・ベスト4を年度別にまとめています。',
  },
};

export const HS_NATIONAL_SLUGS = Object.keys(HS_NATIONAL_TOURNAMENTS) as HsNationalTournamentSlug[];

// tournamentId（例: 'highschool-championship'）から高校全国大会のスラッグを逆引きする。
// 汎用大会ハブ（/tournaments/[generation]/[tournamentId]）が高校全国大会の歴代まとめ
// （/highschool/tournaments/[tournament]）とカニバるため、ハブ側の noindex 判定と
// 高校歴代ページへの内部リンク生成に使う。詳細は docs/wiki/seo.md #3。
export function getHsNationalSlugByTournamentId(tournamentId: string): HsNationalTournamentSlug | null {
  return HS_NATIONAL_SLUGS.find((slug) => HS_NATIONAL_TOURNAMENTS[slug].tournamentId === tournamentId) ?? null;
}

/**
 * 「その大会のハブページ」への内部リンク先を返す唯一の入口。
 *
 * 高校全国大会は汎用ハブ `/tournaments/{generation}/{tournamentId}/` が **noindex, follow**
 * なので（seo.md #3 の検索面集中）、そこへ内部リンクを張ると index 対象の歴代記録ページに
 * 評価が直接届かない。2026-08-06 の実測では汎用ハブ（IH）への被リンク 1,111 枚に対し
 * 歴代記録ページへは 194 枚しかなく、リンクの大半が noindex を1ホップ挟んでいた。
 * `follow` でも長期 noindex のページはクロール頻度が落ちるため、ここで直接先へ振り替える。
 *
 * ハブ URL をベタ書きせず、必ず本関数を通すこと。
 */
export function getTournamentHubHref(generationId: string | null | undefined, tournamentId: string): string {
  const hsSlug = getHsNationalSlugByTournamentId(tournamentId);
  if (hsSlug) return `/highschool/tournaments/${hsSlug}/`;
  if (!generationId) return `/tournaments/${tournamentId}/`;
  return `/tournaments/${generationId}/${tournamentId}/`;
}
