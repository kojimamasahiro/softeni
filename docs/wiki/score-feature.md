# Score Feature

## 概要

score 機能は、試合作成、ゲーム/ポイント記録、動画レビュー、公開ページ、成長分析までを含む一連の機能群です。

主要ファイル:

- `src/pages/beta/matches/create.tsx`
- `src/pages/beta/matches/[matchId]/input.tsx`
- `src/pages/beta/matches/[matchId]/video-review.tsx`
- `src/pages/beta/matches-results/**`
- `src/pages/matches/**`
- `src/pages/api/matches/**`

## 実装済みの画面と導線

### 管理/入力側

- `/beta/matches`
- `/beta/matches/create`
- `/beta/matches/[matchId]`
- `/beta/matches/[matchId]/input`
- `/beta/matches/[matchId]/video-review`

補足:

- `isDebugMode()` と `hasLiveMatchApi()` による利用制限があります
- `score` mode では編集系ページ・書き込み API を閉じる実装があります

### 公開側

- `/beta/matches-results`
- `/beta/matches-results/[matchId]`
- `/beta/matches-results/growth`
- `/matches`
- `/matches/[matchId]`
- `/matches/growth`

## 試合詳細ページで確認できる要素

- match 基本情報
- ゲームごとのスコア
- ポイント列
- サーブ/レシーブ/重要局面/ラリー系の分析表示
- YouTube 埋め込みまたは外部リンク
- 成長分析への導線

確認根拠:

- `src/pages/beta/matches-results/[matchId]/index.tsx`
- `lib/matchAnalysis.ts`
- `lib/siteConfig.ts`

## ポイント記録

`points` は少なくとも以下の情報を持ちます。

- `winner_team`
- `serving_team`
- `serving_player`
- `rally_count`
- `first_serve_fault`
- `double_fault`
- `result_type`
- `winner_player`
- `loser_player`
- `point_note`
- `shot_type`
- `shot_course`
- `video_start_ms`
- `video_end_ms`

確認根拠:

- `src/types/database.ts`
- `src/pages/api/matches/[matchId]/points/index.ts`
- `docs/sql/point-youtube-review.sql`

## YouTube 連携

実装で確認できること:

- `matches` に `youtube_video_id`, `youtube_url`, `youtube_embed_allowed` を保持
- `points` に `video_start_ms`, `video_end_ms` を保持
- 動画レビューセッションを `match_video_sessions` と `match_point_candidates` で管理
- 候補ポイントをレビュー後に `points` へ反映できる

確認根拠:

- `docs/sql/video-review.sql`
- `docs/sql/point-youtube-review.sql`
- `src/pages/api/matches/[matchId]/video-sessions/**`
- `src/pages/beta/matches/[matchId]/video-review.tsx`

## 共有 URL

実装済みとして確認できる共有 URL:

- `softeni-pick` mode: `/beta/matches-results/[matchId]`
- `score` mode: `/matches/[matchId]`

URL の組み立ては `lib/siteConfig.ts` に寄せられています。

## 編集可能 URL

Draft / Open Question:

- `scripts/generate-beta-matches-json.mjs` では `edit_token` / `edit_token_hash` を公開 JSON から除外しています
- ただし、今回確認した画面・API では編集 URL トークンを消費する処理までは確認できていません

## Draft

- `score.softeni-pick.com` を本体とどこまで分けるかの正式運用
  → 方針決定済み（2026-06）: [ADR-003](../adr/ADR-003-score-media-tool-separation.md)。
  「閲覧公開＝本体に統合」「ツール公開（UGC）＝score に分離」。
- 共有 URL と編集可能 URL を別権限で扱う正式設計
  → ADR-003 で `edit_token` 廃止・認証所有モデル（`owner_user_id` / `visibility`）へ寄せる方針
- 本体サイト（大会・選手ページ）との相互リンク設計: [score-site-link.md](./score-site-link.md)（2026-06 Draft）

## Assumption

- 現時点の score 機能は「記録管理は beta 側、閲覧公開は score 側」という分離を進めている途中段階

## Open Questions

- `edit_token` / `edit_token_hash` の正式な利用箇所
- 試合編集権限を今後どの方式で渡すか
- 公開用 `matchId` を恒久的にそのまま使う方針か
