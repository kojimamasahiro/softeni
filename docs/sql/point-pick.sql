-- 記録中のピック（主観で「すごい」と思った1本）
-- 記録画面の「ピック」ボタンで使う。公開サイト（静的 JSON）には書き出さない
-- （scripts/generate-beta-matches-json.mjs で除外）。
-- Apply this to the Supabase project before using the pick button.

alter table public.points
  add column if not exists is_pick boolean not null default false,
  add column if not exists pick_note text null;
