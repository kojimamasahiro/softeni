---
kind: research
---
# Cloudflare Pages の 20,000 ファイル上限への対応（2026-10-11）

## 状況

- 無料プランは1サイト 20,000 ファイル。`out/` は 17,983 ファイル・8,433 ページ（残り約 2,000）。
- 内訳: `_next/data`（getStaticProps の JSON）8,390 / players 4,266 / highschool 1,214 / teams 1,200 / tournaments 695 / og 638 / ほか。

## 検討した案

1. `out/_next/data` を消す（採用）。無料のまま、HTML・SEO は不変。遷移は全体の再読み込みになる。
2. `/players/[id]/results` の JSON だけ消す（約 13,700 ファイル）。余裕が小さい。
3. Workers Paid（月 $5）で上限 100,000。コード変更なし。
4. 結果ページを `/players/[id]` に統合してページ自体を減らす。URL・SEO への影響が大きい。

## 実装と実測

- postbuild の最後に `scripts/drop-next-data.mjs`。8,390 ファイルを削除し、`out/` は 9,591 ファイル。
- JSON を消しただけだと、`next/link` の prefetch が画面内のリンクごとに 404 になった（`/players/` で数十件。
  返るのは約 8KB の 404.html）。クリックは 404 を受けてから全体を再読み込みする（Next 15.5.20 の
  `markAssetError` → `handleHardNavigation`）。
- 本番だけ webpack alias で `next/link` を `src/components/StaticLink.tsx`（素の `<a>`）に差し替えた。
  79 ファイルが `next/link` を使い、`legacyBehavior` / `passHref` は0件なので、各ファイルは触らなかった。
- 確認（CF Pages と同じく無いファイルは 404.html を返す静的サーバーで `out/` を配信）:
  `/players/19/results/` はリンク 180 本で `_next/data` への要求0件。`/players/` からのクリックで正しいページに着く。
  `/tournaments/` のフィルター（shallow な `router.replace`）は再読み込みせず動く。hydration の警告なし。
- 最初のビルドは `next dev` を動かしたままだったため、`next build` が開始直後で約11時間止まった。止めたら通った。

## Compile Log

- wiki:deployment: `_next/data` を出さないこと・`next/link` の差し替え・router 遷移の注意・判断（無料のまま減らす）
- wiki:deployment: `next dev` と `next build` を同時に動かさない（Assumption）
- 落とした(依頼限り): 出力の内訳の数値（wiki には要点の数だけ。内訳はこのノート）
- 落とした(重複): 検討した案 2〜4 の詳細は判断の1行で足りる
