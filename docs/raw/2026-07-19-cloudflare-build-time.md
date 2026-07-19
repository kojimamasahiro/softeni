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

---

## 追記2: 修正後の実測（commit 2f34553）と generate-facts の増分キャッシュ化

### teams 系修正の効果: 22分41秒 → 8分53秒（2.6倍）

| フェーズ | 前 | 後 |
|---|---|---|
| clone + `npm ci` | 25秒 | 24秒 |
| prebuild | 2分15秒 | 2分6秒 |
| lint + 型チェック | 22秒 | 22秒 |
| webpack compile | 2分6秒 | 1分45秒 |
| Collecting page data | 1分49秒 | **10秒**（11倍） |
| Generating static pages | 14分39秒 | **3分13秒**（4.6倍） |
| upload + deploy | 34秒 | 40秒 |

ルート別（1ページ平均）:

| ルート | 前 | 後 |
|---|---|---|
| `/teams/[teamId]/[year]/[gender]` | 17,187ms | 1,467ms（11.8倍） |
| `/teams/[teamId]` | 13,479ms | 1,238ms（11.1倍） |
| `/players/[id]/results` | 1,242ms | 1,239ms（**変化なし**） |

### GC道連れ説は棄却された

追記1で立てた「teams 系の GC 負荷が results ページを道連れにしている」という仮説は
**外れ**。teams を12倍速くしても results は 1,242ms → 1,239ms で不変だった。

代わりの説明: 私が計測し忘れていたのは **React の SSR レンダリング**。Next の報告値は
getStaticProps だけでなく HTML 生成まで含むが、追記1ではデータ取得部分しか測っていなかった。

床（floor）の証拠がログにある。`/st-league/about` は getStaticProps を持たない純粋な
静的ページだが **468ms**。`/highschool/[gender]` は2ページで445ms。SSG 全体では
3,744ページ / 193秒 = 平均51.6ms/ページ（約18ワーカー並列）に収まっており、
results の1,239msはもはや外れ値ではない。

props も確認した（`out/_next/data` の40ページサンプル）。平均25.2kB、内訳は
`playerStatistics` 9.1kB / `playerMatches` 6.6kB / `playerTournaments` 6.5kB。
全選手リストのような無駄な同梱は無い（`allPlayers` は0.2kB）。削れる脂肪も無い。

→ **`/players/[id]/results` は最適化対象から外す。** reverse index 化の案は取り下げ。

### generate-facts の増分キャッシュ化（実装済み）

`scripts/playerStats/cache-sync.mjs` を追加し、prebuild の先頭で `restore`、
末尾で `save` を実行するようにした。`_facts` / `_index` / `_manifest.json` を
`.next/cache/playerstats/` に退避する。

Cloudflare Pages のビルドキャッシュは Next.js プロジェクトに対して `.next/cache` を
保存・復元する（公式ドキュメント Build caching > Frameworks の表で明示。他に
package manager のグローバルキャッシュ。保持期間7日、上限10GB/プロジェクト）。

実測:

| | 実測 |
|---|---|
| generate-facts フルビルド（Cloudflare） | 1分59秒 |
| generate-facts 増分（変更なし） | **3.1秒** |
| generate-facts 増分（1ファイル変更 → 494選手再生成） | **10.1秒** |
| `_facts` のサイズ | 130MB / 18,485ファイル（tar.gz で9.9MB） |
| cpSync による save / restore | 各 0.3秒 |

### 検証

- **コピーの忠実性**: 18,486ファイルを save → 削除 → restore し、md5 の総和が完全一致。
- **キャッシュ破損時の挙動**: `_facts` から500ファイル削除した状態で restore すると
  `cache truncated (expected 18485, found 17985)` で復元を拒否し、フルビルドに落ちる。
- **ローカル開発への影響なし**: 作業コピーが存在する場合 restore はスキップする。
- **増分の正しさ**: 増分ビルドの産物と `--ids` による再計算を300選手分比較し、md5一致。
- `tsc --noEmit` パス。playerStats のユニットテスト 28件パス（manifest の diff ロジックは
  `lib/playerStats/__tests__/manifest.test.ts` で既にテスト済み）。

### 安全性の根拠

- manifest は **mtime ではなく内容ハッシュ(sha1)** ベース。復元物が古くても、入力の内容が
  変わっていれば該当選手が再生成される。git clone で mtime が失われても影響しない。
- `engineVersion` / `globalHash` / `configHash` のいずれかが変われば全再計算に落ちる。
  globalHash の入力5ファイル（tournaments/index.json, local_index.json,
  players/index.json, homonyms.json, participant-aliases.json）は**全て git 管理下**で
  prebuild が生成するものではないため、ビルド間で安定する。
- save は一時ディレクトリ + `rename` で原子的に差し替える。途中で落ちても
  不完全なキャッシュが次回に読まれない。
- restore 前にファイル数をメタデータと照合する。10GB上限による部分退避などで
  切り詰められていた場合は復元を拒否する。
- スクリプトは全例外を握り潰して常に exit 0。キャッシュ層の障害でビルドは落ちない。

### 残っているデメリット（許容と判断）

1. ローカル `npm run build` でも save が走り、`.next/cache` が130MB増える。
   実害は薄いがディスクは使う。
2. `.next/cache` への相乗りは Cloudflare の仕様に依存する。仕様変更で黙って
   フルビルドに戻る（= fail safe）。
3. 7日デプロイしないとキャッシュが purge されフルビルドになる（= fail safe）。

### 想定される次の姿

prebuild 2分6秒 → 約20秒。全体 8分53秒 → **7分前後**。
残る大物は webpack compile 1分45秒（Turbopack、未検証）と
Generating static pages 3分13秒（床があり削りにくい）。

### 副産物: golden fixture の陳腐化を検出

`verify-facts-golden.ts` が2件失敗する。

- funemizu-hayato (id=3): facts L=17 G=442-183 vs golden L=16 G=441-179
- kurosaka-takuya (id=10): facts W=142 G=663-306 vs golden W=141 G=659-305

golden は `scripts/playerStats/verify-facts-golden.ts` にハードコードされており
最終更新は 2026-07-02。東日本2026のデータ投入（2026-07-19）で両選手の試合が増えたため。
**今回の変更とは無関係の既存問題**（cache-sync はファイルをコピーするだけで
facts の計算に一切関与しない）。golden の更新が必要。

## Compile Log（追記2分）

docs/wiki/deployment.md に反映するもの:

- 修正後のフェーズ別内訳（8分53秒）— 既存の22.7分の表が陳腐化するため差し替え
- `.next/cache` が Cloudflare の Next.js キャッシュ対象であるという確定情報と、
  そこに増分アーティファクトを退避する仕組みの存在（運用者が知る必要がある）
- 「ページ生成には数百msの床があり、SSG は床に近づくと削れない」という一般則
- Open Questions の `/players/[id]/results` を「調査完了・対象外」として閉じる

意図的に wiki へ載せないもの:

- GC道連れ説とその棄却の経緯 — 結論だけで十分、過程は raw に残す
- props の内訳サンプル（25.2kB の分解）— 一度きりの調査で陳腐化する
- cache-sync の検証手順の詳細 — コード内コメントとこの raw が一次情報
- golden fixture の陳腐化 — ビルド性能とは別問題。別途 Open Questions 化すべきだが
  deployment.md の管轄ではない

まだ書き戻していないもの:

- golden fixture 2件の陳腐化。docs/wiki/open-questions.md か playerStats 側の
  ドキュメントに起票すべきだが、今回は raw への記録に留めた
