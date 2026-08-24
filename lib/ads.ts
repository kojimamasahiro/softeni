// lib/ads.ts
import type { PageType } from '@/lib/analytics';

//
// AdSense 手動広告枠の設定。枠の設計思想は docs/adsense-ui-proposal.md、
// 密度の上限と段階導入の手順は docs/wiki/monetization.md「手動広告枠」を正とする。
//
// スロットID は AdSense 管理画面（広告 → 広告ユニットごと → ディスプレイ広告）で
// ユニットを作ると発行される数値（`data-ad-slot`）。**ページ種別ごとにユニットを分ける**。
// 分けておかないと AdSense レポートで面ごとの RPM を比較できず、
// 「どの面が効いたか」を判断できないまま枠だけ増えることになる。
//
// 空文字のスロットは AdUnit が何も描画しない（DOM にも出ない）。
// そのため ID を貼る前でも安全に本番へ入れられる。ID を貼った時点で配信が始まる。

/** AdSense のパブリッシャーID。_app.tsx のスクリプト読込と同じもの。 */
export const ADSENSE_CLIENT = 'ca-pub-2626448782460921';

/**
 * ページ種別ごとの広告スロット。キーは lib/analytics.ts の PageType に対応させてある
 * （GA4 の from_type / to_type と AdSense のユニットを突き合わせられるようにするため）。
 *
 * 導入順は PV の多い順（選手一覧 → 大会結果 → 大会一覧 → news 展望）。ID は 2026-08-23 に
 * 4面ぶんまとめて反映した。2026-08-25 にフッター枠と選手結果ページを追加。
 *
 * 選手結果ページ（player_results）は回遊検証の対照群だが、**測定期間中に対照群と施策群が
 * 別々に動かなければ判定式は壊れない**。9月末のベースライン取得より前に、対照群
 * （選手結果ページ）と施策群（高校学校ページ）の両方へ同時に入れて定常化させる前提で
 * 解禁した。詳細は docs/wiki/circulation-verification.md の追記。
 * **ベースライン取得後・測定期間中は、この2種別の広告を触らないこと。**
 *
 * 補足: AdSense 管理画面が出すコピペ用スニペットは `data-full-width-responsive="true"` だが、
 * AdUnit.tsx では意図的に `false` にしている（true だとモバイルで本文カラムをはみ出す。
 * 理由は AdUnit.tsx のコメント）。スニペットと食い違って見えても直さないこと。
 */
export const AD_SLOTS = {
  /** /players/ 選手一覧（検索ボックス直後） */
  playersIndex: '5268770947',
  /** /tournaments/<...>/<gender>/ 大会結果（リード文直後） */
  tournamentResult: '8677583249',
  /** /tournaments/ 大会一覧（フィルターバー直後） */
  tournamentsIndex: '8402251079',
  /** /news/<articleId>/ 展望記事（リード文直後） */
  newsArticle: '4306103716',
  /** /players/<id>/results/ 選手結果ページ（ヘッダー直後） */
  playerResults: '',
  /**
   * フッター直上の枠。**全ページ共通で1ユニット**（FOOTER_AD_PAGE_TYPES の全種別で使い回す）。
   * 種別ごとに分けていないので、フッター枠の収益はページ種別に分解できない。
   * 分解が必要になったら種別ごとにキーを足し、AppShell 側で出し分ければよい。
   */
  footer: '',
} as const satisfies Record<string, string>;

export type AdSlotKey = keyof typeof AD_SLOTS;

/**
 * フッター直上の枠を出すページ種別（`src/components/AppShell.tsx` が使う）。
 *
 * **広告面を増やすときは原則ここに1行足すだけでよい。** ページを1枚ずつ編集しない。
 * 判定は `getPageType()`（lib/analytics.ts）で、回帰テストは `npm run analytics:test`。
 *
 * 除外している種別と理由:
 * - `beta`  … 開発中の面。管理画面の除外URLとも揃える。`/matches/*` と実体は同じ
 *              コンポーネントだが、判定はパスなので `/beta/*` だけを外せる。
 * - `other` … `/contact` `/privacy` `/about` `/faq` `/404` `/growth/*` が混ざるため
 *              まとめて除外する。ここに含まれる `/tournaments/major|local|block/` の
 *              3枚も巻き添えで外れるが、枚数が小さいので分離していない。
 */
/**
 * フッター枠を出すために必要な `<main>` の本文文字数（空白除去後）。
 *
 * **中身の無いページに広告を出さないための歯止め。** AdSense は「コンテンツのない
 * ページ」への掲載を禁じており、種別の許可リストだけではこれを防げない。実際
 * `/tournaments/local/<県>/` は種別としては `tour_hub` だが、その県の大会が未登録だと
 * 本文が「現在登録されている大会はありません。」だけ（`<main>` 実測78文字）になる。
 *
 * 400 という値は out/ 全4,346枚の実測から決めた（2026-08-25）。
 * `<main>` の本文文字数の分布:
 *
 * | 閾値 | 除外される枚数 |
 * |---|---|
 * | 150 |  51 |
 * | 200 | 127 |
 * | 400 | 417（全体の9.6%）|
 * | 600 | 809 |
 *
 * 400 だと、空の `/tournaments/local/*`（78文字）や結果の乏しいチーム年度ページを外し、
 * 成績表が1つでも載っているページ（中学チーム 中央値562文字）は残る。
 * データが増えれば勝手に閾値を超えて広告が出るようになるので、除外リストの保守は要らない。
 *
 * 判定はクライアントで `main.textContent` を測って行う（サーバー側では本文量を知る手段が
 * ないため）。結果としてフッター枠だけは SSR の HTML に含まれずマウント後に現れるが、
 * 位置がページ最下部なので、通常の閲覧開始位置（ページ上部）では見えている要素が動かず
 * CLS にはならない。ファーストビュー枠は従来どおり SSR で高さを確保する。
 */
export const FOOTER_AD_MIN_CONTENT_CHARS = 400;

export const FOOTER_AD_PAGE_TYPES: ReadonlySet<PageType> = new Set<PageType>([
  'top',
  'players_index',
  'player_profile',
  'player_results',
  'tour_index',
  'tour_hub',
  'tour_year',
  'tour_match',
  'hs_top',
  'hs_rankings',
  'hs_rekidai_index',
  'hs_rekidai',
  'hs_school',
  'hs_pref',
  'hs_gender',
  'jhs_top',
  'jhs_pref',
  'jhs_team',
  'jhs_pathways',
  'teams_index',
  'team_hub',
  'team_year',
  'stleague',
  'news',
  'rankings',
  'match_bare',
]);
