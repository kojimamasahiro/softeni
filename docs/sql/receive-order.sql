-- Receive order support (ポイント入力の自動推定用)
-- Apply this to the Supabase project before using receive-order based auto-fill.
--
-- 背景: games にはサーブ順（initial_serve_player_index）しか無く、レシーブ順が無かったため、
-- 「レシーブ失敗のとき誰が失敗したか」を自動入力できなかった。
-- ゲーム開始時に「第1ポイントのレシーバー」を記録し、以降は交互として算出する。

alter table public.games
  add column if not exists initial_receive_player_index integer null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'games_initial_receive_player_index_check'
  ) then
    alter table public.games
      add constraint games_initial_receive_player_index_check
      check (
        initial_receive_player_index is null
        or initial_receive_player_index in (0, 1)
      );
  end if;
end $$;

comment on column public.games.initial_receive_player_index is
  'ゲームの第1ポイントでレシーブする選手のインデックス（0 or 1）。null は未設定＝0 とみなす。';
