# 大学カテゴリ（/university）

2026-09-13 追加。**中身は「高校 → 大学」の進路だけ**で、小中高のような「都道府県 → チーム」のツリーは持たない。

経緯: [raw/2026-08-12-idea-university-category-pages.md](../raw/2026-08-12-idea-university-category-pages.md)（検討・保留）→
[raw/2026-08-14-highschool-pathway-sections-design.md](../raw/2026-08-14-highschool-pathway-sections-design.md)（節の並べ方・案A）→
[raw/2026-09-13-university-pathways-verification.md](../raw/2026-09-13-university-pathways-verification.md)（検証と実装）

## 小中高と構成が違う理由

- **地域軸が無い**。大学の `participants[].prefecture` は `日本学連` / `学連` という連盟名で、
  都道府県ページを作れない。ツリーにしても `/university/[teamId]` 135枚が横一列に並ぶだけになる
- 一方で**高校とのつながりは強い**（進路2,050件。中学→高校の約4倍）。
  高校の既存の学校ページに節を足すほうが、新しいツリーを作るより効く
- 中学カテゴリの判断を引き継ぎ、**ランキング・順位づけのページは作らない**。
  **大会軸のページも作らない**（インカレ・王座・インドアは既存の `/tournaments/university/[tournamentId]/` へ。ADR-010）

## ルーティング

| URL | 内容 | 件数 |
|---|---|---|
| `/university/` | 入口。男女の出身高校一覧・大会ハブ・大学一覧（男女別の人数つき）への導線 | 1 |
| `/university/pathways/[gender]/` | 大学別の出身高校（男子101校・1,190名 / 女子98校・860名） | 2 |

- 出身高校一覧は**大学が主語**（中学版 `/secondaryschool/pathways/` は高校が主語）。
  大学の個別ページ（`/teams/[teamId]`）は収録の多い38校にしか無く、それ以外の大学はこの一覧が「{大学名} ソフトテニス部」の受け皿になるため
- **男女別URL**は中学版と同じ理由（高校の学校ページが男女別で、そこから同じ性別のページへ送る）
- 大学ごとの見出しに `id="u-{大学名}"` のアンカーを付け、高校の学校ページからはそこへ直接飛ばす
- `/teams/[teamId]` があれば見出しの大学名からリンクする（`team-name-mappings.json` で引く）。`/university/` の大学一覧も同じ
- ナビは「カテゴリから探す」の 小学生 → 中学生 → 高校生 → **大学生** の順（`lib/navigation.ts`）。
  トップページの「カテゴリから探す」も同じ4枚・同じ順
- analytics の `page_type` は `univ_top` / `univ_pathways`（`lib/analytics.ts`）

## 進路（高校 → 大学）

生成は `scripts/build-university-pathways.mjs` → `data/university/pathways.json`（大学名をキーにしたレコード配列）。
`npm run university:pathways`。`prebuild` の最後で毎回再生成する。読み込みは `lib/university.ts`。

対象大会:

- 高校: `highschool-championship` / `highschool-japan-cup` / `highschool-senbatsu`
- 大学: `zennihon-university` / `zennihon-university-indoor` / `zennihon-university-ouza`

採用条件（[ADR-014](../adr/ADR-014-pathway-name-match.md) を適用。追記節に差分）:

1. **高校の最終出場年 < 大学の初出場年 <= 高校の最終出場年 + 4**（`MAX_YEAR_GAP = 4`）
2. **同姓同名として検出された氏名を除外**（中学版と同じ `buildHomonymSet`。全大会で37件）
3. **性別が食い違う一致を除外**（高校で女子・大学で男子なら別人。2026-09-13 時点で1件）
4. 大学側の所属名が大学・短大・高専・専門学校に見えないもの（選手名がチーム名になっている取り込み事故）を除外

年差4年は中学・小学版と違い**実測で決めた**。時系列上ありえない一致から偶然一致の率を出すと、
誤マッチの期待値は年差4年以下で0.9%、5年で約10%、6年で約18%に跳ねる。詳細は検証ノート。

2026-09-13 実測: 両方に出る氏名2,129 → **採用2,050**（ペア継続89 / 氏名一致のみ1,961）、
135校、高校×性別414グループ。不採用は年差超54・同姓同名12・性別不一致1・大学名でない3。

> **Assumption**: 県一致が使えないため、**氏名一致のみが96%**を占める（中学→高校は41%、小学→中学は6.8%）。
> 安全弁は同姓同名の除外・年差・性別の3つだけ。推定誤マッチは約20件（1%程度）で、個別には特定できていない。

`basis`（`pair` / `name`）を残しているが UI には出さない。

### 高校の学校ページの「進路」節（案A）

`/highschool/[gender]/[prefectureId]/[teamId]` の「出身中学」と「進学先大学」を
**「{高校名}の選手の進路」1節**にまとめ、h3 で「出身中学」「進学先大学」に分けた。
「主な卒業生」は実績で絞ったハイライトとして**別の節のまま残し**、説明文に掲載条件
（全日本の大会でベスト8以上・STリーグ出場・国際大会出場）を明記した。

- 進路節は主な卒業生の**上**に置く（網羅 → ハイライトの順）
- 「主な卒業生」と「進学先大学」の両方に出る選手は **136人＝主な卒業生277件の49%**。
  マークで重複を示すことはせず、説明文で役割を分けている
- 進学先大学が付くのは **1,101グループ中409（37%）**、進路節全体では431
- FAQ に「{高校名}の選手はどの大学に進学していますか？」を追加（進学先がある学校のみ）

### 小 → 中 → 高 → 大

中学→高校の進路にも出ていて、高校名が一致する選手は **234名**（2026-08-14 時点では0名。
インカレ2026と過去年度の投入で成立した）。`/university/` に人数を出している。

## 大学の個別ページ（`/teams/[teamId]`）

**大学の個別ページは `/university/[teamId]` ではなく、既存の `/teams/[teamId]` 型に寄せる**（2026-09-14 決定）。
もともと日本体育大学（`/teams/nssu/`）だけが `team-name-mappings.json` 経由で個別ページを持っていたので、それに揃えた。

- 対象: `teams.json` で大学名・都道府県 null・**収録試合数100以上の39表記＝38校**（神戸松蔭の2表記を1校に）。
  `nssu` 以外の37校を追加。ID は `<ローマ字>-univ`（例 `waseda-univ` `kwansei-gakuin-univ` `kobe-shoin-univ`）で手書き
- 生成されるもの: `/teams/[teamId]/`（年度別メンバー・大会別成績・FAQ）と `/teams/[teamId]/[year]/[gender]/`。
  37校で**551ページ**（うち年度別で試合5未満が92枚）。集計は大学大会に限らず全収録大会
- 照合は mapping の完全一致。略称は実データにある `四国大` `九州産業大` だけ足した。
  `早稲田大学A` のような団体戦のチーム分け表記（1〜2試合）は入れていない
- 改称: `kobe-shoin-univ` は `神戸松蔭大学`（現称・表示名）と `神戸松蔭女子学院大学` を束ねる。
  `/teams` 上では1校になるが、`/university/pathways/` の進路データは表記単位のまま2つ並ぶ
- 導線: 大学のチームページに「{大学名}の選手の出身高校（男子/女子）」を出す（進路データに名前がある mapping チームのみ。
  `getUniversityPathwayLinks`）。`/teams` 一覧・`/university/` の大学一覧・出身高校一覧の見出しからは個別ページへ
- ビルド: 1ページあたり集計約90ms、551ページで**約50秒増**の見積もり（未実測）
- 残り（100試合未満の大学）は、効果を見てから閾値を下げるか決める。50以上なら75校

## 既知の課題

- **改称した大学が別々に並ぶ**: `神戸松蔭女子学院大学` / `神戸松蔭大学`（2025年改称）、
  `神戸親和女子大学` / `神戸親和大学`。どちらの表記も正しいので名寄せでは寄せていない。
  1校にまとめるかは [open-questions.md](./open-questions.md)。`/teams/kobe-shoin-univ/` では束ねた（上記）。神戸親和は100試合未満で個別ページの対象外
- `淑徳大学` → `愛知淑徳大学`？、`日本大学工学部` の扱いは未確認
  （[raw/2026-08-12-university-team-name-cleanup.md](../raw/2026-08-12-university-team-name-cleanup.md)「保留中」）
- 大学の地域軸（学連9地区）・リーグ戦データは未着手（個別ページは `/teams/[teamId]` 型に寄せたので、地域軸はツリーのためには不要になった）

## 関連

- [highschool.md](./highschool.md) — 学校ページ（進路節・主な卒業生）
- [secondaryschool.md](./secondaryschool.md) — 中学 → 高校の進路（流用元）
- [primaryschool.md](./primaryschool.md) — 小学 → 中学の進路
- [public-pages.md](./public-pages.md) — ナビ・ルーティング
- [ADR-014](../adr/ADR-014-pathway-name-match.md) — 進路の採用条件
