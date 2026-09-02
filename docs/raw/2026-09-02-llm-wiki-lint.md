# LLM Wiki lint（リポジトリ全体ヘルスチェック）

実施日: 2026-09-02
対象: `docs/**`（.md 全201ファイル）＋ `AGENTS.md`、突き合わせ先は `src/**` / `lib/**` / `scripts/**` / `package.json`
種別: 定期ヘルスチェック（矛盾・孤立ページ・知識ギャップ・次に聞くべき問い）
前回の実施: [2026-08-12-llm-wiki-lint.md](./2026-08-12-llm-wiki-lint.md)（21日前）

---

## 0. サマリー

- **構造の健全性は前回より良い**。リンク切れ0件（検出3件は 見出し行に `players/[id]` と丸括弧の説明を並べた
  Markdown リンク風の地の文＝誤検知）、ADR 17本すべて Status 記入済み、
  `docs/wiki/*.md` 全32ページが `index.md` から到達可能、ADR 17本すべて `adr/README.md` に掲載済み。
  前回 lint で入れた索引（`adr/README.md` の一覧表・`docs/README.md` の分類外文書節）が効いている。
- **前回の宿題は3件が解けた**。`docs/sql/APPLIED.md`（差分DDL台帳）の新設、Compile Log 遡及の
  打ち切り明文化（AGENTS.md）、CI スクリプト2本の docs 未言及。
- **最大の穴は「実装が進んだページの棚卸し」でなく `prebuild` の記述だった**。
  `deployment.md` / `data-import.md` が3段のまま実態は15段（うち5段はビルドを止めるゲート）。
  本 lint で修正。
- **write-back の型は定着したが、最後の一歩が抜ける**。Compile Log は 2026-08-13 以降の
  raw 36本中29本に付いており運用は生きている。抜けるのは
  (a) 作業リスト型ノートの Compile Log、(b) **wiki から raw へ戻るリンク**（4本が孤立）、
  (c) ノート自身が残タスクに書いた write-back（1本）。(b)(c) は本 lint で解消。
- **未コンパイルの設計が1本あった**（`2026-08-31-player-registered-name-change.md`）。
  wiki のどこにも無い決定が3つ入っていたので書き戻した。

---

## 1. 修正済み（本 lint で直したもの）

| 対象 | 内容 |
|---|---|
| `docs/wiki/deployment.md` | `prebuild` の記述を実態に更新（「players JSON と beta-matches JSON の生成」→ ゲート5段＋キャッシュ復元＋生成9段の15段）。`postbuild` も3スクリプトに更新 |
| `docs/wiki/data-import.md` | 同上（取り込み系に効くゲートを明示）。`highschool_championship_entries.py` 節から座標ベース分割の raw へリンク |
| `docs/wiki/team-player-identity.md` | **「選手の登録名変更（改名）」節を新設**（未実装の設計。`2026-08-31` の write-back）。`神戸松陰`→`神戸松蔭` の未対応 alias を既知の残課題に追加 |
| `docs/wiki/open-questions.md` | 「ドキュメント運用」節を 2026-09-02 の実態に更新（解決3件を落とし、新規4件を起票） |
| `docs/wiki/players-pages.md` | 2026-07-01 の設計スナップショット節に注記。`scripts/generate-player-facts.mjs` 想定 / `data/players/_facts/` は現行と異なる（実際は `scripts/playerStats/generate-facts.ts` / `.playerstats/`） |
| `docs/wiki/st-league.md` / `monetization.md` / `public-pages.md` | 孤立していた raw 3本への出典リンクを追加 |
| `docs/wiki/idea-backlog.md` | 索引表の「最終更新」が 2026-08-28 のまま中身は 2026-09-01 だったため更新 |
| `docs/raw/2026-08-31-player-registered-name-change.md` | Compile Log を追記（今回実際にコンパイルしたため） |

## 2. 機械チェックの結果

| 項目 | 結果 |
|---|---|
| リンク切れ | **0件**（検出3件はすべて `docs/adsense-ui-proposal.md` の見出しで、角括弧のパス表記の直後に丸括弧の説明が来る型の誤検知） |
| 絶対 `file:///` パス | 0件（前回13件を修正済み・再発なし） |
| ADR Status 記入 | 17/17。Draft 1本（ADR-004）、他は Accepted。Deprecated / Superseded は0 |
| `adr/README.md` への掲載 | 17/17 |
| `wiki/index.md` への掲載 | 32/32 |
| 孤立ページ（被リンクもファイル名言及も0） | 修正前7件 → **修正後3件**（`docs/ui/reports/phase-{2,3,4-8}-report.md`。`ui/PROJECT.md` がパターンで参照しているため実質OK） |
| Compile Log（2026-08-13 以降に追加された raw） | 36本中 **29本あり / 7本なし** |
| `scripts/**` のうち docs 未言及 | 77本中6本（うち `fix-kawasaki-kohei-supabase-name.mjs` 等は使い捨て） |

`backend.md` の API エンドポイント一覧は `src/pages/api/**` の11ルートと**全一致**（差分なし）。

---

## 3. 矛盾・ドリフト（要判断）

### 3-1. `prebuild` の記述が実態と2倍以上ずれていた ★実害あり・修正済み

`deployment.md`・`data-import.md` はどちらも「players JSON と beta-matches JSON の生成」相当の
3段構成として `prebuild` を説明していたが、実際は15段で、うち**5段はビルドを止めるゲート**
（`check-tournament-entries` / `check-tournament-insights` / `check-highschool-pipeline-freshness` /
`check-name-splits --strict` / その前段の `normalize-team-spacing`）。
これは「ビルドが落ちたときに何を疑えばいいか」が docs から読めない状態で、
新しくゲートを足した側（2026-08-29 の `check-name-splits --strict` 等）が
既存の説明文を見直していないために起きている。

**この2ページは前回 lint の「2026-05-24 の4ページは内容はほぼ正しい」の一部**だった
（`data-import.md` はその後更新されている）。今回の発見は、その評価が
**「エンドポイントや列のような静的な事実は正しいが、直列の手順のように後から要素が足される
ものはズレる」**という形で条件付きだったことを示している。

### 3-2. 設計ノート1本が wiki に届いていなかった ★修正済み

`2026-08-31-player-registered-name-change.md`（選手の登録名変更をどう名寄せするか）には
決定が3つ入っている——`scope` 必須、アプリ層でなくデータ本体を書き換える、正準は改名後——が、
wiki のどこにも無かった。ノート自身が残タスクに「wiki への書き戻し」と書いており、
**忘れられていたのでなく「未了のまま次の作業へ移った」**型。
本 lint で `team-player-identity.md` に節を新設し、未実装の残タスクを open-questions へ起票した。

なお同ノートで見つかった `神戸松陰大学`（陰）→ `神戸松蔭大学`（蔭）の異体字は**未対応のまま**で、
`data/teams/teams.json` に id 3878 の独立エンティティとして残っている。

### 3-3. `players-pages.md` の設計スナップショットが現行パスと食い違う ★注記で対応

「設計の核（単一プリミティブ方式）」節（2026-07-01）は
`scripts/generate-player-facts.mjs` 想定 → `data/players/_facts/{id}.json` と書いているが、
現行は `scripts/playerStats/generate-facts.ts` → `.playerstats/_facts/`（2026-08-28 に移動）。
同じページの別の節（211行目付近）には正しい記述があり、**1ページ内で新旧が同居**していた。
設計の考え方自体は生きているので削除せず、注記で「これは 2026-07-01 のスナップショット」と明示した。

### 3-4. `idea-backlog.md` の「一言サマリ」が一言でない

ページ冒頭が「所在地インデックス＋一言サマリのみを持つ（重複管理はしない）」と宣言しているのに、
1セルが数千字ある（最長は「skillのローカルLLM代替」行で、単独で通常の wiki ページ1本ぶん）。
索引を読むより各エリアページを読む方が速い状態で、**索引の責務が壊れている**。
前回 lint の指摘（索引が1週間遅れている）は同期の話だったが、今回は分量の話。
判断が要るので open-questions に起票した。

---

## 4. 孤立ページ

真の孤立は修正前7件、修正後3件。

| ファイル | 判定 |
|---|---|
| `docs/raw/2026-08-12-st-league-in-tournaments-list.md` | **修正済み**。Compile Log は「`st-league.md` に採用」と書いているのに、`st-league.md` 側から出典へのリンクが無かった |
| `docs/raw/2026-08-20-interhigh-name-split-coordinate-fix.md` | 同上（`data-import.md`） |
| `docs/raw/2026-08-25-adsense-expansion-footer-slot.md` | 同上（`monetization.md`） |
| `docs/raw/2026-08-25-breadcrumb-jsonld-dedup.md` | 同上（`public-pages.md`） |
| `docs/ui/reports/phase-{2,3,4-8}-report.md` | **実質OK**。`ui/PROJECT.md` が `reports/phase-N-report.md` とパターンで参照 |

**分かったこと**: 孤立の原因は「write-back していない」ではなく、**write-back の向きが片道**
だったこと。4本とも Compile Log は充実しており、wiki へ内容は載っている。
欠けていたのは wiki → raw の出典リンクだけ。
AGENTS.md の相互リンク規約は「新しい wiki ページを足したとき」に掛かる書き方で、
**既存ページに raw から節を足したときの戻りリンク**は明文化されていない。

---

## 5. 知識ギャップ

### 5-1. Compile Log 欠落7本（2026-08-13 以降の新規36本中）

前回の26本は AGENTS.md への適用開始日明記で打ち切られたが、**ルールが有効な期間に
新しく7本溜まった**。内訳は2種類に分かれる。

- **作業リスト型（4本）**: `2026-08-12-secondaryschool-teamid-review`（teamId 目視確認250件）、
  `2026-08-12-secondaryschool-release-checklist`、`2026-08-20-zennihon-workers-2022-general-boys-review`、
  `2026-08-13-player-name-variants-review`。**wiki へ載せるものが元々無い**可能性が高い。
- **調査・設計型（3本）**: `2026-08-12-university-team-name-cleanup`、`2026-08-15-m4-gsc-review`、
  `2026-08-31-player-registered-name-change`。前2本は wiki 側から参照されており内容は届いているが、
  何を落としたかは記録されていない。3本目は本 lint で書き戻し＋Compile Log 追記済み。

「作業リスト型に Compile Log を求めるか」が決まっていないため、**義務なのか免除なのかが
書き手ごとに揺れている**のが実態。ルールの穴であって怠慢ではない。

### 5-2. 解決済み Open Question が3節に増えた（前回1節）

`open-questions.md` は 251行・17節 → **417行・23節**に増え、うち3節が「解決」と書かれたまま残る
（「全国大会」判定の二重基準 / ブラケット復元と決勝Tの席順 / アジア競技大会2025 女子準決勝リーグ）。
前回 lint の指摘が21日で3倍になった形で、**放置すると「未解決の一覧」として読めなくなる**。

### 5-3. 中断案件の再開トリガーは依然として未適用

`docs/exploration-cycle-audit-2026-08-10.md` §1-7 の提言（全ての中断案件に再開条件を統一
フォーマットで持たせる）は3週間経っても未適用。`docs/ui/project-status.md` は
「次: M5（トークン導入）… 着手可」のまま 2026-07-04 から2ヶ月停止しており、再開条件の記載なし。
再開トリガーの記載があるのは `open-questions.md` の1行（AIとの共同探索）のみ。

### 5-4. lint の機械化は未着手

前回の提案（`scripts/check-docs-lint.mjs`）は実装されていない。本 lint で実際に機械判定できたのは
リンク切れ・`file:///`・孤立ページ・ADR Status・`index.md` 到達性・Compile Log 有無・
undocumented scripts の7項目で、**今回もこの7項目には新しい発見がほぼ無かった**
（構造は健全だった）。判断が要ったのは §3 のドリフト4件で、そこは機械化できない。
**機械化の価値は「発見」でなく、人と LLM の時間を §3 に集中させること**にある。

---

## 6. 次に聞くべき問い

1. **作業リスト型の raw ノートに Compile Log を求めるか。** 免除するなら AGENTS.md に
   例外を書く（「wiki へ載せる候補が無いノートは『作業リスト・write-back 対象なし』の1行でよい」等）。
   求めるなら、その1行を必ず書く。**どちらかに決めないと沈黙の意味が読めない**という
   元の問題が形を変えて残る。
2. **wiki の既存ページに raw から節を足したとき、出典リンクを戻すことを規約にするか。**
   今回の孤立4本はすべてこの型だった。AGENTS.md の相互リンク規約は「新規 wiki ページ」にしか
   掛かっていない。
3. **`idea-backlog.md` の索引を分量で縛るか、責務を変えるか。** 1セル数千字は索引ではない。
   上限（例: 200字）を決めて各エリアページへ寄せるか、「索引＋一言サマリ」という設計自体を捨てるか。
4. **解決済み Open Question の置き場を決めるか。** 3節が滞留している。
   Deprecated 化して残す／`docs/wiki/decisions-log.md` のような別ページへ移す／消して
   git 履歴に任せる、のいずれか。
5. **`docs/sql/receive-order.sql` は本番 Supabase に適用済みか。** 前回の宿題で台帳
   （`docs/sql/APPLIED.md`）は出来たが、この1行だけ「未確認」のまま。
   未適用ならポイント入力のレシーブ選手自動推定が動いていない。
6. **`docs/ui/**` の M5 を再開するか、Deprecated にするか。** 2ヶ月停止しており、
   「着手可」という状態表示だけが古い。再開トリガー統一フォーマット（5-3）の最初の適用先候補。
7. **lint を機械化するか（前回からの持ち越し）。** ただし今回の実測では、機械項目の発見は
   ほぼゼロだった。**CI に載せる価値は回帰防止（前回直した `file:///` が再発していないことの担保）**
   であって新規発見ではない、という前提で判断したい。

---

## Compile Log

本ノートは lint の実行記録そのもの。§1 の表が wiki へ反映した全量で、
§6 の問いは `docs/wiki/open-questions.md`「ドキュメント運用」節へ起票した（5・6・7 は前回からの継続項目）。

意図的に載せなかったもの:

- lint スクリプト本体（リンク走査・孤立判定の Python）— 使い捨て。前回と同じ理由で、
  機械化するなら 6-7 のとおり `scripts/` に実装し直すべきで、ここに貼っても再利用されない。
- 誤検知だったリンク切れ3件の詳細 — 見出しで角括弧のパス表記と丸括弧の説明が隣接する記法が原因で、
  修正不要。再走査時に同じ結論になる。
- ADR 17本の Status 全文 — `adr/README.md` の一覧表が正。ここに写すと二重管理になる。
- `src/pages/api/**` 11ルートと `backend.md` の突き合わせ結果 — **全一致**のため記録すべき差分がない
  （一致していたこと自体は §2 の表に1行だけ残した）。
- undocumented scripts 6本の一覧 — うち4本は使い捨て（`fix-kawasaki-kohei-supabase-name.mjs` 等）で、
  docs に書く方が害。残り2本（`build-secondaryschool-teamid-todo.mjs` /
  `generate_roundrobin_convert.py`）も単独では起票する粒度に満たないため §2 の件数だけ残す。
- wiki 32ページの git 最終更新日一覧 — 「古い＝間違い」ではないことが §3-1 で改めて確認された
  （古い `data-import.md` でなく比較的新しい記述の側がズレていた）ため、日付の一覧は
  判断材料にならない。

---

## 追記: open-questions.md の整理（同日）

lint に続けて `docs/wiki/open-questions.md`（23節・417行）を棚卸しした。
**「解決できそうなものはあるか」を実装との突き合わせで判定**した結果が以下。

### 実装を見たら解けていたもの（本文から外した）

| 項目 | 判定根拠 |
|---|---|
| 高校カテゴリのチーム名対応表を全大会へ広げるか（648箇所） | `normalize-team-names.mjs --scope=all --dry-run` を実行 → **0ファイル/0箇所** |
| `points.result_type` の正式 enum はあるか | winner 7値＋error 7値＋旧データ用2値。`lib/matchLogic.ts` / `lib/matchAnalysis/helpers.ts` / beta 試合詳細ページの3箇所に定義 |
| `matches.status` / `processing_status` の状態遷移 | 書き込み箇所を全数確認。`draft→in_progress→completed` と `draft→reviewing→committed`。**`archived` / `ready` / `processing` は読み書き0の死んだ値** |
| `edit_token` 撤去の段取り | `src/**` / `lib/**` / `src/types/database.ts` から**既に消えている**。残るのは `generate-beta-matches-json.mjs` の除外名リストと Supabase の実カラム |
| 試合詳細の beta 昇格（検討中 2026-06） | ネスト URL のページは 2026-07-02 に実装済み。逆引き表も `reverse/by-{tournament,player}.json` で生成済み |
| 逆引き表は全選手1ファイルで足りるか | `by-player.json` 29KB / `by-tournament.json` 10KB（25試合時点）。**足りている** |
| `lib/matchAnalysis` と `lib/growthAnalysis` の責務境界 | 2026-08-12 に解決済みの取り消し線が残っていただけ |
| 解決済み節が本文に居座る問題 | 末尾に「解決済み（記録）」を新設し6件を移設。lint §6-4 の問いはこれで閉じた |

### 記述が事実と食い違っていたもの（訂正した）

- **`verify-facts-golden.ts` の母数の説明**: 「`CURATED_FIXTURES` は26エントリだが slug を持つのは22件で、
  `if (!fx.slug) continue` が4件を飛ばす」は誤り。`CURATED_FIXTURES` は **22件で全件 slug つき**、
  slug 無しの4件は別定数 `HIGH_VOLUME_FIXTURES` 側にあり verify は読まない。**この continue は一度も発火しない**。
  母数22という結論だけが偶然合っていた。
- **`entries[].type` の残存量**: 「90ファイル中26」→ 実測で**予選リーグ/`knockoutDraw` を持つ112ファイルの全件**。
  さらに「表示・検証はもう読まない」も誤りで、`lib/bracketLayout.ts` はノックアウトのみの大会で今も読む。
- **`data-import.md` のエイリアス一覧**: 「登録済み7校＋判断保留2件」→ 実際は **722エントリ**で、
  保留とされていた `県岐阜商` / `富士見` は**どちらも登録済み**。一覧を wiki に置く意味が無くなっていたので
  「対応表そのものが正」に差し替えた。
- **`normalize-team-names.mjs` のインライン圧縮形式での置換漏れバグ（2026-07-17）** が
  open-questions にしか書かれていなかったので `data-import.md` へ移した。

### 実測して初めて深刻さが分かったもの

- **highschool パイプラインの鮮度チェックが実質ほぼ効いていない。**
  ゲート `check-highschool-pipeline-freshness.mjs` は `details/highschool*/` だけをハッシュするが、
  生成側の `extract.py` は22大会を読む。**うち19大会がハッシュ対象外**で、しかも件数の主力が
  そちら側（`zennihon-university` 4,308 / `zennihon-workers` 3,642 / `zennihon-singles` 2,813 件）。
  全日本選手権や社会人を取り込んでも**チェックは緑のまま生成物が古くなる**。
  修正は `findHighschoolSourceFiles()` を `extract.py` と同じ対象集合にするだけだが、
  広げた瞬間に既存マーカーと不一致になりビルドが止まる（パイプラインを1回流せば解消）。
- **`surface` の語彙**: 実在値は `砂入り人工芝` 21 / `人工クレー` 6 / `クレー` 1 の3種のみで、
  `data-model.md` の語彙にある `ハード` と `木床フローリング` は**実データに0件**。
- **`verify-facts-golden` のカバレッジ穴は1行で閉じる**: `tsukamoto-hikaru`（塚本光琉・id 159）を
  `lib/playerStats/fixtures.ts` に足すだけ。`playerstats:verify` は `prebuild` に無いのでビルドに影響しない。

結果、節数 23 → 23（解決済み6件を末尾の記録へ移し、新たに実装確認で答えの出た項目を回答として本文に残した）。
行数は 417 → 513 に増えたが、**増分は「答え」と「実測値」で、問いの数は減っている**。

## 追記2: open-questions から出た2件の実装（同日）

「解決できそうなもの」のうち、コード変更が要る2件をユーザー判断で実施した。

### 1. highschool パイプラインの鮮度チェックの守備範囲

**やったこと**: 入力範囲の定義を `scripts/highschool/lib/pipeline-sources.json` に切り出し、
`02result/extract.py`（除外リスト）と `lib/source-hash.mjs`（ハッシュ対象）が同じファイルを読むようにした。
`source-hash.mjs` には `findPipelineTournamentIds()` を足し、
**01team が読む `highschool*` と 02result が読む22大会の和集合**を返す形にした。

- ハッシュ対象: **13大会・122ファイル → 32大会・292ファイル**
- 除外リストは移設前後で完全一致することをスクリプトで確認（14件・差分0）

**単に対象を広げるのでなく共有ファイルにした理由**: 元の不具合は「片方だけが育って、
もう片方が気付けない」という型で、対象を広げるだけでは同じことがまた起きる。
除外する大会を増やすときに触る場所を1つにするのが本体の修正にあたる。

**副産物（想定外）**: 広げた直後にゲートが落ちたのでパイプラインを再実行したところ、
`scripts/highschool/**` の中間生成物が**1コミットぶん古いまま**だと分かった
（`01team/teams.json` +32行 / `02result/results.json` +7,772行 /
`03list/prefecture-summary.json` +10,416行、いずれも純増）。直前のコミット（インハイ2014）が
`data/highschool/*`（サイトが読む側）だけを commit していたため。
**再生成した中間生成物は `data/highschool/*` と JSON として完全一致した**ので、
公開データに誤りは無く、リポジトリ内の中間生成物だけが遅れていた。
つまり今回のゲート拡張が拾ったのは「古い公開データ」ではなく「commit 漏れ」。

### 2. `verify-facts-golden` のカバレッジ穴

`lib/playerStats/fixtures.ts` の `CURATED_FIXTURES` に
`tsukamoto-hikaru`（塚本光琉・id 159）を追加。**23件 = `analysis.json` 23人で一致**。
再発防止に、配列の JSDoc へ「`analysis.json` を増やしたらここにも足す」旨と確認方法を書いた。

**踏んだ落とし穴**: その JSDoc に確認コマンドとして `data/players/*/analysis.json` を書いたら、
パス中の `*/` がブロックコメントを途中で閉じてしまい `TS1160: Unterminated template literal` になった。
コメント内でパスを書くときはグロブを避ける。

### 検証

- `node scripts/check-highschool-pipeline-freshness.mjs` → 緑
- `node scripts/check-name-splits.mjs --strict` → 検出0件
- `npm run highschool:pipeline` 完走（1コマンドで5ステップ＋マーカー書き込み）
- `npx tsc` で `fixtures.ts` 単体パース → エラーなし
- **未実施**: `npm run lint` と `npm run build`。この worktree は `node_modules` が空で、
  eslint / next / @types が入っていないため実行できない（`tsc -p scripts/playerStats/tsconfig.json`
  も `TS2688: Cannot find type definition file for 'node'` で止まる。これは環境要因で、変更とは無関係）。

## Compile Log（追記分）

上記の判定はすべて `docs/wiki/open-questions.md` と `docs/wiki/data-import.md` へ反映済み。

意図的に載せなかったもの:

- 各判定に使った grep / node コマンドの全文 — 再実測できるものは wiki 側に1行で残した
  （`--scope=all --dry-run`、`surface` の集計コマンド）。残りは使い捨て。
- `result_type` の出現回数の内訳（`winner` 62回など）— 語彙の確定が目的で、頻度は判断に効かない。
- `entries[].type` の値分布の全数（`packing` 18,018 等）— wiki には規模感として残したが、
  ファイル単位の一覧は git で追えるので載せない。
- 「試合詳細の beta 昇格」で確認した実装ファイルの一覧 — `score-site-link.md` の「影響範囲」節が
  既に同じ一覧を持っている（そちらが正）。

追記2（2件の実装）ぶんの反映先:

- 鮮度チェックの対象拡大と `pipeline-sources.json` の役割 →
  `scripts/highschool/README.md`（ディレクトリ構成に `lib/` を追加＋「入力範囲は
  lib/pipeline-sources.json が唯一の定義」節）と `open-questions.md`「解決済み（記録）」
- `verify-facts-golden` のカバレッジ解消 → `open-questions.md` の該当節（取り消し線＋結果）

意図的に載せなかったもの:

- 中間生成物の差分行数の内訳（どの学校が増えたか）— commit 漏れの遅れを取り戻しただけで、
  `data/highschool/*` と一致した以上、内容としての意味は無い。数字だけ記録に残す。
- `findPipelineTournamentIds()` の実装コード — ソースが正。wiki に写すと二重管理になる。
- JSDoc の `*/` でコメントが閉じた件 — 一度きりのつまずきで、直したコードに残っている
  （本ノートには再発防止の教訓として1行だけ残す）。
