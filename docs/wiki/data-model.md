# Data Model

## 概要

このリポジトリでは、少なくとも次の 2 系統のデータを扱っています。

- 静的 JSON: `data/**`, `public/data/**`
- Supabase: score 機能の動的データ

## 静的 JSON

### 大会データ

主な配置:

- `data/tournaments/index.json`
- `data/tournaments/local_index.json`
- `data/tournaments/information/*.json`
- `data/tournaments/details/**`
- `data/local-sources/prefecture-sources.json`
- `data/local-sources/detected-documents.json`
- `data/local-sources/ignored-documents.json`

関連ドキュメント:

- `docs/tournament-data-structure.md`

現行の source of truth:

- 大会一覧・世代・地域紐付け: `index.json`, `local_index.json`
- 年度情報・開催地・外部リンク・カテゴリ表示名: `information/*.json`
- 結果本体: `details/**`
- 地方大会巡回元 URL: `data/local-sources/prefecture-sources.json`

地方大会候補検知ストア:

- `detected-documents.json`
  巡回で見つけた候補リンクの確認用ストア
- `ignored-documents.json`
  `prefectureSlug + normalizedUrl` 完全一致で除外する恒久 deny list

注意:

- `detected-documents.json` の `accepted` は確認済み候補を意味するだけで、公開データ反映済みは意味しない

## Deprecated

- `data/tournaments/{all,corporate,highschool,international-qualifier,junior,masters,university}/**`
  旧構造の `meta.json` / `entries` / `matches` / `results` / `categories.json`
  現行実装では canonical source ではない
- `data/players/*/summary.json`
  選手プロフィールの注目ポイント表示は廃止され、現行実装では参照しない
- `data/players/*/results.json`
  選手別結果の旧中間データ。現行運用では廃止し、ファイルも削除した

### 選手データ

主な配置:

- `data/players/index.json`
- `data/players/*/information.json`
- `data/players/*/analysis.json`

実装メモ:

- `/players/[slug]` のプロフィールページは `data/players/{slug}/information.json` を必須で参照する
- 同ページは `analysis.json` があれば最新試合情報を表示する
- `/players/[id]/results` の試合結果ページは `data/players/{slug}/results.json` を直接は参照しない
- 試合結果ページは `data/players/index.json` で数値 `id` から選手名を引き、`data/tournaments/details/**` と `data/tournaments/information/*.json` から結果を再構築する
- `data/players/*/analysis.json` は `data/tournaments/details/**` と `data/tournaments/information/*.json` をソースに自動生成する
- `latestMatch` は `results` ページ相当の大会データから最新開催の大会を選んで生成する

### score 公開 JSON

- `public/data/beta-matches/meta.json`
- `public/data/beta-matches/index.json`
- `public/data/beta-matches/matches/*.json`
- `public/data/beta-matches/growth/targets.json`
- `public/data/beta-matches/growth/reports/*.json`

## Supabase の主なテーブル

### `matches`

確認できた主な列:

- `id`
- `tournament_name`
- `tournament_id`
- `tournament_generation`
- `tournament_gender`
- `tournament_category`
- `tournament_year`
- `round_name`
- `best_of`
- `game_type`
- `match_date`
- `court_name`
- `status`
- `completed_at`
- `opponent_level`
- `youtube_video_id`
- `youtube_url`
- `youtube_embed_allowed`
- `source_site_match_id`
- `source_site_tournament_id`
- `team_a`, `team_b`
- `team_a_*`, `team_b_*`
- `teams`

根拠:

- `src/types/database.ts`
- `docs/sql/growth-analysis.sql`
- `docs/sql/point-youtube-review.sql`

### `games`

- `id`
- `match_id`
- `game_number`
- `winner_team`
- `points_a`
- `points_b`
- `initial_serve_team`
- `initial_serve_player_index`
- `created_at`

### `points`

- `id`
- `game_id`
- `point_number`
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
- `recording_level`
- `point_detail`
- `video_start_ms`
- `video_end_ms`

### `match_video_sessions`

- `id`
- `match_id`
- `source_type`
- `source_url`
- `source_label`
- `youtube_video_id`
- `upload_file_name`
- `upload_file_size`
- `duration_ms`
- `processing_status`
- `created_at`
- `updated_at`

### `match_point_candidates`

- `id`
- `session_id`
- `candidate_order`
- `start_ms`
- `end_ms`
- `confidence`
- `status`
- `winner_team`
- `serving_team`
- `serving_player`
- `rally_count`
- `first_serve_fault`
- `double_fault`
- `result_type`
- `winner_player`
- `loser_player`
- `notes`
- `created_at`
- `updated_at`

## リレーション

- `matches.id -> games.match_id`
- `games.id -> points.game_id`
- `matches.id -> match_video_sessions.match_id`
- `match_video_sessions.id -> match_point_candidates.session_id`

## モデル上の特徴

- `matches` はフラットな `team_a_*` / `team_b_*` と、構造化された `teams` の両方を持つ
- `games.points_a` / `games.points_b` / `games.winner_team` は `points` から再計算される派生値に近い
- score 公開用 JSON では内部フィールドを削除する

確認根拠:

- `src/pages/api/matches/[matchId]/index.ts`
- `src/pages/api/matches/[matchId]/points/index.ts`
- `scripts/generate-beta-matches-json.mjs`

## Assumption

- `src/types/database.ts` は Supabase 実体の完全な schema 定義ではなく、アプリ利用向け型
- `teams` は新しめの表現で、`team_a` / `team_b` は互換性のために残っている可能性がある

## Open Questions

- RLS、index、trigger、constraint の全体像
- `matches.status` と `processing_status` の正式状態遷移
- points の `result_type` の正式な語彙表
