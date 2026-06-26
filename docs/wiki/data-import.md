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

- 全件を対象（取得上限なし。`matches` を `created_at` 降順で全件取得）
- 環境変数が無い場合は既存スナップショット再利用
- `meta.json` / `index.json` / `matches/*.json` / `growth/**` を更新
- 出力は追記型（既存ファイルを更新し、出力ディレクトリの全削除はしない）

### Deprecated: 50 件上限と公開 URL の消失リスク（解消済み）

旧仕様では最新 50 件のみを対象（`LATEST_BETA_MATCH_LIMIT = 50`）とし、出力ディレクトリを毎回削除して
再生成（`ensureCleanDir`）していたため、上限から漏れた古い試合は JSON ごと消え、詳細ページが
404 になるリスクがあった。

現在は **上限撤廃（全件取得）＋追記型生成** に変更済みで、このリスクは構造的に解消されている
（経緯は docs/wiki/score-site-link.md）。コード上も `LATEST_BETA_MATCH_LIMIT` / `ensureCleanDir` は存在しない。

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

### PDFトーナメント表からの選手抽出

- `scripts/pdf/master.py`
  大会結果のトーナメント表PDFから、文字の座標(X/Y)を指定して選手・チーム情報を抽出する。
  レイアウト種別(団体/シングルス/ダブルス/全中 等)ごとに抽出戦略と多数のX座標定数を手動調整する運用。
- `scripts/pdf/calibrate.py`
  master.py のX座標調整を補助する非破壊のキャリブレーションツール。
  PDFを解析して左右分割・Y_CROP・列境界・`( )`区切りを自動検出し、
  X軸ルーラー付きの注釈デバッグ画像(`output/calibrate_pageN.png`)と
  master.py へ貼り付け可能な定数候補を出力する。
  `python3 scripts/pdf/calibrate.py <pdf> [--page N] [--gap 6]`
  ※ 各列が姓/名/チーム/エリアのどれに当たるか(意味づけ)と抽出戦略の選択は
  レイアウト依存のため、出力値は確認のうえ手動で転記する。
- `scripts/pdf/university_indoor.py`
  全日本学生選抜インドア選手権大会（内閣総理大臣杯, JSSTA）の公式結果PDFから
  `data/tournaments/details/zennihon-university-indoor/<year>/{doubles-none-boys,doubles-none-girls}.json`
  を生成する専用パーサ。第59回(2025)のレイアウトを前提とする。
  - 構成: p1-4 ブロック成績(予選リーグ星取表), p5-6 エントリー一覧+ブロック編成, p8 入賞(優勝/準優勝/3位)
  - 予選リーグはスコアまで星取表から復元する（丸数字=勝者ゲーム）。
  - 決勝トーナメントのゲームスコアはPDFに記載が無いため、勝敗のみ公式入賞から確定し
    `scores` は空にする（捏造しない）。準決勝の組合せは A-D / B-C 固定。
  - 康熙部首・異体字はNFKC + 変換表で常用字へ寄せて氏名/団体名を照合する。
  - 棄権等でスコアの無い対戦はスキップし、該当ペアの roundrobin.rank は null。
  - `python3 scripts/pdf/university_indoor.py <pdf> --year 2025 --out data/tournaments/details/zennihon-university-indoor`

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

### 大会結果データの学校名・県名の名寄せ

- 大会結果（`data/tournaments/details/**`）は表示にそのまま使われるため、学校名・県名の表記揺れがあると同一校が別チームのように見える（例: `高田商` / `高田商業` / `高田商業高校`、`徳島` / `徳島県`）
- `scripts/normalize-team-names.mjs` が2種類の揺れを統一する:
  - 学校名: 手動メンテの対応表 `data/tournaments/team-name-aliases.json`（`teamAliases` に「正準名 ← 別名」）で寄せる
  - 都道府県: 接尾辞（県/府/都）が無い短縮表記に正しい接尾辞を補う（スクリプト内蔵の47都道府県マップ。対応表には書かない）
- **対象スコープは既定で `highschool-japan-cup`（ハイスクールジャパンカップ）のみ**。他大会へ広げる場合のみ `--scope=<tournamentId>`（`--scope=all` で全大会）を明示する
- 対象は各 JSON の `participants[].team` / `participants[].prefecture` / `participants[].id` と `entries[].playerIds`。`id`（`姓_名_チーム_都道府県`）を再計算し参照も張り替える
- スクリプトは JSON を再シリアライズせず元テキストへピンポイント置換するため整形（インライン配列など）が保たれる。冪等で、`--dry-run` で事前確認できる
- `temp/` 配下の中間生成物は対象外。データを再生成した場合は本スクリプトを再実行する
- 別団体（例: `高田商ＯＢクラブ`＝OB団体）や別校（`大分`≠`大分商`、`高崎`≠`高崎商`）は対象に含めない。新しい揺れは対応表に追記して再実行する
- 登録済みの学校名エイリアス（HJC適用済み）: 高田商 / 大分商 / 明豊 / 旭川工 / 北科大 / 焼津 / 高崎商
- 判断保留（別校か同一校か未確定のため未登録）: `岐阜商` vs `県岐阜商`、`富士見` vs `静岡県富士見`
- 一回限りのデータ破損修復は `scripts/fix-hjc-2024-doubles.mjs`（2024男子ダブルスで和歌山勢の氏名・県名混入により参照切れ等が発生していたもの。氏名はドロー＝`entries` を一次情報として修復）。本スクリプト実行後に上記の正規化を流す

#### ルール: 都道府県は省略しない

- **`participants[].prefecture` は必ず正準形で保持し、省略形を使わない。** 正準形とは:
  - 接尾辞（都/道/府/県）を必ず付ける（`徳島` ではなく `徳島県`、`東京` ではなく `東京都`）
  - 地域接頭辞を付けない（`関東・埼玉県` ではなく `埼玉県`、`開催地・北海道` ではなく `北海道`）
  - NFKC で全角/半角・区切り（`•`→`・`）・空白を統一する
  - 47都道府県の正準表記は1値1表記に固定する
- **例外（都道府県でない区分はそのまま保持）**: 連盟など県の代わりに入る値は「別の都道府県扱い」の値として残す（`日本学連` / `学連` / `高体連` / `中体連` / `日本連盟`）。誤付与された県だけ外す（`日本連盟県`→`日本連盟`）。外国は県を外して国名で保持（`韓国県`→`韓国`）。
- このルールを全大会へ適用するのが `scripts/normalize-prefectures.mjs`:
  - Tier A（機械的・安全）: 接尾辞補完 / 地域接頭辞の除去 / 外国名の県除去
  - Tier B（崩れ・誤字の明示マップで一意復元）: `奈川県`→`神奈川県`、`德島県`→`徳島県`、`愛緩県`→`愛媛県`、`伊勢県`→`三重県` など
  - team には触れない（学校名寄せは `normalize-team-names.mjs` の管轄）。`prefecture` と、それを含む `id`（フィールド再構成と一致する正常な id のみ）・`entries[].playerIds` を追従
  - 既定スコープは `all`。冪等で `--dry-run` 可。未解決値（県・連盟・外国いずれでもない値）は警告に出す
- 2026-06 一括適用済み: prefecture の distinct 値 187 → 61（47都道府県＋連盟/外国/残存）。id 重複（誤マージ）ゼロ
- 人手判断のバックログ（2026-06 解消済み）: 当初の未変換4件は単純な県揺れではなく**列ずれによるレコード破損**だった。氏名・チーム・県の手がかり（チームメイトの県、ペア相手、同名の他大会）から特定し修復:
  - `中村日花莉_大分_大商鬼魄会_日本製鉄大分` → `中村_日花莉_大商鬼魄会_大分県`（firstNameに県混入。ペア相手が大商鬼魄会＝大分県）
  - `麻田陽愛_学連_同志社大学_立命館大学` → `麻田_陽愛_立命館大学_学連`（partner=同志社の中尾＝学連ペア。所属は立命館大学と確認）
  - `森田_晴紀_宮崎_都城商業高校OBクラブ` → `森田_晴紀_都城商業高校OBクラブ_宮崎県`（県とチーム入替。同名が他大会で宮崎県×7）
  - `大和田_夏美_…_い県` → `…_福島県`（ミックス相手＝磐城（いわき）福島県、team「わき」≈いわき）
  - 今後同種の列ずれが出たら、未解決警告を起点に同様の手がかりで個別修復する
- 残課題: `entries[].playerIds` の参照切れ3件（`田端_一葵_和歌山`＝参加者は `…_印南ジュニアクラブ` 等）はチーム名・氏名の表記差由来で、都道府県とは別問題
- 自動変換済みだが推定を含むもの（巻き戻さない方針）: `伊勢県`→`三重県`、`沖県`→`沖縄県`、`熊`→`熊本県`
- 既知の残課題（本ルールとは別の学校名揺れ）: `entries[].playerIds` の一部に participant id と不一致の参照が残る（`田端_一葵_和歌山`＝参加者は `…_印南ジュニアクラブ`、`房野_紗千_四天王寺高`＝参加者は `…_四天王寺高校`）。これは都道府県ではなくチーム名・氏名の表記差に起因する既存の参照切れで、別途対応

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
   - `tools/roundrobin` ではこの成形済みJSONを textarea 上で直接編集でき、編集するとスコア入力による自動上書きが止まる（編集内容がそのままコピー / ダウンロード / 保存に使われる）。試合結果から作り直す場合は「試合結果から再生成」ボタンで編集を破棄して再生成する
   - 保存はコピー / ダウンロード / File System Access API によるフォルダ直接保存（Chrome系のみ）に対応
3. ラウンドロビン→トーナメント移行: RR画面で「各グループ上位N位を進出」を指定して抽出→編集→トーナメント画面へ遷移
   - RRの生結果（roundRobinMatches / standings）は持ち越され、トーナメント出力にマージしてから成形される
   - 持ち越すRR結果は、成形済みJSONを**手動編集していない場合はUIのスコア状態**から、**手動編集した場合は編集後の成形済みJSONから復元**して作る。これにより、RR結果をJSON編集で入力した場合でも、RRで敗退し本戦へ進出しない選手が持ち越し（=最終出力の participants / entries / results）から欠落しない
   - 持ち越しの standings は normalize 側で roundRobinMatches から再計算されるため参考値（最終順位の正は roundRobinMatches）

成形ロジック:

- 本体は `tools/shared/normalize-core.js`（ブラウザ・Node 両対応）
- `scripts/normalize-to-participants-entries.cjs` は同モジュールを呼ぶ薄いCLIラッパーに変更（`scripts/batch-normalize.mjs` からの利用・出力は従来と同一であることを確認済み）
- entries メタ（type情報）はハブページの任意入力欄から渡せる。未指定時は従来どおり試合内容から推定
- ラウンドロビン→トーナメント移行時は `roundRobinMatches`（RR持ち越し）と `matches`（トーナメント）が同一入力に共存する。participants と entries は両方をマージして収集する（どちらか一方だけを採用しない）。これにより、トーナメント側のペア・対戦相手・entryが participants / entries から欠落しない
- RRで敗退し本戦へ進めなかった選手も `results` に残す。形式は `{"entryNo":N,"tournament":null,"roundrobin":{"group":..,"rank":..}}`（例: `data/tournaments/details/highschool-japan-cup/2025/doubles-none-boys.json`）。「予選敗退」「予選N位」等のラベルはJSONには保存せず、`tournament:null` かつ `roundrobin` ありの形から表示側（選手ページ・メジャータイトル判定等）で導出する
- エントリー成績（`results[].tournament.rank`）は `matches` から `deriveEntryStanding` で算出する。**最深試合が未確定（`winnerEntryNo==null`）の間は敗退でなく進行中（`rank.kind:'ongoing'`）**として扱うため、大会途中の export でも `results` を生成できる（完了大会の出力は不変）。語彙・運用は [tournament-data-structure.md](../tournament-data-structure.md) と [ADR-007](../adr/ADR-007-in-progress-tournament-standing.md) を参照
