-- Softeni Pick Score growth analysis metadata.
-- This repository does not currently own a migration runner, so apply this SQL
-- to the Supabase project before using the completed growth-analysis write UI.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'match_status') then
    create type match_status as enum ('draft', 'in_progress', 'completed', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'opponent_level') then
    create type opponent_level as enum ('stronger', 'same', 'weaker', 'unknown');
  end if;
end $$;

alter table public.matches
  add column if not exists match_date date,
  add column if not exists court_name text,
  add column if not exists status match_status not null default 'draft',
  add column if not exists completed_at timestamptz,
  add column if not exists opponent_level opponent_level not null default 'unknown',
  add column if not exists source_site_match_id text,
  add column if not exists source_site_tournament_id text;

create index if not exists matches_growth_completed_idx
  on public.matches (status, completed_at, match_date, created_at);

create index if not exists matches_growth_source_idx
  on public.matches (source_site_tournament_id, source_site_match_id);
