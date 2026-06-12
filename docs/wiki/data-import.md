# Data Import

## 概要

このリポジトリでは、大会データ、選手データ、score 公開 JSON をローカルスクリプトで生成する運用が確認できます。

## package.json から確認できる主要コマンド

- `npm run prebuild`
  - `node scripts/generate-players-json.mjs`
  - `node scripts/generate-player-analysis.mjs`
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

- 最新 50 件を対象（`LATEST_BETA_MATCH_LIMIT = 50`）
- 環境変数が無い場合は既存スナップショット再利用
- `meta.json` / `index.json` / `matches/*.json` / `growth/**` を更新
- 出力時に `public/data/beta-matches/` を毎回削除して再生成する（`ensureCleanDir`）

### 注意: 50 件上限と公開 URL の消失リスク

- 51 件目以降、作成日時が古い試合は `meta.json` と `matches/*.json` から完全に落ちる
- `meta.json` の `matchIds` が静的パス生成の第一候補なので、落ちた試合の詳細ページは次回ビルドから 404 になる
- 現状は `/beta/*` が robots.txt で disallow かつ sitemap 除外のため実害はないが、試合詳細ページを公開 URL としてインデックスさせる場合は、事前に上限撤廃（全件出力）またはアーカイブ方式への変更が必要

## 大会・選手データ生成

確認できた主要スクリプト:

- `scripts/generate-players-json.mjs`
- `scripts/generate-player-analysis.mjs`
- `scripts/extract-players.mjs`
- `scripts/generate-players-index-from-info.mjs`
- `scripts/generate_players_from_tournaments.mjs`
- `scripts/crawl-local-tournaments.mjs`
- `scripts/generate_entries.py`
- `scripts/generate_roundrobin.py`
- `scripts/matches/convert.py`
- `scripts/matches/roundrobin/convert.py`

Deprecated:

- `scripts/generate_analysis.py`
  現行運用では `scripts/generate-player-analysis.mjs` を使う
- `scripts/toPlayer/convert.py`
  廃止済みの `data/players/*/results.json` を手動追記する旧運用スクリプト

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

### 性別の扱い

- `scripts/highschool/02result/extract.py` はファイル名から性別を自動判定する
- 現在は `boys` / `girls` / `mixed` を判定対象としている
- 抽出結果には `gender` フィールドが付与され、後続の高校カテゴリ集計に渡される

### 学校名の寄せ方

- `scripts/highschool/03list/summary.py` は既知の学校名を安全に正規化して集計する
- 同姓同名選手の証拠から広く alias を推定する処理は、別学校の過剰集約を招くため集計には使わない
- `scripts/highschool/04summry/generate_prefecture_summaries.py` は毎回 `summary.json` をフル再生成する

## tournament details / players 生成の見方

- 大会データの canonical source は `data/tournaments/details/**` と `data/tournaments/information/*.json`
- 一覧や地域紐付けは `data/tournaments/index.json` / `local_index.json` を使う
- そこから選手ページ用の `data/players/**` を派生生成する流れがある
- `data/players/*/analysis.json` は `data/tournaments/details/**` と `data/tournaments/information/*.json` から `scripts/generate-player-analysis.mjs` で自動生成する
- score 系は `data/**` ではなく Supabase -> `public/data/beta-matches/**` 生成の流れを持つ

## 地方大会候補検知

### `scripts/crawl-local-tournaments.mjs`

役割:

- `data/local-sources/prefecture-sources.json` の都道府県公式サイトを巡回
- HTML から結果資料らしきリンクを抽出
- `data/local-sources/detected-documents.json` に候補を蓄積
- `data/local-sources/ignored-documents.json` にある URL は保存しない

設定メモ:

- 各都道府県は `sourceUrl` 1 本でも `sourceUrls` 複数本でも設定できる
- `sourceUrls` を使う場合は、結果一覧ページ、年度別一覧、連盟大会情報ページなどを並べてよい
- `sourceUrls` がある場合はそちらを優先し、`sourceUrl` は後方互換用に扱う

CLI:

- `node scripts/crawl-local-tournaments.mjs`
- `node scripts/crawl-local-tournaments.mjs --prefecture=ibaraki`
- `node scripts/crawl-local-tournaments.mjs --dry-run`
- `node scripts/crawl-local-tournaments.mjs --min-confidence=0.75`

運用メモ:

- `enabled === false` の都道府県だけ巡回対象外
- `manual` は巡回せずスキップログを出す
- `html_detail` は v1 では `link_only` と同等で警告ログを出す
- PDF / Excel 直リンクは保存しない
- 例外として、島根県の大会一覧ページの `結果` 列にある資料リンクは結果候補として保存する
- 「要項」「案内」「申込」「募集」など案内系キーワードを含む候補は保存しない
- 保存対象は当年度候補と年度不明候補に絞る
  - 現在日付から日本の年度を計算し、4 月始まりで判定する
  - 今年度以外の候補は保存しない
- `--min-confidence` を指定した場合、その値未満の候補は保存しない
- `--min-confidence` の既定値は `0.6`
- 網羅的に見たい場合は、都道府県ごとに `sourceUrls` へ複数の結果系ページを登録する
- `--dry-run` はファイルを更新せず、`sources / crawled / skipped / new / updated / ignored / errors / dryRun` を標準出力に出す
- `detected-documents.json` の `accepted` は候補として確認済みであることだけを意味し、公開データ反映済みは意味しない

## Assumption

- 大会データ生成は手動補正込みのローカル運用
- score 公開 JSON はデプロイ前のスナップショット生成物として扱われる

## Open Questions

- tournament details 生成の標準手順はどのスクリプト列か
- players 生成で最終的に正とする入力源はどれか
- どこまでが自動生成で、どこからが手修正か

## 大会結果入力ツール（tools/）

2026-06 更新: 手動工程削減のため、ブラウザツールに入力受け渡し・成形(normalize)機能を統合した。

フロー:

1. `tools/index.html`（ハブ）で選手配列JSONを貼り付け、形式（トーナメント / ラウンドロビン）を選択
   - ラウンドロビン選択時は `scripts/generate_roundrobin.py` 相当のグループ分割をブラウザ内で実行（標準サイズ / サイズ上書き / ラベル種別に対応）
   - 入力は localStorage 経由で各ツールに渡る（従来どおり `initialPlayer.js` 直接編集も可。localStorage 入力が優先される）
2. 各ツール（`tools/roundrobin` / `tools/tournament3`）でスコア入力
   - 出力 textarea には成形済みJSON（`data/tournaments/details` 用の最終形式）が直接表示される
   - 保存はコピー / ダウンロード / File System Access API によるフォルダ直接保存（Chrome系のみ）に対応
3. ラウンドロビン→トーナメント移行: RR画面で「各グループ上位N位を進出」を指定して抽出→編集→トーナメント画面へ遷移
   - RRの生結果（roundRobinMatches / standings）は持ち越され、トーナメント出力にマージしてから成形される

成形ロジック:

- 本体は `tools/shared/normalize-core.js`（ブラウザ・Node 両対応）
- `scripts/normalize-to-participants-entries.cjs` は同モジュールを呼ぶ薄いCLIラッパーに変更（`scripts/batch-normalize.mjs` からの利用・出力は従来と同一であることを確認済み）
- entries メタ（type情報）はハブページの任意入力欄から渡せる。未指定時は従来どおり試合内容から推定
