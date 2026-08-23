// lib/ads.ts
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
 * 4面ぶんまとめて反映した。
 *
 * 選手結果ページ（player_results）はサイト最大の母数だが、回遊検証の対照群なので
 * **意図的にキーを作っていない**。docs/wiki/circulation-verification.md の判定式
 * （学校ページの変化 − 選手結果ページの変化）が壊れるため、キーを足す前に回遊検証との
 * 順序を必ず確認すること。
 *
 * 補足: AdSense 管理画面が出すコピペ用スニペットは `data-full-width-responsive="true"` だが、
 * AdUnit.tsx では意図的に `false` にしている（true だとモバイルで本文カラムをはみ出す。
 * 理由は AdUnit.tsx のコメント）。スニペットと食い違って見えても直さないこと。
 */
export const AD_SLOTS = {
  /** /players/ 選手一覧（「出場数の多い選手」直後） */
  playersIndex: '5268770947',
  /** /tournaments/<...>/<gender>/ 大会結果（トーナメント表直後） */
  tournamentResult: '8677583249',
  /** /tournaments/ 大会一覧（最初の年度ブロック直後） */
  tournamentsIndex: '8402251079',
  /** /news/<articleId>/ 展望記事（最初のカテゴリ節直後） */
  newsArticle: '4306103716',
} as const satisfies Record<string, string>;

export type AdSlotKey = keyof typeof AD_SLOTS;
