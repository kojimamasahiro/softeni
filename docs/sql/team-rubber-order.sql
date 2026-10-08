-- Team match rubber order (団体戦の第何対戦か)
-- Apply this to the Supabase project before creating team-match rubbers on /beta/matches/create.
--
-- 背景: 団体戦の1試合（例: 実業団リーグ決勝）は第1〜第3対戦の3試合を score で別々に記録する。
-- 同じエントリー番号の組が3件並ぶため、どの対戦かを区別する列が要る（ADR-023）。
-- 個人戦の試合では null。

alter table public.matches
  add column if not exists team_rubber_order integer null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_team_rubber_order_check'
  ) then
    alter table public.matches
      add constraint matches_team_rubber_order_check
      check (
        team_rubber_order is null
        or team_rubber_order between 1 and 3
      );
  end if;
end $$;

comment on column public.matches.team_rubber_order is
  '団体戦の対戦の順（1〜3＝第1〜第3対戦）。団体戦の1対戦として記録した試合だけが持つ。個人戦は null。';
