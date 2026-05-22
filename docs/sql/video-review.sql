-- Video-assisted Score Input MVP
-- Apply this to the Supabase project before using the video review flow.

create table if not exists public.match_video_sessions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  source_type text not null check (source_type in ('youtube', 'upload')),
  source_url text null,
  source_label text null,
  youtube_video_id text null,
  upload_file_name text null,
  upload_file_size bigint null,
  duration_ms integer null check (duration_ms is null or duration_ms > 0),
  processing_status text not null default 'draft'
    check (processing_status in ('draft', 'ready', 'processing', 'reviewing', 'committed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz null default now()
);

create index if not exists match_video_sessions_match_id_idx
  on public.match_video_sessions (match_id, created_at desc);

create table if not exists public.match_point_candidates (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.match_video_sessions(id) on delete cascade,
  candidate_order integer not null check (candidate_order > 0),
  start_ms integer not null check (start_ms >= 0),
  end_ms integer not null check (end_ms > start_ms),
  confidence numeric(4, 2) null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'excluded')),
  winner_team text null check (winner_team in ('A', 'B')),
  serving_team text null check (serving_team in ('A', 'B')),
  serving_player text null,
  rally_count integer null check (rally_count is null or rally_count >= 0),
  first_serve_fault boolean null default false,
  double_fault boolean null default false,
  result_type text null,
  winner_player text null,
  loser_player text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null default now()
);

create unique index if not exists match_point_candidates_session_order_idx
  on public.match_point_candidates (session_id, candidate_order);

create index if not exists match_point_candidates_session_status_idx
  on public.match_point_candidates (session_id, status, candidate_order);
