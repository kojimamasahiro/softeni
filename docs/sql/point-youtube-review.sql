-- Point-linked YouTube review support
-- Apply this to the Supabase project before using point-linked video review.

alter table public.matches
  add column if not exists youtube_video_id text null,
  add column if not exists youtube_url text null,
  add column if not exists youtube_embed_allowed boolean null;

alter table public.points
  add column if not exists video_start_ms integer null,
  add column if not exists video_end_ms integer null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'points_video_range_check'
  ) then
    alter table public.points
      add constraint points_video_range_check
      check (
        video_start_ms is null
        or video_end_ms is null
        or video_start_ms <= video_end_ms
      );
  end if;
end $$;
