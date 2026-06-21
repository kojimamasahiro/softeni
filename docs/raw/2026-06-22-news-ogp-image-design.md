# /news 記事 OGP画像 自動生成 設計ドラフト

日付: 2026-06-22
状態: Draft（検討メモ。実装指示ではない）。親機能は [news-context-blocks.md](../wiki/news-context-blocks.md)、画像基盤は [sns-day1-images.md](../wiki/sns-day1-images.md)。

## 検討の結論（要約）

- **ページ内の装飾アイキャッチ（記事冒頭のビジュアル）は作らない**。本サイトの価値は「DB由来の文脈密度」であり、装飾画像はSEOに効かず運用負荷だけ増える。
- **SNSシェア用のOGP画像は `/news` 記事に限って自動生成する価値がある**。記事はSNS流入を狙う唯一のページ種別で、共有CTRが効く。既存の `tools/sns-images/`（Pillow・内部データから決定的に生成・LLMなし）の資産を流用でき、テンプレートのみ／human-in-the-loop の設計原則とも矛盾しない。
- 大会ハブ・選手・結果ページなど検索流入主導のページは、共通の既定OGP画像（`public/og/twitter-card-summary.png`、`summary` 小カード）のままで十分。

## 現状（実装が source of truth）

- `src/components/MetaHead.tsx` は `image`（既定 `siteConfig.ogImage`）と `twitterCardType`（既定 `summary`）を props で受ける。既に記事側で差し替え可能な作り。
- `src/pages/news/[articleId].tsx` は `MetaHead` に `image` を渡しておらず、全記事が既定の192×192 `summary` カードにフォールバック。
- 記事レコード `data/news/<articleId>.json` は最小（`articleId` / `type` / `state` / `tournamentId` / `year` / `categoryId`）。表示内容（優勝者など）はビルド時に `lib/newsArticle.ts` が details から導出。
- 現在の記事: 68件（うち `published` 1件、残り `draft`）。`type` はほぼ `result`。
- `tools/sns-images/`（Pillow）は X 投稿用に 16:9(1200×675) 等の決定的カードを生成済み。`snslib.py` にブランド配色（NAVY #1B2A4A / YELLOW #F8B500）・ヘッダー/フッター描画・`participants_map` / `entry_label` 等の部品がある。`result_singles.py` は優勝/準優勝/ベスト4カードを生成。

## 最大の論点: 生成場所（ビルド制約）

本番 `prebuild` は Node(`.mjs`)のみ。デプロイは Cloudflare Pages へ移行中で、ビルドランナーに Pillow や日本語フォント（Hiragino/Noto CJK）が無い前提で考えるべき。よって「本番ビルド中に Python で画像生成」は採らない。

候補:

- **案1（推奨）ローカル生成＋成果物コミット**: 既存 `sns-images` と同じ運用思想で、OGP画像をローカルの手動ステップで生成し、PNG を `public/og/news/<articleId>.png` として git にコミット。ビルドは静的ファイルを配るだけ。Cloudflare Pages 移行とも整合し、ビルドの依存を一切増やさない。human-in-the-loop（公開前に人が `state` を `published` にする）と同じタイミングで画像も用意できる。
- 案2 Node ネイティブ生成（satori/@vercel/og 等）を `prebuild` に追加: ツールチェーンは単一化されるが、ブランド描画を再実装する必要があり、フォント同梱・静的エクスポート(`out`)との相性確認が要る。
- 案3 本番ビルドに Python ステップ追加: Cloudflare Pages 制約により非推奨。

→ まずは**案1**で始め、運用が固まったら案2の自動化を検討、が低リスク。

## 画像内容（記事タイプ別・テンプレ決定的生成）

サイズは `summary_large_image` 標準の **1200×630**（既存sns 16:9=675 から微調整）。`snslib.py` のヘッダー/フッター・配色を流用。

- `result`（結果記事）: 主役＝**優勝ペア/選手**。大会名＋年＋カテゴリ、優勝者フルネーム＋所属（学校（都道府県））、決勝スコア。余白があれば準優勝。`result_singles.py` の優勝カード相当を1枚に凝縮。
- `preview`（プレビュー記事・現状ほぼ未生成）: 前回王者＋シード中の curated 注目選手を列挙。詳細は要確定（Open Question）。
- フォールバック: データが薄い/生成失敗時は既定 `summary` カードのまま（公開はブロックしない）。

## 配線（実装時）

- 画像が存在する記事のみ `MetaHead` に `image={ogUrl}` と `twitterCardType="summary_large_image"` を渡す。無ければ既定にフォールバック（現状維持）。
- `ogUrl` は `public/og/news/<articleId>.png` を `siteConfig` で絶対URL化。`MetaHead` の `image:width/height` は現状 192 固定の分岐があるため、large 用に 1200×630 を出すよう調整が必要。
- 画像有無の判定: 記事レコードに `ogImage` フィールドを持たせる or `public/og/news/` の存在チェック。前者が決定的で扱いやすい。

## 運用フロー

生成スクリプトは `state` を勝手に変えない（追記型）。公開は従来どおり `state` 手書き→`published`。OGP画像はローカル生成→コミットで用意し、記事データ修正時は再生成して上書き（キャッシュは画像URLにハッシュ/更新日を付けるか要検討）。

## 確定事項（2026-06-22）

- **生成場所**: 案1（ローカル生成＋ PNG を git にコミット）。本番ビルドの依存は増やさない。将来の Node 自動化（案2）は後日検討。
- **記事タイプ**: `result` のみ対応。`preview` は後回し。
- **対象範囲**: `state === "published"` の記事のみ生成（現状1件）。
- **キャッシュ無効化**: ファイル名に内容ハッシュを付ける（例 `public/og/news/<articleId>-<hash8>.png`）。データ修正→再生成で新ファイル名になり、古いキャッシュを踏まない。
- **`MetaHead` の image サイズ分岐**: 192固定分岐は残しつつ、large(1200×630) と共存させる。記事は large を出す。
- **対象ドメイン**: news は本体側（softeni-pick）のみ。score 側は対象外。

## Open Questions（残）

- **preview記事のOGP内容**: 前回王者中心か注目選手中心か（後回し）。
- **Node自動化（案2）への移行可否**: 運用が固まった後に再検討。

## 関連

- [news-context-blocks.md](../wiki/news-context-blocks.md) / [sns-day1-images.md](../wiki/sns-day1-images.md) / [seo.md](../wiki/seo.md)（#8 速報/結果記事）
- `src/components/MetaHead.tsx` / `src/pages/news/[articleId].tsx` / `lib/siteConfig.ts` / `tools/sns-images/snslib.py`
