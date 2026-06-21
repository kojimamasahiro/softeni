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

**STリーグⅢ の位置付け**: Ⅲ部はⅡ部昇格を目指すチームが集う、STリーグの土台となる階層。
多数の地域チームが参加し大会データの収集が難しいため、当サイトでは**階層構成（Ⅰ・Ⅱ・Ⅲ）の
中での位置付けを紹介する**扱いとし、対戦データ・順位表は持たない。将来データを埋める前提の
「準備中」ではない点に注意。`league.json` の Ⅲ部は `hasMatchData: false` とし、`getDivisions()`
が試合結果/チーム/分析ページから除外する。

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
- `/st-league/[year]` … 年度ハブ（年度トップ）。`league.json` のメタ＋`editions.json` の王者（表示名）を読み、
  大会概要（開催回・日程・会場・リーグ構成・対戦/ゲーム形式）／優勝チーム（男女、championsへ）／
  各サブページ（matches/teams/analysis）への導線／プレーオフ案内を描画する。集計ロジックは不要。
  狙うキーワードは「STリーグ {年}」「第N回STリーグ 結果・会場」。**matches とのカニバリ回避のため、
  順位表・対戦結果は再掲せず matches へ委譲し、本ページは概要＋導線に限定する**（intent 分離）。
  SportsEvent 構造化データを出力。`getStaticProps` を持つため sitemap は自動列挙（`additionalPaths` 不要）。
  内部リンク: ハブの年度カード見出し→年度ハブ、championsの各回ダイジェスト→年度ハブ、
  各サブページのパンくず（`STリーグ > {year} > 各ページ`）→年度ハブ、matches の他ページ導線→年度ハブ。
- `/st-league/[year]/matches` … 男女タブ＋リーグ切替。順位表（昇降格ゾーンの目安表示）＋対戦結果＋プレーオフ案内。SportsEvent構造化データ。
- `/st-league/[year]/teams` … 男女タブ＋リーグ切替。チーム別年間成績・選手成績。
  選手成績は `aggregateTeamResults`（`data/tournaments/details/` の一般大会データ）を
  participants.json のチーム名・選手名で照合して集計する（STリーグ本体の `matches.json` とは
  別系統。STリーグ内の勝率は analysis ページが `matches.json` から算出）。照合は
  `normalizeJa()`（NFKC で半角/全角、簡易な異体字フォールドで `ＥＮＥＯＳ⇄ENEOS`・`髙濵⇄高濱`
  等を吸収）。一般大会の個人戦データが無い選手（主にⅡ部）は0表示のまま。
- `/st-league/[year]/analysis` … 男女タブ＋リーグ切替。選手別スタッツ・勝率ランキング。
- `/st-league/champions` … 歴代優勝・記録ページ（年度横断の常緑コンテンツ）。`editions.json` の
  `editions[]`（男女王者・会場・note）と `promotionRelegation[]`（昇降格の系譜）を読んで描画する。
  集計ロジックは不要（既存JSONを並べるだけ）。構成: 歴代王者表（男女）／記録ハイライト（連覇など）
  ／昇降格の系譜／各回ダイジェスト＋各年度 matches への内部リンク。ItemList 構造化データを出力。
  `getStaticProps` を持つため sitemap は自動列挙される（`additionalPaths` には追加しない）。
  狙うキーワードは「STリーグ 歴代優勝」「優勝チーム 一覧」「昇格 降格」など、速報系競合が手薄な常緑層。

すべての `[year]` ページは `getStLeagueYears()` でパスを動的生成するため、`data/st-league/{year}/` を追加すれば自動でページが増える。

## SEO / UX

- ハブ: ItemList 構造化データ（開催年度一覧）。h1 は「STリーグ 結果・順位表・出場チーム」（
  「STリーグとは」の解説は `/st-league/about` に集約し、ハブとのキーワード重複を避ける）。
- matches: SportsEvent 構造化データ（日程・会場・主催）。
- 全ページでパンくず（`Breadcrumb` コンポーネント）が BreadcrumbList 構造化データを出力する。
- リーグ切替・男女タブはページ内 state で切り替えるが、**全 gender×division（＋プレーオフ）の
  パネルを最初から HTML に出力し、非アクティブなパネルは CSS（Tailwind `hidden`）で隠す**。
  これにより女子・Ⅱ部・プレーオフ・選手成績など全タブの内容が静的 HTML に含まれ、クローラーが
  インデックスできる（旧実装は active タブのみ描画していたため非 active の内容が HTML に出なかった）。
  URL は従来どおり年度単位で静的（タブは URL に持たない）。
  - 実装メモ: 各 `[year]` ページは 1 パネル分を描画する純コンポーネント（`MatchesPanel` /
    `StatsPanel` 等）または純関数（`computePlayerStats`）に切り出し、props だけで計算して
    全組み合わせを描画する。対戦詳細の開閉 state（matches）はパネルをまたいで衝突しないよう
    `${gender}-${divisionId}-${matchId}` をキーにする。
- 順位表に「昇/降」バッジで入替戦対象の目安を表示（最上位は降格のみ、最下位は昇格のみ）。

### sitemap

- `next-sitemap`（`output: export` 構成）は `getStaticProps` を持たない純静的ページを自動列挙しない。
  そのため `/about` `/contact` `/faq` `/privacy` `/st-league/about` は
  `next-sitemap.config.js` の `additionalPaths` で明示的に補っている（動的/SSG ページは自動列挙
  されるので追加しない＝重複防止）。新たに純静的な公開ページを追加したらこのリストにも足すこと。

## データ追加手順（新年度・新リーグ）

1. `data/st-league/{year}/league.json` を作成（divisions・playoff・results）。
2. `participants.json` に各チーム（`division` 付き）と選手を追加。
3. `matches.json` に各試合（`division` 付き）を追加。
4. 必要に応じ `editions.json` に開催回・昇降格を追記。

## Open Questions / 未入力データ

- STリーグⅢ は階層構成の中での位置付けを紹介する扱いとし、対戦データは持たない方針（上記「STリーグⅢ の位置付け」参照）。
  「準備中」の TODO ではないため、データ収集対象には含めない。
- STリーグⅡ（女子）の出場チーム・対戦データは未入力（公式PDFからの手入力が必要）。`league.json` の
  該当 division は `hasMatchData: false`、ページ上は「準備中」表示。
- 年度間の昇降格の確定情報（`editions.json` の `promotionRelegation` は一部 Assumption）。
- NTT西日本の連覇数など個別記録の裏取り。

詳細は `docs/wiki/open-questions.md` を参照。
