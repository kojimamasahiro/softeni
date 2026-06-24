# Data Model

## 概要

このリポジトリでは、少なくとも次の 2 系統のデータを扱っています。

- 静的 JSON: `data/**`, `public/data/**`
- Supabase: score 機能の動的データ

## 静的 JSON

### 大会データ

主な配置:

- `data/tournaments/index.json`
- `data/tournaments/local_index.json`
- `data/tournaments/information/*.json`
- `data/tournaments/details/**`
- `data/local-sources/prefecture-sources.json`
- `data/local-sources/detected-documents.json`
- `data/local-sources/ignored-documents.json`

関連ドキュメント:

- `docs/tournament-data-structure.md`

現行の source of truth:

- 大会一覧・世代・地域紐付け: `index.json`, `local_index.json`
- 年度情報・開催地・外部リンク・カテゴリ表示名: `information/*.json`
- 結果本体: `details/**`
- 地方大会巡回元 URL: `data/local-sources/prefecture-sources.json`

地方大会候補検知ストア:

- `detected-documents.json`
  巡回で見つけた候補リンクの確認用ストア
- `ignored-documents.json`
  `prefectureSlug + normalizedUrl` 完全一致で除外する恒久 deny list

注意:

- `detected-documents.json` の `accepted` は確認済み候補を意味するだけで、公開データ反映済みは意味しない

## Deprecated

- `data/tournaments/{all,corporate,highschool,international-qualifier,junior,masters,university}/**`
  旧構造の `meta.json` / `entries` / `matches` / `results` / `categories.json`
  現行実装では canonical source ではない
- `data/players/*/summary.json`
  選手プロフィールの注目ポイント表示は廃止され、現行実装では参照しない
- `data/players/*/results.json`
  選手別結果の旧中間データ。現行運用では廃止し、ファイルも削除した

### 選手データ

主な配置:

- `data/players/index.json`
- `data/players/*/information.json`
- `data/players/*/analysis.json`

実装メモ:

- `/players/[slug]` のプロフィールページは `data/players/{slug}/information.json` を必須で参照する
- 同ページは `analysis.json` があれば最新試合情報を表示する
- 同ページの `/players/[id]/results` 導線は `data/players/index.json` の `count >= 5` のときだけ表示する
- `/players/[id]/results` の試合結果ページは `data/players/{slug}/results.json` を直接は参照しない
- 試合結果ページは `data/players/index.json` で数値 `id` から選手名を引き、`data/tournaments/details/**` と `data/tournaments/information/*.json` から結果を再構築する
- `data/players/*/analysis.json` は `data/tournaments/details/**` と `data/tournaments/information/*.json` をソースに自動生成する
- `latestMatch` は `results` ページ相当の大会データから最新開催の大会を選んで生成する

選手名の表示ルール:

- 選手名は `lastName`（姓）・`firstName`（名）に分けて保持する。
- 表示時の結合は `src/utils/playerName.ts` の `joinPlayerName(lastName, firstName)` を使う。
- 日本語名（ひらがな・カタカナ・漢字を含む）は姓名を詰めて表示する（例: 内本貴文）。
- ローマ字（英語表記）の国際選手は姓名の間に半角スペースを入れる（例: `UCHIMOTO TAKAFUMI`）。コリアカップ等の国際大会が該当する。
- 判定は名前にひらがな・カタカナ・漢字が含まれるかで行い、含まれなければローマ字とみなしてスペース区切りにする。大会IDによる分岐はしない。
- 適用箇所は試合結果（`MatchResults`）・出場選手一覧（`EntryOverview`）・大会トップの優勝者名表示など。トーナメント表（`TournamentBracket`）の単式は元々スペース区切りで表示している。

### score 公開 JSON

- `public/data/beta-matches/meta.json`
- `public/data/beta-matches/index.json`
- `public/data/beta-matches/matches/*.json`
- `public/data/beta-matches/growth/targets.json`
- `public/data/beta-matches/growth/reports/*.json`

### 成長分析の運用設定（手動メンテの静的 JSON）

- `data/growth-featured.json`（成長記録ショーケース `/growth/[slug]` の対象 allowlist。`subjectKey` / `slug` / `playerId` / `playerName` / `title` / `intro`。詳細は ADR-004）
- `data/growth-exclusions.json`（成長分析の撤回リスト。載せた `subject_key` はレポート生成から除外）

## Supabase のテーブル

score 機能の動的データ（`matches` / `games` / `points` / `match_video_sessions` /
`match_point_candidates`）の列・リレーションは [database.md](./database.md) に集約する
（重複記載を避けるため、本ページでは再掲しない）。`src/types/database.ts` 由来。

## モデル上の特徴

- `matches` はフラットな `team_a_*` / `team_b_*` と、構造化された `teams` の両方を持つ
- `games.points_a` / `games.points_b` / `games.winner_team` は `points` から再計算される派生値に近い
- score 公開用 JSON では内部フィールドを削除する

確認根拠:

- `src/pages/api/matches/[matchId]/index.ts`
- `src/pages/api/matches/[matchId]/points/index.ts`
- `scripts/generate-beta-matches-json.mjs`

## Assumption

- `src/types/database.ts` は Supabase 実体の完全な schema 定義ではなく、アプリ利用向け型
- `teams` は新しめの表現で、`team_a` / `team_b` は互換性のために残っている可能性がある

## Open Questions

- RLS、index、trigger、constraint の全体像
- `matches.status` と `processing_status` の正式状態遷移
- points の `result_type` の正式な語彙表
