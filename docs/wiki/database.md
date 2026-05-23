# Database

## 概要

- Supabase を利用
- ただし依頼に含まれていた `supabase/schema.sql` は未検出
- そのため本ページは `src/types/database.ts` と `src/pages/api/matches/**` から復元した初期メモ

## 接続設定

主な環境変数:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- テスト用:
- `NEXT_PUBLIC_SUPABASE_TEST_URL`
- `NEXT_PUBLIC_SUPABASE_TEST_ANON_KEY`
- `SUPABASE_TEST_SERVICE_KEY`

主なコード:

- `lib/supabase.ts`
- `lib/supabaseClient.ts`

## 推定テーブル

### `matches`

主な列:

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
- `created_at`
- `match_date`
- `court_name`
- `youtube_video_id`
- `youtube_url`
- `youtube_embed_allowed`
- `status`
- `completed_at`
- `opponent_level`
- `source_site_match_id`
- `source_site_tournament_id`
- チーム A/B のフラット列群
- `teams` JSON
- `team_a`
- `team_b`

### `games`

主な列:

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

主な列:

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
- `created_at`
- `point_note`
- `shot_type`
- `shot_course`
- `recording_level`
- `edited_at`
- `point_detail`
- `video_start_ms`
- `video_end_ms`

### `match_video_sessions`

主な列:

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

主な列:

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

## 推定リレーション

- `matches.id -> games.match_id`
- `games.id -> points.game_id`
- `matches.id -> match_video_sessions.match_id`
- `match_video_sessions.id -> match_point_candidates.session_id`

## 運用メモ

- `matches.teams` は構造化 JSON
- 同時に `team_a`, `team_b` とフラット列も保持しており、後方互換または表示最適化の意図がある
- ポイント編集時にゲーム集計を再計算するため、`games.points_a / points_b / winner_team` は派生値に近い

## Assumption

- DB の真のソースは Supabase 上にあり、`src/types/database.ts` はそれを人手同期した型
- 厳密な制約、index、RLS、trigger はコードからは把握不可
- `teams` JSON は将来的にフラット列からの移行先として扱われている可能性がある

## Open Questions

- 実際の SQL スキーマはどこで管理しているか
- RLS の有無とポリシー
- `matches.status` の正式な状態遷移
- `points.result_type` / `processing_status` の正式 enum 定義
