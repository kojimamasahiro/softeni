# Database

> 現行仕様。2026-08-12 に `src/types/database.ts` と列単位で突き合わせ済み
> （差分は `games.initial_receive_player_index` の1件のみで、反映済み）。
> ただし制約・index・RLS・trigger はコードから読めないため、そこは推定のまま。

## 概要

- Supabase を利用
- リポジトリに `supabase/schema.sql` のような**スキーマ全体の定義は無い**。
  機能追加時の差分 DDL だけが `docs/sql/*.sql` に手動適用用として置かれている。
  適用状態は [docs/sql/APPLIED.md](../sql/APPLIED.md) が唯一の記録場所
- そのため本ページは `src/types/database.ts`・`src/pages/api/matches/**`・`docs/sql/**` から
  復元した推定スキーマ（実体は Supabase 側が正）

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

## テーブル

列は `src/types/database.ts` と一致していることを確認済み（2026-08-12）。

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
- `initial_receive_player_index`（0 or 1 / null。第1ポイントのレシーバー。2026-08-11 追加、
  適用 DDL は `docs/sql/receive-order.sql`。ポイント入力の自動推定に使う。詳細は
  [score-feature.md](./score-feature.md)「入力時の自動推定」）
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

## リレーション

- `matches.id -> games.match_id`
- `games.id -> points.game_id`
- `matches.id -> match_video_sessions.match_id`
- `match_video_sessions.id -> match_point_candidates.session_id`

## 運用メモ

- `matches.teams` は構造化 JSON
- 同時に `team_a`, `team_b` とフラット列も保持しており、後方互換または表示最適化の意図がある
- ポイント編集時にゲーム集計を再計算するため、`games.points_a / points_b / winner_team` は派生値に近い

## Assumption

- DB の真のソースは Supabase 上にあり、`src/types/database.ts` はそれを人手同期した型。
  ズレても検出する仕組みは無い
- 厳密な制約、index、RLS、trigger はコードからは把握不可
- `teams` JSON は将来的にフラット列からの移行先として扱われている可能性がある

## Open Questions

- `receive-order.sql` が本番 Supabase に適用済みか未確認
  （台帳は [docs/sql/APPLIED.md](../sql/APPLIED.md) に用意した。適用したら記入する）
- RLS の有無とポリシー
- `matches.status` の正式な状態遷移
- `points.result_type` / `processing_status` の正式 enum 定義
