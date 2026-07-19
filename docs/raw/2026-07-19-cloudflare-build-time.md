# 2026-07-19 Cloudflare ビルド20分問題の調査と修正

## 発端

Cloudflare Pages のビルドが20分近くかかっている。数分レベルにしたい。

## 実測（2026-07-19 のビルドログ、commit 0076636）

全体 22.7分（05:35:21 → 05:58:02）。

| フェーズ | 時間 |
|---|---|
| clone + キャッシュ復元 + `npm ci` | 25秒 |
| prebuild | 2分15秒（うち `generate-facts` が2分7秒） |
| lint + 型チェック | 22秒 |
| webpack compile | 2分6秒 |
| Collecting page data（getStaticPaths） | 1分49秒 |
| **Generating static pages** | **14分39秒（全体の65%）** |
| postbuild（sitemap） | 3秒 |
| アップロード | 34秒 |

当初「出力が379MB / 7,945ファイルあるのでアップロードが重いのでは」と仮説を立てたが、
**外れ**。アップロードは34秒（差分5,666ファイルで28秒）で無視できる。

## 犯人

Next.js のルート別集計（並列合算、全体で約9,800秒）:

| ルート | 合計 | ページ数 | 1ページあたり |
|---|---|---|---|
| `/teams/[teamId]/[year]/[gender]` | 5,915秒 | 338 | 17.2秒 |
| `/players/[id]/results` | 2,426秒 | 1,917 | 1.24秒 |
| `/teams/[teamId]` | 959秒 | 67 | 13.5秒 |

上位3ルートで95%、うち teams 系だけで70%。

### 根本原因

`src/utils/tournament-data-loader.ts` の `getAllTournamentFiles()` と
`loadTournamentData()` に**キャッシュが無かった**。呼ばれるたびに
ディレクトリ全走査 / `readFileSync` + `JSON.parse` を実行していた。

`src/utils/team-data-aggregator.ts` の `aggregateTeamResults()` は、1回の呼び出しの
中で Pass1（性別判定）/ Pass1.5（混合ダブルスからの性別推論・**不動点ループ**）/
Pass2（結果生成）の各段で全大会ファイルを読み直す。つまり1ページ生成あたり
297ファイル × 数回 の read + parse が走っていた。

さらに `getStaticProps` は `aggregateTeamResults()` と `generateTeamInfo()` を
両方呼び、`getStaticPaths` も全チーム分呼ぶ。→ ページ数 × 大会数 × パス数 の多重ループ。

Note: 似た名前の `lib/tournamentData.ts` には元からキャッシュがあるが、これは別モジュール。
teams 系が使っているのはキャッシュ無しの `src/utils/tournament-data-loader.ts` の方だった。

## 修正

`src/utils/tournament-data-loader.ts` にプロセス内キャッシュを追加しただけ。

- `cachedTournamentFiles`: ディレクトリ走査結果を1回だけ
- `tournamentDataCache: Map<filePath, data>`: parse 済みデータを1回だけ

全297ファイルを保持してもヒープ約36MB、parse は208ms/回（実測）なので常駐させて問題ない。
Next のワーカーはプロセス分離のためキャッシュはワーカーごとになるが、それで十分。

`team-data-aggregator.ts` 側は**無改造**。ロジックに一切触れていない。

### 効果（サンドボックス4コアでの実測）

| | 修正前 | 修正後 |
|---|---|---|
| `aggregateTeamResults('nssu')` | 1,570ms | 297ms（初回、cold parse 込み）|
| 同 2回目以降の他チーム | 約1,200ms | 約60ms |
| 全67チーム1周（agg + info） | 約80秒 | **4.2秒** |

約20倍。ビルドの teams 系 6,874秒 → 300秒台の見込み。

### 検証

修正前後で `aggregateTeamResults` / `generateTeamInfo` / `gendersWithRealPresence` の
出力を全67チーム分 JSON にダンプし、**バイト単位で完全一致**を確認（4.9MB, md5 一致）。
`tsc --noEmit` パス。

キャッシュ導入により `loadTournamentData()` の返り値がプロセス内で共有される点は
リスク。呼び出し側を全て確認し、破壊的変更をしている箇所が無いことを確認済み
（`src/pages/st-league/[year]/teams.tsx` は `.filter()` と読み取りのみ。
`info.name` の書き換えは `generateTeamInfo` が毎回新規生成する TeamInfo に対してで問題なし）。
関数の doc comment に「読み取り専用として扱うこと」を明記した。

## 残りの改善余地（未着手）

優先度順。

1. **`generate-facts` の2分7秒** — ログに `full rebuild (no manifest)` と出ている。
   増分ビルド機構は実装済みだが、`data/players/_facts/` と `_manifest.json` が
   `.gitignore` 対象で、Cloudflare のビルドキャッシュ（`node_modules` と `.next` のみ）
   にも乗らないため毎回フルビルドになる。`.next/cache/` 配下に出力してシンボリック
   リンクを張れば復元対象に入るが、やや裏技的。
2. **`/players/[id]/results` の1.24秒 × 1,917ページ** — 今回の修正後は最大の残り項目。
   未調査。
3. **webpack compile 2分6秒** — Next 15 の `--turbopack` で短縮できる可能性。要検証。
4. **lint + 型チェック 22秒** — CI で別途回すなら `next build` 側はスキップ可。小さい。

## アーキテクチャの議論（速報機能との関係）

「リアルタイム試合速報をやりたくなった時に静的エクスポートが足枷にならないか」という問い。

結論: **フルSSGと速報は本来ぶつからない**。3,700ページは過去戦績のアーカイブで
SSGが最適。速報は数ページだけで性質が違うため、全体を動的基盤に移す理由にならない。

選択肢:

- **A. 現状維持 + 速報だけクライアント購読（Supabase Realtime）** — デプロイ不要で
  リアルタイム更新。弱点は初期HTMLに中身が無く速報ページのSEO/OGPが効かないこと。
- **B. Cloudflare Pages Functions を足す（移行なし）** — ビルドログに
  `No functions dir at /functions found` とある通り、**今の構成のまま** `functions/` を
  置くだけで動的エンドポイントが生える。静的エクスポートで殺されている
  `/api/matches/*` の代替もここに置ける。
- **C. Workers + OpenNext** — ISR / on-demand revalidation / SSR。ビルド時に全ページ
  生成しなくて済むためビルド時間がページ数に比例しなくなる。代償は KV/R2/キャッシュ
  設定などの運用複雑度と Cloudflare 固有の Node API 制約。
- **D. Vercel** — ISR/PPR が最も素直。課金とロックイン。

推奨する順番:

1. いま: 今回のキャッシュ修正（完了）。移行判断を先送りできる余裕を作る。
2. 速報をやる時: B + A。移行ゼロで実現できる。速報ページのSEOが事業上重要なら
   そのルートだけ Functions でSSR。
3. C への移行判断: ページ数がさらに数倍になってSSGが再び破綻した時、または動的ルートが
   サイト全体に広がった時。今やる必要はない。

重要な注意: **C は「ビルド時間問題の解決策」としては筋が悪い。** 今回の17.2秒/ページは
ビルド時に払っているだけで、ISR にすると同じコストがユーザーの初回アクセス時に移る
（＝17秒待たされる）。集計の非効率は、どの構成に移っても先に直す必要があった。

## 副作用（要確認）

調査中に prebuild スクリプトを実行したため、以下の派生ファイルが再生成され差分が出ている。
コード変更とは無関係で、内容としては最新データを反映した正しい再生成（`npm run build` を
回せば同じものが出る）。コミットするかは判断が必要。

- `data/players/{funemizu-hayato, hashiba-toichiro, kurosaka-takuya, tsukamoto-hikaru, ueda-rio, yonekawa-yuto}/analysis.json`
- `public/data/beta-matches/{rare-events.json, reverse/by-player.json, reverse/by-tournament.json}`
- `public/data/{players-min20.json, players-search.json}`

## Compile Log

docs/wiki/deployment.md に反映したもの:

- ビルド時間のフェーズ別内訳（確定情報として）
- 「アップロードはボトルネックではない」という否定的知見（同じ誤仮説の再発防止）
- 静的ページ生成のコスト特性と「ビルド時データ読み取りは必ずプロセス内キャッシュを持たせる」
  という一般則（今後の実装への指針として最も再利用価値が高い）
- `loadTournamentData()` の返り値が共有データである制約
- 動的機能（速報）を足す時の選択肢 A〜D と推奨順序
- Open Questions に `generate-facts` のキャッシュ問題と `/players/[id]/results` の未調査を追加

意図的に wiki へ載せなかったもの:

- ルート別の秒数テーブル（`/teams/...` 5,915秒 等）— 修正で数値が陳腐化するため raw に残す
- サンドボックスでの before/after ベンチ値 — 環境依存でCloudflareの実測とは一致しない
- 修正の実装詳細（`cachedTournamentFiles` の構造等）— コード内コメントが一次情報
- 検証手順（67チーム分のJSONダンプ比較）— 一度きりの作業で再利用しない
- 副作用として再生成された派生ファイルの一覧 — このturn限りの作業ノイズ
- 未着手の改善案の優先度3・4（Turbopack、lint スキップ）— 未検証で推測の域を出ないため、
  Open Questions にも入れず raw のみ

まだ書き戻していないもの:

- なし
