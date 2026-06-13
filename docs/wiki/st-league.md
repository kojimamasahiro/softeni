# STリーグ ページ / データモデル

STリーグ（ソフトテニス実業団リーグ）の公開ページとデータ構造に関するwiki。

## 概要

STリーグは日本ソフトテニス連盟（JSTA）が主催する実業団リーグ戦。男女それぞれが
**STリーグⅠ・Ⅱ・Ⅲ** の階層に分かれ、各リーグ内で総当たり戦を行う。リーグ戦後の
**プレーオフ（入替戦）** で昇格・降格が決まる。

- 第1回: 2023年（令和5年）
- 第2回: 2024年（令和6年）
- 第3回: 2025年（令和7年、栃木県宇都宮市・日環アリーナ栃木）

## ディレクトリ構成

```
data/st-league/
  editions.json            ... 全体概要・開催回・年度間の昇降格（履歴）
  {year}/
    league.json            ... その回のメタ情報（開催回/会場/division構成/プレーオフ/成績）
    participants.json      ... 出場チーム・選手（チームごとに division を持つ）
    matches.json           ... 対戦結果（試合ごとに division を持つ）
```

### division フィールド

参加チーム・各試合は `division`（`"1"`/`"2"`/`"3"`）を持つ。`"1"` が最上位（STリーグⅠ）。
未設定の旧データは `"1"` とみなす（`divisionOf()`）。

### league.json の主なキー

- `edition` / `title` / `period` / `venue` / `location`
- `format` … tie（3本勝負の順序）、game（7ゲームマッチ）
- `playoff` … 入替戦の名称・日程・会場・説明
- `divisions[]` … `{ id, name, rank, teamCount, note, hasMatchData }`
- `results` … division別・男女別の優勝/準優勝/3位（teamId）

## 共有モジュール

`src/utils/st-league.ts` に型定義・ローダー・順位計算を集約。

- `getStLeagueYears()` … 年度ディレクトリ一覧（降順）
- `loadLeagueMeta(year)` / `loadParticipants(year)` / `loadMatches(year)`
- `getDivisions(meta)` … rank昇順のdivision一覧（無ければ既定のⅠ/Ⅱ/Ⅲ）
- `computeRanking(teams, matches)` … 勝数→直接対決→得失点差→得点で順位決定
- `divisionOf(item)` / `buildPlayerMap(teams)`

## ページ

- `/st-league` … ハブ。年度・リーグ構成の概要、各年度への導線。`getStLeagueYears()`で動的生成。
- `/st-league/about` … ルール・Ⅰ/Ⅱ/Ⅲ構成・プレーオフの解説。
- `/st-league/[year]/matches` … 男女タブ＋リーグ切替。順位表（昇降格ゾーンの目安表示）＋対戦結果＋プレーオフ案内。SportsEvent構造化データ。
- `/st-league/[year]/teams` … 男女タブ＋リーグ切替。チーム別年間成績・選手成績。
- `/st-league/[year]/analysis` … 男女タブ＋リーグ切替。選手別スタッツ・勝率ランキング。

すべての `[year]` ページは `getStLeagueYears()` でパスを動的生成するため、`data/st-league/{year}/` を追加すれば自動でページが増える。

## SEO / UX

- ハブ: ItemList 構造化データ（開催年度一覧）。
- matches: SportsEvent 構造化データ（日程・会場・主催）。
- リーグ切替・男女タブはページ内JS（クライアント）で完結し、URLは年度単位で静的。
- 順位表に「昇/降」バッジで入替戦対象の目安を表示（最上位は降格のみ、最下位は昇格のみ）。

## データ追加手順（新年度・新リーグ）

1. `data/st-league/{year}/league.json` を作成（divisions・playoff・results）。
2. `participants.json` に各チーム（`division` 付き）と選手を追加。
3. `matches.json` に各試合（`division` 付き）を追加。
4. 必要に応じ `editions.json` に開催回・昇降格を追記。

## Open Questions / 未入力データ

- STリーグⅡ・Ⅲ の出場チーム・対戦データ（公式PDFからの手入力が必要）。`league.json` の
  該当 division は `hasMatchData: false`、ページ上は「準備中」表示。
- 年度間の昇降格の確定情報（`editions.json` の `promotionRelegation` は一部 Assumption）。
- NTT西日本の連覇数など個別記録の裏取り。

詳細は `docs/wiki/open-questions.md` を参照。
