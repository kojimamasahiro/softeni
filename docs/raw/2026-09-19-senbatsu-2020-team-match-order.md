# 高校選抜 2020年度（第46回）男女 団体戦のオーダー取り込み（2026-09-19）

## やったこと

出典 PDF: `46-senbatu-kekka.pdf`（愛知県高体連。`information` の `sourceUrl` どおり）。
**2ページで p1 が男子・p2 が女子**、中身は **JSTA 記録と同じ Excel 様式**だった
（出典元は違っても様式は同じ。[2021 のノート](./2026-09-19-senbatsu-2021-team-match-order.md) 参照）。
`highschool_senbatsu_team_matches.py` が**改修も補正も無しで、男女とも一発で通った**。

```
python3 scripts/pdf/highschool_senbatsu_team_matches.py 46-senbatu-kekka.pdf --page 1 \
    --details data/tournaments/details/highschool-senbatsu/2020/team-none-boys.json --write
python3 scripts/pdf/highschool_senbatsu_team_matches.py 46-senbatu-kekka.pdf --page 2 \
    --details data/tournaments/details/highschool-senbatsu/2020/team-none-girls.json --write
```

**これで高校選抜は 2020〜2025 の全6年度・男女とも揃った**（12ファイル × 35試合 = 420試合）。

## 検算

| 検算 | 男子 | 女子 |
|---|---|---|
| 塊35件・各3対戦／エントリー行36件 | 一致 | 一致 |
| 勝ち数＝既存の本数（35試合） | 全一致 | 全一致 |
| 同じ選手が2校に現れない | 0件 | 0件 |
| 学校の2試合目以降で前の試合と選手が重なる | **34/34** | **34/34** |
| 本数がソフトテニスとして成立するか | 逸脱0件 | 逸脱0件 |
| 既存データの本数の和が4以上 | 0件 | 0件 |
| `not_played` の数＝2-0 で決着した試合の数 | 8＝8 | 9＝9 |

**既存の本数に誤りは無かった**（2024 女子・2021 女子では各1件見つかっていた）。
`npm run check:team-match-details` は投入後 785試合 / 2355対戦 問題なし。

## 名前だけの選手が多い（男子75・女子64）

他の年度（2024 男子30）より多い。理由は**この年度の個人戦の記録を持っていない**こと
（`details/highschool-senbatsu/2020/` には `team-*.json` しか無い）。
結び付けは他の大会の個人戦の記録に頼るので、当たらない選手が増える。
後から個人戦が入れば再実行で姓・名に変わるので、そのままでよい。

## 統合候補: `近大高専` ↔ `近畿大学高専`（報告のみ）

男子の `近大高専` は**延べ12のうち6名すべてが名前だけ**。個人戦に `近大高専` の記録は**0件**で、
`近畿大学高専` に36件・`近畿大学工業高等専門学校` に2件ある。
`data/tournaments/team-name-aliases.json` は **`近畿大高専` を `近畿大学高専` の別名にしているが、
`近大高専`（「畿」なし）は入っていない**。

`近大高専` を使っているファイル（2026-09-19 時点で4件）:
`highschool-senbatsu/2020/team-none-boys.json`、同 `2023`、同 `2025`、
`highschool-tokai-block/2026/team-none-boys.json`。

**チームの統合は人が判断する（[ADR-019](../adr/ADR-019-team-merge-human-only.md)）ので、
何も変えていない。** 別名に足すかどうかは別途。

## 未了

- 高校選抜は**全年度投入済み**。次に広げるなら別の大会
  （全中・インカレはドローPDFにオーダーが無いことを確認済み）。

## Compile Log

- wiki（`data-model.md` / `data-import.md`）へ: 収録範囲を 2020〜2025 に。
- skill（`team-match-order`）へ: 高校選抜の行を「全年度投入済み」に。
- **載せなかった**: 2020 固有の知見は無い（様式も検算も 2021 と同じ）。出典元が違っても
  様式が同じことがある、という1点だけ wiki の「出典で様式が分かれる」節に添えた。
- **載せなかった**: 名前だけが多い理由。年度ごとの収録状況の話で、再実行すれば自然に解ける。
