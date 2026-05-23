# Data Import

## 概要

このリポジトリでは、大会データ、選手データ、score 公開 JSON をローカルスクリプトで生成する運用が確認できます。

## package.json から確認できる主要コマンド

- `npm run prebuild`
  - `node scripts/generate-players-json.mjs`
  - `node scripts/generate-beta-matches-json.mjs`
- `npm run check:growth`
  - `node scripts/check-growth-analysis.mjs`
- `npm run build:adinsight`
  - `node scripts/build-adinsight-site.mjs`

## score 公開データ生成

### `scripts/generate-beta-matches-json.mjs`

役割:

- Supabase から `matches`, `games`, `points` を取得
- `public/data/beta-matches/**` を生成
- `buildGrowthReports` を使って成長分析レポートも出力
- 公開不要な内部フィールドを除外

確認できる仕様:

- 最新 50 件を対象
- 環境変数が無い場合は既存スナップショット再利用
- `meta.json` / `index.json` / `matches/*.json` / `growth/**` を更新

## 大会・選手データ生成

確認できた主要スクリプト:

- `scripts/generate-players-json.mjs`
- `scripts/extract-players.mjs`
- `scripts/generate-players-index-from-info.mjs`
- `scripts/generate_players_from_tournaments.mjs`
- `scripts/generate_entries.py`
- `scripts/generate_roundrobin.py`
- `scripts/matches/convert.py`
- `scripts/matches/roundrobin/convert.py`

関連データ:

- `data/tournaments/**`
- `data/players/**`
- `scripts/matches/input.json`
- `scripts/matches/roundrobin/input.json`

## 高校カテゴリ系の生成

確認できた主要スクリプト:

- `scripts/highschool/01team/entries-to-teams.py`
- `scripts/highschool/02result/extract.py`
- `scripts/highschool/03list/summary.py`
- `scripts/highschool/04summry/generate_prefecture_summaries.py`
- `scripts/highschool/analysis/generate_school_analysis.py`

出力先:

- `data/highschool/prefectures/**`

## tournament details / players 生成の見方

- 大会データの canonical source は `data/tournaments/details/**` と `data/tournaments/information/*.json`
- 一覧や地域紐付けは `data/tournaments/index.json` / `local_index.json` を使う
- そこから選手ページ用の `data/players/**` を派生生成する流れがある
- score 系は `data/**` ではなく Supabase -> `public/data/beta-matches/**` 生成の流れを持つ

## Assumption

- 大会データ生成は手動補正込みのローカル運用
- score 公開 JSON はデプロイ前のスナップショット生成物として扱われる

## Open Questions

- tournament details 生成の標準手順はどのスクリプト列か
- players 生成で最終的に正とする入力源はどれか
- どこまでが自動生成で、どこからが手修正か
