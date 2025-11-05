-- ゲームテーブルに初期サーブ選手のインデックスを追加
ALTER TABLE games ADD COLUMN initial_serve_player_index INT DEFAULT 0;

-- initial_serve_player_indexは0または1の値を持つ（0=1番目の選手、1=2番目の選手）
-- シングルスの場合は常に0
-- ダブルスの場合は0または1で初期サーブ選手を指定