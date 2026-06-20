# 2026 コリアカップ ソフトテニス大会 — 大会結果ツール入力JSON

開催: 2026/6/15(月)〜22(月)。掲示された組み合わせ表（写真）から、大会結果ツールへ渡す入力JSONを種目別に作成。

## 共通仕様
- 国際選手は **ローマ字名 + 国コード(JPN-5 / KOR-2 / TPE-1 等)** で登録。`team` フィールドに国コードを格納、`prefecture` は空。
- `lastName` = 先頭トークン、`firstName` = 残り（例: `YOSHINO MAMI` → 姓YOSHINO/名MAMI）。`tempId` は `姓_名_国コード`。
- ペアで国コードが異なる場合（例: JPN-9 / KOR-10）は各選手にそれぞれの国コードを付与。

## ファイル一覧

| ファイル | 種目 | 形式 | 件数 |
|---|---|---|---|
| 01_mens_team.json | 男子団体 | トーナメント(team) | 17チーム(+bye=計32枠) |
| 02_womens_team.json | 女子団体 | トーナメント(team) | 15チーム(+bye=計16枠) |
| 03_mixed_team.json | 混成団体 | トーナメント(team) | 7チーム(+bye=計8枠) |
| 04_mens_singles_A.json | 男子個人単式 A | トーナメント(singles) | 58 (No.1–58) |
| 05_mens_singles_B.json | 男子個人単式 B | トーナメント(singles) | 58 (No.59–116) |
| 06_womens_singles_A.json | 女子個人単式 A | トーナメント(singles) | 48 (No.1–48) |
| 07_womens_singles_B.json | 女子個人単式 B | トーナメント(singles) | 49 (No.49–97) |
| 08_mixed_doubles.json | 混合複式 | トーナメント(doubles) | 42 (No.1–42) |
| 09_womens_doubles_groups_A-L.json | 女子個人複式 | ラウンドロビン(グループ別) | 12グループ(A–L)・id連番1〜47 |
| 10_mens_doubles_groups_A-P.json | 男子個人複式 | ラウンドロビン(グループ別) | 16グループ(A–P) |
| 11_mens_doubles_final_tournament.json | 男子個人複式 決勝T | トーナメント(doubles) | 32ペア・id=予選entryId |
| 12_womens_doubles_final_tournament.json | 女子個人複式 決勝T | トーナメント(doubles) | 24ペア+8bye(計32枠)・id=予選entryId |

## 使い方
- **トーナメント系**(01〜08): フラット配列。`tools/tournament3` 等の `initialPlayers` 形式。配列順がドロー上から下の並び。隣り合う2件が1回戦の対戦。
- **ラウンドロビン系**(09・10): `tools/roundrobin` の `initialPlayersByGroup` 形式（グループ名→エントリー配列のオブジェクト）。

## bye（1回戦免除）の扱い ※要確認
- **団体3種目(01〜03)**: 組み合わせ表の線を読み取り、byeを正確な位置に配置済み（JAPAN/JAPAN等が1回戦免除の構造を反映）。
- **個人単式・混合複式(04〜08)**: ドロー番号順そのままで出力し、**byeは入れていません**（写真からシード位置のbyeを正確に判別できなかったため）。ツール上で「パッキン」機能を使って1回戦免除を設定してください。番号順は表どおりです。
- **ラウンドロビン(09・10)**: 総当たりのためbye不要。

## 補足
- 男子個人複式: 全グループ A〜P 作成済み。
- 女子個人複式: 全グループ A〜L 作成済み（id連番 1〜47。A〜H=1〜31、I〜L=32〜47）。
- 決勝トーナメント(11・12)の `id` は予選ラウンドロビンの entryId をそのまま継承（ペアに紐付け）。女子は24ペアのため8byeを挿入した32枠。

ローマ字の細部（綴り）は写真からの判読のため、最終確認をおすすめします。
