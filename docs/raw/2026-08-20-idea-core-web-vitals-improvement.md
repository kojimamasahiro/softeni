# アイデア: Core Web Vitals改善

## 状況

Idea Backlog。2026-08-20 発散フェーズ（着手前・スコープ未確定）。

## 目的

モバイルの表示速度・体感品質を上げること。SEO（Core Web Vitalsはランキング要因）と
AdSense収益（離脱率・視認可能時間に影響）の両方に効く共通の土台改善。

## 背景（AMP検討からの派生）

同日の会話でユーザーから「AMP設定してAMP自動広告をオンにするメリットはある？」と
質問があり、以下の理由でAMP化は非推奨と回答した:

- 2021年のページエクスペリエンスアップデートでTop Storiesカルーセル等の主要SERP枠は
  AMP限定ではなくCore Web Vitals達成で通常ページでも対象になり、AMP固有のSEO優位性は
  ほぼ消滅している。
- 本サイトはニュース記事型ではなくテーブル中心のデータサイトで、AMPのJS制限
  （amp-bind/amp-script中心、通常のReactコンポーネント不可）により既存UI
  （ソート・フィルタ等）を作り直す必要がありコストが見合わない。
- Next.jsはPages RouterでAMPを一応サポートするが、App Router移行でAMPサポートを
  縮小・非推奨方向にしており、将来の移行の足枷になる。
- AMP Auto ads自体の収益性もAMPエコシステム縮小で相対的に下がっている傾向がある。
- 直近対応した「モバイル全画面（ビネット）広告オフ」（[monetization.md](../wiki/monetization.md)）
  と同様、モバイルUXを崩す施策を増やす方向はここでも避けたい。

この代替として、「AMP化ではなく既存ページのCore Web Vitals改善（画像最適化・不要JS削減
など）でモバイル表示速度を上げる方が投資対効果が良い」という結論に至り、その改善自体を
アイデアとして記録することにした。

## わかっていること

- [docs/adsense-ui-proposal.md](../adsense-ui-proposal.md) §4 に「Search Console / CrUX で
  CLSを監視。導入後にCLS > 0.1になったらmin-height設定を見直す」という運用方針の記載が
  既にある（広告枠のCLS対策文脈）。ただし実際の計測・改善はまだ未実施（Assumption:
  AdUnitコンポーネント自体が `Status: Proposal(未実装)` のため）。
- `next.config.mjs` は `output: 'export'`（静的HTML export）、`images: { unoptimized: true }`
  （静的export制約でNext.js Image最適化が無効）になっている。画像最適化はビルド側で
  行うか別途の仕組みが必要。
- 現状、Core Web VitalsやLCP/CLS/INPを対象にした計測・改善の取り組みは docs/wiki 内に
  見当たらない（`grep -n "Core Web Vitals\|CLS\|LCP"` で該当なし、2026-08-20時点）。

## 課題・未解決

- 現状のCWVの実測値（CrUXまたはLighthouse/PageSpeed Insights）が未取得。まず計測してから
  優先度をつける必要がある。
- `images: { unoptimized: true }` のため画像最適化の方針（ビルド時最適化ツール導入か、
  画像自体のサイズ・フォーマット見直しか）が未定。
- 不要JS削減の対象範囲（ページごとのJSバンドルサイズ計測が先）が未定。
- AdSenseの広告枠（自動広告・将来のAdUnit手動枠）とCLSの関係を、実装前にどう検証するか
  （§4の運用方針はあるが手順化はされていない）。

## 目指したい方向性

まだ発散フェーズ。次の一歩として妥当そうなのは:

1. PageSpeed Insights / CrUXで主要ページ（トップ・大会ハブ・選手詳細等）の現状値を計測
2. ボトルネックの特定（画像かJSかレイアウトシフトか）に応じて対応を絞る
3. `docs/adsense-ui-proposal.md` のCLS監視方針と合流させ、広告枠実装時のCLS基準としても使う

## 関連

- [monetization.md](../wiki/monetization.md) — AdSense/Auto ads全般。モバイル全画面
  （ビネット）オフの経緯もここ。
- [adsense-ui-proposal.md](../adsense-ui-proposal.md) §4 — CLS監視の既存方針
- [highschool-seo-m4-verification.md](../wiki/highschool-seo-m4-verification.md) — SEO関連の
  既存の計測運用の型（GSCチェックのやり方の参考になりうる）

## Compile Log

（新規作成のため該当なし）
