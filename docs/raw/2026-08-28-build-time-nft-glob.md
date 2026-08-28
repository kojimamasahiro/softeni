# 2026-08-28 ビルド時間再増加の調査: nft（output file tracing）のワイルドカード走査

## 発端

「またビルド時間が延びてきた」。前回の調査は docs/raw/2026-07-19-cloudflare-build-time.md
（22分41秒 → 8分53秒 に短縮、`generate-facts` の増分化まで実施）。

## 今回の結論（先に）

**`next build` の compile フェーズで `@vercel/nft`（output file tracing）が
リポジトリ全体を `**/*` で走査している。** 犯人はビルドスクリプトでもページ生成でもなく、
**サーバ側コードの `fs.readFileSync(path.join(process.cwd(), ...ARRAY, 変数))` という書き方**。
この形を nft が静的解決できず、「cwd 配下の全ファイルが依存かもしれない」と判断して
`<project>/**/*` を glob する。

該当箇所は今回のビルド時間増加とほぼ同時期に入っている:

| ファイル | 追加日 | commit |
|---|---|---|
| `lib/clubTransition.ts` | 2026-08-12 | 17b2dae6 中学 |
| `lib/secondaryschool.ts` | 2026-08-13 | cd7618c1 中学カテゴリ |
| `lib/qualifierFinishers.ts` | 2026-08-26 | d972f13d 予選会の上位進出者 |

## 計測環境の注意

Cloudflare のビルドログは今回参照できていない。以下はすべて**ローカル（macOS, 10コア）**の実測で、
ローカルには Cloudflare に存在しないディレクトリ（`.claude/worktrees/*`, `.venv/`, `out/`,
`.next/`）があるため、**絶対値はローカル固有に大きく出ている**。機序は共通だが、
Cloudflare 側の実数は次回のビルドログで確認が必要（Open Questions）。

## 調査の経過

### 1. ローカル `npx next build` が終わらない

`Creating an optimized production build ...` のまま55分経過しても完了しない。
`ps` で見ると **経過37分に対し CPU time は2分47秒（約7%）** — CPU バウンドではない。

`sample` でスタックを取ると `uv__work_done` → `AfterScanDir` / `AfterStat` →
JS コールバック → `path.join` / `lstat`。つまり**巨大なディレクトリ再帰走査**をしている。

### 2. fs 呼び出しを数える

`NODE_OPTIONS=--require` で `fs.readdir` / `lstat` / `stat` を patch し、
パスの上位3セグメントで集計した（スクリプトは scratchpad、恒久化していない）。

t=3612s 時点で **lstat 累計 250万回**:

```
591105  lstat data/players/_facts
341818  lstat .claude/worktrees/university-player-high-school-tracking-4dd4c7
233848  lstat node_modules
184790  lstat .next/cache/playerstats
182400  lstat .venv/lib/python3.13
 93900  lstat data/highschool/prefectures
 72958  lstat out/_next/data
```

`.claude/worktrees` や `.venv` まで舐めている ＝ **プロジェクトルート全体の glob**。

### 3. 犯人の特定

仮説を順に潰した。

- **tsc ではない**: `npx tsc -p tsconfig.json --noEmit --incremental false` は **4.5秒**。
  （`tsconfig.json` の `include` が `**/*.ts` で `exclude` が `node_modules` だけなのは
  行儀は悪いが、実測では問題になっていない）
- **ESLint ではない**: `next build --no-lint` でも同じ走査が起きた。
  （ただし ESLint 自体は別問題。後述）
- **webpack の dynamic require でもない**: `src` / `lib` に動的 `require()` / `import()` は無い。

`next/dist/compiled/glob` の呼び出しを patch してパターンと呼び出し元を記録したところ、
呼び出し元は全て `next/dist/compiled/@vercel/nft`。1ビルドあたり **148回** の glob:

| パターン | 回数 | マッチ数 | 1回 | 小計 |
|---|---|---|---|---|
| `<project>/**/*` | 2 | 135,981 | 6,589ms | 13.2s |
| `<project>/**/*-qualifier/**/*` | 1 | 120 | 3,042ms | 3.0s |
| `data/players/**/*` | 7 | 18,526 | 601ms | 4.2s |
| `data/players/**/*/information.json` | 7 | 23 | 523ms | 3.7s |
| `data/highschool/prefectures/**/*/summary.json` | 17 | 47 | 77ms | 1.3s |
| `data/**/*` | 1 | 20,172 | 801ms | 0.8s |
| `data/tournaments/details/**/*` | 25 | 529 | 23ms | 0.6s |
| （他8パターン） | | | | 1.2s |
| **合計** | **148** | | | **約28秒** |

これは **OS のファイルキャッシュが温まった状態での再計測値**。実ビルド中は
250万 lstat・数分規模になっていた（並列 + コールドキャッシュ + 他フェーズとの競合）。

### 4. nft がワイルドカードを出す条件（fixture で再現）

`nodeFileTrace` を最小 fixture で直接叩いて、どの書き方が全走査を招くか切り分けた。

| 書き方 | nft の結果 |
|---|---|
| `readFileSync(path.join(process.cwd(), ...ARR, file))` | **プロジェクト全体**を trace |
| `readdirSync(path.join(process.cwd(), ...ARR, id))` からの `readFileSync(path.join(dir, f))` | **プロジェクト全体**を trace |
| `readFileSync(path.join(process.cwd(), 'data', 'tournaments', file))` | `data/tournaments/` 配下のみ |
| `readdirSync(path.join(resolveRoot(), ...ARR, id))` | 何も trace しない（nft が諦める） |
| `readFileSync(path.join(resolveRoot(), ...ARR, id))` | 何も trace しない |

要点は2つ。

1. **`process.cwd()` を直接書く + パス配列を spread する**の組み合わせが最悪。
   nft は `process.cwd()` だけ解決できてしまい、残りが不明なので `cwd/**/*` に落ちる。
2. 配列 spread をやめて**リテラルのパスセグメントを直書き**すれば、
   glob の範囲がそのサブツリーに限定される。`resolveRoot()` のような関数経由にすると
   nft は解決を諦めて glob 自体を出さない（＝いちばん速い）。

## 対策案（優先度順）

### A. `process.cwd()` + spread を潰す（効果大・変更小・確実）

対象は `lib/secondaryschool.ts:97`、`lib/clubTransition.ts:167`、
`lib/qualifierFinishers.ts:91`。いずれも `path.join(process.cwd(), ...XXX_ROOT, ...)`。

`process.cwd()` を、既に他モジュールが使っている `resolveRoot()` 相当の関数経由にするか、
パスセグメントをリテラル直書きにする。これで `<project>/**/*`（135,981ファイル・6.6秒/回）が
消える。**Cloudflare でも同じ機序で効く**（あちらは `.venv` も `.claude/worktrees` も無いので
マッチ数は減るが、`node_modules` 21,110 + `data` 20,172 は走査される）。

注意: nft の trace 結果は `output: 'export'` では**誰も使わない**（静的HTMLしか配らないので
`.nft.json` は無用）。それでも Next 15.5 には tracing を切る設定が無い
（`outputFileTracing: false` は config schema から消えている。`outputFileTracingExcludes` は
nft 実行**後**に適用されるので glob 自体は止められない。
`next-trace-entrypoints-plugin` の `traceIgnores` は `webpack-config.js` で `[]` 固定）。
つまり**「呼ばせない」のではなく「範囲を狭める」しか手が無い**。

### B. `data/players/_facts` を `data/` の外へ出す（効果中・変更中）

`data/` 20,172ファイルのうち **18,471が `data/players/_facts`**（playerStats の派生物、gitignore 対象）。
これが `data/**/*`（1回）と `data/players/**/*`（7回）を膨らませている。

`_facts` / `_index` / `_agg` / `_manifest.json` を `data/players/` の外
（例: `.playerstats/`）に移せば、この2パターンのマッチ数が 18.5k → 数十に落ちる。
`scripts/playerStats/cache-sync.mjs` と `.gitignore` と `lib/playerStats/config.ts` の追従が要る。

A より効果は小さく変更は大きいので、A の実測後に判断でよい。

### C. ESLint の対象範囲（ビルドとは別問題だが放置できない）

`npm run lint`（`eslint --fix .`）が **10分でも終わらない**。
`eslint.config.mjs` に `ignores` が一切無いため、`out/`（9,743ファイル）・`.venv`・
`.claude/worktrees/*`・`data/`・`public/data/players-lite`（6,400ファイル）まで走査している。

`next build` 内の lint は Next が `['app','pages','components','lib','src']` に限定して
呼ぶので**ビルド時間には影響しない**（`--no-lint` でも走査が起きたことで確認済み）。
影響するのは手元の `npm run lint` と、CI で `npm run lint` を回す場合。

対策は `eslint.config.mjs` の先頭に
`{ ignores: ['.next/**','out/**','node_modules/**','data/**','public/data/**','.venv/**','.claude/**','coverage/**'] }`
を足すだけ。

### D. ページ数の増加（現状把握）

`out/` の実測で **4,450 HTML / 9,743ファイル / 397MB**。
2026-07-19 時点は 3,717 HTML / 7,945ファイル / 379MB だったので **+733ページ（+20%）**。

| ディレクトリ | HTML数 |
|---|---|
| players/ | 1,940 |
| highschool/ | 956 |
| tournaments/ | 559 |
| teams/ | 384 |
| secondaryschool/ | 353 |
| st-league/ | 177 |

ページ生成には約470msの床がある（前回調査）ので、+733ページは**それだけで数十秒〜数分**増える。
これは機能追加の正当なコストであり、削るとすれば並列度かページ設計の話になる。

### E. `data/players/index.json` のページ毎パース（効果小・変更小）

`data/players/index.json`（1.4MB / 18,543件）を `getStaticProps` で**毎ページ**
読んで Map を組み直しているルートがある。1回あたり **9.8ms**（実測）。

キャッシュ**無し**:

- `src/pages/highschool/[gender]/[prefectureId]/[teamId].tsx`（約880ページ）
- `src/pages/teams/[teamId]/[year]/[gender].tsx`（338ページ）
- `src/pages/teams/[teamId]/index.tsx`（67ページ）
- `src/pages/tournaments/.../[gender]/index.tsx`
- `src/pages/st-league/[year]/teams.tsx`

キャッシュ**あり**（参考実装）:

- `src/pages/players/[id]/index.tsx`（`cachedPlayerIndex`）
- `src/pages/players/[id]/results.tsx`（`cachedPlayerIndexPromise`）
- `src/pages/tournaments/[generation]/[tournamentId]/index.tsx`（`cachedPlayerNameToId`）

合計で概算 **18秒程度**。前回（2026-07-19）に立てた
「ビルド時にデータを読むユーティリティは必ずプロセス内キャッシュを持たせる」という一般則の
取りこぼし。金額は小さいが、直し方が確立していて安全なので A のついでにやる価値がある。

## 未検証・未着手

- Cloudflare 実機でのフェーズ別内訳（今回未取得）。A を入れた前後で比較すべき。
- `webpack compile` の Turbopack 化（前回から持ち越し、未検証）。
- ローカルの `.claude/worktrees/*` が肥大している（1ワークツリーだけで readdir 5,496回/92秒）。
  ビルド時間そのものより開発体験の問題だが、不要なワークツリーは掃除したほうがよい。

## Compile Log

docs/wiki/deployment.md に反映したもの:

- 「`output: 'export'` でも nft の output file tracing は走り、止める設定は無い」という確定情報
- ビルド時にデータを読むコードの書き方の一般則（`process.cwd()` + spread を避ける）。
  前回の「プロセス内キャッシュを持たせること」と並ぶ、再利用価値の高い実装指針
- `data/players/_facts` が `data/**` の glob を膨らませているという構造的な事実
- ページ数の最新値（3,717 → 4,450）で既存記述を更新
- Open Questions に「Cloudflare 実機での nft コスト」を追加

意図的に wiki へ載せなかったもの:

- 調査の経過（sample のスタック、fs patch の手順、仮説の潰し方）— 一度きりの手続きで再利用しない
- glob パターン別の秒数テーブル — ローカル固有かつ対策後に陳腐化する
- nft fixture の切り分け表 — 結論（書き方の指針）だけ wiki に載せれば足りる
- ESLint の `ignores`（対策C）— ビルド時間ではなく開発環境の問題。deployment.md の管轄外。
  実施するなら `eslint.config.mjs` のコメントが一次情報になる
- `data/players/index.json` の毎ページパース（対策E）— 前回の一般則の適用漏れであり、
  wiki には既に一般則が書いてある。個別箇所の列挙は raw に留める

まだ書き戻していないもの:

- 対策 A〜E はいずれも**未実装**。実装したら結果を追記すること

---

## 追記: 対策 A / C / E を実施（同日）

「リスクが低いものは実施」の指示で A・C・E を入れた。B（`_facts` の移動）は未実施。

### A. `process.cwd()` + spread を潰した

| ファイル | 変更 |
|---|---|
| `lib/secondaryschool.ts` | `path.join(process.cwd(), ...DATA_DIR, file)` → `'data', 'secondaryschool'` をリテラルに |
| `lib/clubTransition.ts` | `...DETAILS_ROOT` → `'data', 'tournaments', 'details'` |
| `lib/qualifierFinishers.ts` | 同上 |
| `src/pages/tournaments/[generation]/[tournamentId]/index.tsx` | 同上（2箇所）。**調査時に見落としていた4つめ** |

4つめは lib 3件を直しても `<project>/**/*` が消えなかったことで発覚した。
特定方法が有用だったので残す: ビルド後の `.next/server/pages/**/*.nft.json` を読み、
`.venv` / `.claude` / `docs/` のような**明らかに無関係なパスを含む trace ファイル**を探す。
`tournaments/[generation]/[tournamentId].js.nft.json` だけが 62,477 件の無関係ファイルを
含んでいた ＝ そのエントリが全体 glob の発生源。

各変更箇所には「なぜリテラルで書くのか」のコメントを入れ、wiki へのリンクを張った。

### C. `eslint.config.mjs` に `ignores` を足した

`.next` / `out` / `data` / `public/data` / `.venv` / `.claude` / `coverage` /
`next-env.d.ts` と、`.gitignore` 済みの `scripts/dgsks` `scripts/pdf/output`
`scripts/highjap/data` `tools/*/initialPlayer.js`。

**`npx eslint .`: 10分でも終わらない → 16秒。**

副作用: これまで完走しなかったため露出していなかった **既存エラー6件**が見えるようになった
（今回の変更とは無関係、`src/` `lib/` 以外）。

- `global.d.ts:6` `@typescript-eslint/no-explicit-any`
- `scripts/build-team-master.mjs:155` 未使用変数 `nulled`
- `scripts/highschool/write-pipeline-marker.mjs:10` 未使用 import `process`
- `scripts/normalize-team-spacing.mjs:78` 未使用変数 `apply`
- `scripts/normalize-to-participants-entries.cjs:40,55` 未使用 `err`

いずれも自明な修正だが、ビルド時間とは無関係なので今回は触っていない。
`npm run lint` は exit 1 になる。

### E. `data/players/index.json` の共有キャッシュ

`lib/playersIndex.ts` を新設し、`getPlayerIndex()` / `getPlayerNameToId()` /
`getPlayerIdToName()` を出した。返り値はプロセス内共有の読み取り専用。

`lib/players.ts` に足さなかったのは、同ファイルの `getAllPlayers()` が
`data/players/*/information.json` を走査しており、これを import したページが増えると
**nft の `data/players/**/*` glob が増える**ため。`index.json` 1ファイルしか触らない
新モジュールに分けた。

置き換えた5ルート（いずれもキャッシュ無しで毎ページ 9.8ms の再パースをしていた）:

- `src/pages/highschool/[gender]/[prefectureId]/[teamId].tsx`
- `src/pages/teams/[teamId]/[year]/[gender].tsx`
- `src/pages/teams/[teamId]/index.tsx`
- `src/pages/st-league/[year]/teams.tsx`
- `src/pages/tournaments/.../[gender]/index.tsx`（`playerIdToNameMap` も共有化）

`src/pages/tournaments/[generation]/[tournamentId]/index.tsx` は元から
`cachedPlayerNameToId` を持っていたので触っていない。

### 結果（ローカル実測）

| | 修正前 | 修正後 |
|---|---|---|
| `npx next build` | **55分たっても compile が終わらない**（打ち切り） | **141秒**（コールドキャッシュ）/ **79秒**（ウォーム）、exit 0 |
| `<project>/**/*` glob | 2〜12回 | **0回** |
| `npx eslint .` | 10分でタイムアウト | 16秒 |
| 生成ページ | — | 4,485ページ / `out/` 4,462 HTML |

ルート別（合計ms・並列合算）:

| ルート | 合計 | ページ数 | 1ページ |
|---|---|---|---|
| `/players/[id]/results` | 1,302s | 1,917 | 679ms（7/19: 1,239ms）|
| `/teams/[teamId]/[year]/[gender]` | 302s | 338 | 892ms（7/19: 1,467ms）|
| `/tournaments/.../[gender]` | 109s | 約500 | 約220ms |
| `/teams/[teamId]` | 57s | 67 | 850ms |
| `/highschool/[gender]/[prefectureId]/[teamId]` | 37s | 約880 | 42ms |

**注意: ローカルの数値であり Cloudflare の実数ではない。**
ローカルには `.venv` / `.claude/worktrees` / `out/` があるため全体 glob の被害が大きく出る。
Cloudflare 側の改善幅は次のビルドログで確認すること。

### 出力の検証

修正後のビルド成果物で、変更が効く箇所を目視確認した。

- `out/secondaryschool/**` が生成され本文が入っている（`lib/secondaryschool.ts`）
- `out/tournaments/junior/secondaryschool-championship/` に「地域クラブ」節がある（`lib/clubTransition.ts`）
- `out/tournaments/international/asian-games/` に予選会の上位進出者（優勝4・準優勝4・ベスト4×8）と
  免責文言がある（`lib/qualifierFinishers.ts`）
- 高校チームページ 40件中9件、チームページ 30件中22件に `/players/{id}/results` へのリンクがある
  （共有キャッシュ経由でも従来どおりリンクが張れている。9/40 なのは count>=5 の閾値のため）
- `tsc --noEmit` パス、変更ファイルの eslint パス

### 残件

- **B（`_facts` を `data/` の外へ）は未実施。** `data/players/**/*`（18,526ファイル）×7回と
  `data/**/*`（20,172ファイル）×1回が残っている。
- Cloudflare 実機での前後比較。
- ESLint 既存エラー6件。

## Compile Log（追記分）

docs/wiki/deployment.md に反映したもの:

- nft の全体 glob 発生源の**特定方法**（`.nft.json` に無関係なパスが混じっていないか見る）。
  再発時にそのまま使える手順なので wiki 側に置く価値がある
- 対策 A・E 実施済みという現況（wiki は現状を書く場所なので）
- `lib/playersIndex.ts` の存在と「返り値は読み取り専用」という制約

意図的に wiki へ載せなかったもの:

- ローカルの前後タイム（55分→141秒/79秒）— 環境依存が大きく、Cloudflare の数値と混ざると誤解を生む。
  wiki のビルド時間表は Cloudflare 実測が入る場所なので、次のデプロイまで更新しない
- ルート別の秒数テーブル — 前回同様、対策で陳腐化するため raw に残す
- ESLint 既存エラー6件と `ignores` の中身 — `eslint.config.mjs` のコメントが一次情報
- `lib/players.ts` ではなく新モジュールにした理由 — `lib/playersIndex.ts` の冒頭コメントが一次情報

まだ書き戻していないもの:

- 対策 B は未実施のまま。Open Questions には既に nft の項目があるのでそこに含める

---

## 追記2: 対策 B を実施（playerStats 生成物を `data/` の外へ）

### 置き場所

`data/players/_facts` / `_index` / `_manifest.json` → **`.playerstats/_facts` / `_index` / `_manifest.json`**。

リポジトリ直下にした理由は、nft が glob するのは `data/**` と `data/players/**` であって
リポジトリ直下の隠しディレクトリではないため。`.gitignore` は4行を `.playerstats/` の1行にまとめた
（`data/players/_agg/` は**コードから一切参照されておらず**、ディスク上にも存在しなかったので落とした。
2026-07-01 の設計メモにある L2 集計キャッシュの構想が実装されなかった名残）。

葉の名前（`_facts` 等）は**変えていない**。ドキュメントとログ文字列に多数出てくるため、
親ディレクトリだけ移すほうが差分も誤りも少ない。

パスは全てリテラルで書いた（配列 spread を使わない。追記1の nft の話と同じ理由）。

### 変更したファイル

コード7箇所:

- `lib/playerStats/playerStatistics.ts`（facts キャッシュの読み出し）
- `lib/playerStats/manifest.ts`（`MANIFEST_PATH`）
- `lib/playerStats/reverseIndex.ts`（`REVERSE_INDEX_PATH`）
- `scripts/playerStats/generate-facts.ts` / `generate-rankings.ts`（`FACTS_DIR`）
- `scripts/playerStats/verify-golden-final.ts` / `generate-analysis.ts`
- `scripts/playerStats/cache-sync.mjs`（`TARGETS`）

そのほか `.gitignore`、`lib/players.ts` と `src/pages/players/[id]/index.tsx` の
「`_facts` を除外している」というコメント（移動で意味が変わるため）。

### 移行時の一度きりの副作用

`cache-sync.mjs` の `TARGETS` の `rel` が変わったため、Cloudflare のビルドキャッシュに
残っている**旧レイアウトのキャッシュは「不完全」と判定される**。restore が拒否され、
移行後の初回ビルドだけ `generate-facts` がフルビルド（約2分）になる。
これは既存の fail safe がそのまま働くだけで、2回目以降は元通り増分に戻る。

### 効果（ローカル実測）

| glob | 移動前 | 移動後 |
|---|---|---|
| `data/players/**/*` | 18,526ファイル / 601ms | **53ファイル / 10ms** |
| `data/players/**/*/information.json` | 523ms | 10ms 未満 |
| `data/**/*` | 20,172ファイル / 801ms | **1,699ファイル / 86ms** |
| nft の glob 合計（ウォーム再計測） | 28.0秒 | **2.9秒** |

glob 呼び出し回数は284回で変わらない（減らしたのは1回あたりのマッチ数）。
ビルド全体は 79秒 → 71秒、exit 0、4,462 HTML で移動前と同数。

### 検証

- `npm run playerstats:facts`: 増分が効いている（14ファイル変更 → 2,691選手を再生成、11秒。
  再実行で `no changes` 0.8秒）。manifest を新パスから読めていることの証拠
- `cache-sync save` → `.playerstats` を退避 → `restore`: 18,473ファイルの md5 総和が**完全一致**
- `npm run playerstats:test`: 33 passed, 0 failed
- **`verify-golden-final`: 76選手（fixture 26 + ランダム50）で ok=76 / cacheMismatch=0 /
  noCache=0**。`_facts` キャッシュが新パスから読めており、かつ内容がソースからの再計算と
  一致していることを同時に示すのでこれが最も強い証拠
- `/players/[id]/results` のビルド時間 1,570秒 → 1,402秒（合計）。キャッシュを見失っていたら
  全選手の再計算になって激増するはずなので、ここでも読めていることが裏づけられる
- `tsc --noEmit` パス。`npx eslint .` のエラーは既存6件のまま増減なし
- 出力の目視: `/players/{1,5,100,500}/results` に通算成績が入っている、`/rankings` が生成されている

### 既知の未解決（今回の変更とは無関係）

`npm run playerstats:verify` の1つめ `verify-facts-golden.ts` が **26人中14人で DIFF**。
いずれも facts のほうが golden より試合数が多い方向で、golden は同スクリプトに
ハードコードされており最終更新が **2026-07-02**（`git log` で確認）。
その後のデータ投入で増えたぶんが差分になっている。
2026-07-19 の raw ノートで「golden fixture の陳腐化」として2件記録されていたものが、
データ追加に伴って14件まで広がった形。**`playerstats:verify` は prebuild に入っていないので
ビルドは落ちない。** golden の更新が必要だが、ビルド時間の話とは別問題なので今回は触っていない。

## Compile Log（追記2分）

docs/wiki/deployment.md に反映したもの:

- 生成物の置き場が `.playerstats/`（`data/` の外）であることと、その理由
- 「今後ビルド生成物を足すときも `data/` 配下には置かないこと」という一般則。
  これが今回いちばん再利用価値がある
- 移動前後の glob マッチ数の比較表（構造的な事実で、対策の効果を示す最小限の数値）
- ビルドキャッシュのレイアウト変更で移行後の初回だけフルビルドになること（運用者が知る必要がある）

docs/wiki/players-pages.md / team-player-identity.md に反映したもの:

- `_facts` / `_index` / `_manifest.json` の新しいパス（手順書のコマンドを含む）

docs/adr/ADR-011 の扱い:

- **Decision 本文（26行目・28行目の `data/players/_manifest.json` 等）は書き換えていない。**
  ADR は当時の意思決定の記録なので、実装が動いても本文は歴史として残す（AGENTS.md の ADR ルール）
- 現状を指す **Related Files 節のパスだけ更新**し、移動した旨の1行を添えた

意図的にどこにも書き戻さなかったもの:

- 葉の名前を `_facts` のまま据え置いた判断 — 差分を小さくするための実務判断で、
  一般則にはならない。この raw ノートに残せば足りる
- `data/players/_agg/` を .gitignore から落とした件 — 未実装の構想の残骸で、
  wiki に書くと逆に「あったもの」と誤解される
- `docs/wiki/players-pages.md:374` の古い設計スケッチ（`scripts/generate-player-facts.mjs` 想定・
  `_agg` を含む）— 存在しないスクリプト名を挙げている時点で計画メモと読めるため、
  パスだけ直しても意味が無い。触っていない
- `docs/ui/deliverables/01-inventory.md:215` の `data/players/(... _facts, _index)` —
  当時の棚卸し成果物であり、現状ドキュメントではないので更新対象外とした
- `verify-facts-golden` の陳腐化14件 — ビルド性能とは別問題。上に事実だけ記録した

docs/wiki/open-questions.md に起票したもの:

- `verify-facts-golden.ts` の golden 陳腐化（26人中14人）。2026-07-19 の raw ノートで
  「起票すべき」とされたまま残っていたもの。データが増えるたびに広がるため、
  放置すると verify が常時赤くなって本物の退行を隠す、という点まで書いた

まだ書き戻していないもの:

- なし
