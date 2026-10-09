# LLM Wiki の設計を ①〜⑩ の順に見直す（2026-10-09〜）

> 適用範囲: 汎用（docs の運用設計。ソフトテニスには依らない）

## きっかけ

ユーザーが、このリポジトリの LLM Wiki を次の順に考え直したいと提示した（2026-10-09）。
①思想 → ②Raw/Wiki/Schema → ③AGENTS.md → ④Page type → ⑤Entity/Concept/Feature/Procedure →
⑥Ingest → ⑦Query → ⑧Lint → ⑨Agent との接続 → ⑩AIDD 開発環境への統合。
1ステップずつ、現状を実物で確かめてから決める。決定はこのノートに追記する。
（`idea-` 接頭辞は idea-backlog の索引義務を伴うので付けない。製品アイデアではなく docs 設計の議論のため。）

## ① 思想（決定 2026-10-09）

- 定義: raw とコードを、エージェントが読む「現在の理解」へ compile し続ける仕組み。
  経緯は ADR、証拠は raw に分ける。
- **wiki の主な読み手はエージェント**。人間はレビュー役。AGENTS.md の「人間がやること」と整合する。
  `check-wiki-size.mjs` の冒頭にも「wiki の文字数はそのまま毎回の LLM コスト」とあり、前提はすでに入っていた。
- **実装済みの挙動を書いたページは実装が正**。**未実装の仕様は `Draft` として wiki が先行する**。
  同じページが「意図」と「記述」を兼ねていた点（論点 A）の整理。
  現状の `Draft` は 3ファイル・8箇所しか使われていないので、規則にしても移行コストは小さい。

## ② Raw / Wiki / Schema（決定 2026-10-09）

現状の測定:

- wiki は42ページ・約31万字（`npm run check:wiki` の計測）。最大は data-model.md の12,268字で、
  予算（1.2万字）の超過は1ページ、圧縮基準（1.3倍＝15,600字）の超過は0ページ。10〜12千字台が10ページ並び、予算の縁にいる。
  圧縮の運用は効いている。ただし全体は読み切れない量なので、index 経由で選んで読む前提は変わらない（⑥⑦）。
  （訂正: 当初「約58万字・上位11ページが2万字超」と書いたのは `wc -m` がバイト数を返していた誤り。
  LANG が空の環境では日本語の文字数が約3倍に出る。文字数は check:wiki か `[...s].length` で測る。）
- raw は234本。idea 51、wiki-archive 19、review/checklist/todo 8、plan 6、残りは調査・監査・設計メモ。
  Compile Log の要否は接尾辞の正規表現（`check-wiki-size.mjs` の `EXEMPT`）で暗黙に分岐している。
- 公式の大会 PDF は `.gitignore` の `*.pdf` で追跡されない。原典の「外部の不変資料」に当たるものは repo の外にある。
  `docs/raw` は「資料」ではなく「過程の記録」。出典 URL が `data/` 側にあるかは未確認（Assumption）。
- Schema は分散している。Compile Log の規則は AGENTS.md / update-wiki.md / slim-wiki-page.md /
  `check-wiki-size.mjs`（`COMPILE_LOG_SINCE`）の4か所。層の定義は AGENTS.md と docs/README.md の2か所。
  規則自体に「2026-07-11 以降」「2026-09-19 以降」という日付つきの適用範囲が入っている。

決定:

1. 層は **raw / wiki / schema の3つ**。コードと `data/` は層の外の一次資料。
   優先順位は **コード・data ＞ raw ＞ wiki**。
2. **ADR は第4の層にしない**。wiki 層の page type「決定記録」にする（ディレクトリは `docs/adr` のまま）。
   page type の定義は ④ で確定する。
3. **raw は「過程と証拠の記録（追記のみ）」** と再定義する。外部資料の複製は含めない。
   種別（idea / plan / research / archive / worklist）は名前の外に出して明示する。方式は ③④ で決める。
4. **Schema の規則の正は AGENTS.md に一本化**する。手順は prompts/ と skills/、
   検証の閾値は check スクリプトが正。`docs/README.md` は人向けの入口に縮める。
   日付つきの適用範囲は、移行が済んだら「遡及しない」の一文に畳む。

## ③ AGENTS.md（決定 2026-10-09）

現状: AGENTS.md は3,737字で常時読込の負担は小さい。問題は量ではなく構成。

- 内容が3種類（wiki の運用規則 / プロジェクトの方針 / 道具の運用）混ざっている。
- 3つの操作の網羅度に差がある。Query は「関連する wiki を読む」の1行だけで、**入口の index.md に触れていない**。
  Compile は `update-wiki.md`（1,320字）が実質の手順で、`summarize-raw`（168字）・`create-adr`（130字）は出力テンプレート。
  Lint は `check:wiki` が括弧書きに埋もれ、意味面の `review-docs-drift.md`（146字）に契機も完了条件も無い。
- 用語の衝突: 「取り込み」は大会 PDF を `data/` に入れること、LLM Wiki の Ingest は raw → wiki。
  wiki 側はすでに「compile」と呼んでいるので、AGENTS.md では raw → wiki を **compile** で統一する。

決定:

1. AGENTS.md は **「読む順 → 層と優先順位 → 操作 → 不変条件 → Skills」** の構成に組み直す（目安6,000字以内）。
   操作（Query / Compile / Lint）には **契機・入口・完了条件** を書き、手順の本体は prompts/ と skills/ に置く。
   不変条件は「要件の確認」「ADR rules」「UI の表記」。
2. **AGENTS.md の入れ子分割は見送る**（棄却）。常時読込が約8,000字を超えたら `docs/AGENTS.md` へ手順を分ける。
   見送る理由: 小さいので利点が無い／書き戻しの契機はコードを書いている最中に発火するのでルートに無いと見落とす。
   ツールごとの入れ子の読み込み方は未確認（Assumption）。
3. AGENTS.md 本体の書き換えは、④〜⑧ の内容が固まってからまとめて行う。
4. `review-docs-drift.md` と `create-adr.md` の中身は ⑥⑧ で詰める。

## ④ Page type の枠組み（決定 2026-10-09）

現状: 型は暗黙（見出しから読んだ暫定分類は 索引・機能仕様・参照・手順・概念・全体像 の6役割）。
frontmatter は wiki / raw / adr のどこにも無い（0件）。適用範囲は冒頭の引用行で、`適用範囲[:：]` の存在だけを検査している。
適用範囲の印はページ側と index.md の両方にあり、41行の突き合わせで2件が食い違っていた
（tournament-insights: index=混在・ページ=汎用／open-questions: index=汎用・ページ=混在。ページ側の行を確認済み）。
index 側は「初回の印は暫定（Assumption）」と自分で書いているが、手で二重管理している事実は変わらない。
ページをまたぐ節の種類もある（Open Questions の見出し 18ページ、関連 17、発展候補アイデア一覧 9、Assumption 9）。
（訂正: Open Questions の18ページの節は、2026-09-30 の一本化（raw/2026-09-30-llm-wiki-lint.md §5-4）で
`open-questions.md` へのリンク1行（最大127字）になっている。二重管理ではない。当初「自前の節がある」と書いたのは見出しの数だけを見た誤読。）

原則: 型は「エージェントがそのページに何を問うか」で決める。型の役割は、必須の節（契約）を決めることと、ルーティングと lint が使うこと。

決定:

1. **wiki ページに最小の frontmatter を導入**する。4項目をすべて必須にする。
   `type`（値は ⑤ で確定）／`scope`（汎用・学校・固有・混在。現「適用範囲」。ページ側が正）／
   `status`（current・draft・deprecated。① の Draft ルール）／`summary`（1行。Query のルーティングが読む）。
   `code:`（実装が正の根拠となるパス）と `area:` は ⑦⑧ で必要性を見て決める。
   ページ全体の `status` と、ページ内の節ごとの Draft 表記は別物。後者は本文のまま残す。
2. `index.md` は frontmatter から**生成**する方向（二重管理の解消と summary の付与）。グループ分けに `area` が要るので確定は ⑦。
3. **ADR には frontmatter を足さない**。ディレクトリが型を決めており、Status は節として機械検査済み。
4. **raw は新規ノートだけ `kind` を frontmatter に持たせる**（research / idea / plan / worklist / archive）。
   既存234本は追記のみの原則に従い触らない。検査は `kind` があればそれ、無ければ接尾辞で判定する（遡及しない）。
5. 移行コストは wiki 42ページに4項目を付ける作業。scope は既存の値を移せる。type の分類と summary の1行は書く必要がある。

## ⑤ Entity / Concept / Feature / Procedure（決定 2026-10-09）

現状（wiki 42ページを見出しから暫定分類したもの。確定ではない）: feature 18／procedure 6／concept 6／entity 相当 3
（tournament-data-structure・data-model・database）／4分類に入らないもの 9（全体像・基盤 6、索引 3）。

- 4分類で 33/42 をカバーする。残りは overview と index の2型を足して6型にする。
- Entity は「保管場所（ファイル・テーブル）」で分かれていて、ドメインの対象では分かれていない。
  ID の言及は matchId 16ページ・tournamentId 14・playerId 13・teamId 8。`pid` の形式を定義するのは識別系の3ページだけ。
  どれが ID 形式の正なのか宣言されていない。
- 2つの型にまたがるページが6つ（ranking・players-pages・data-import・team-player-identity・deployment・st-league）。
  先例: 2026-09-23 に team-match-order-import を data-import から分けた。
- status と type は別軸（score-general-availability・sns-story-platform は feature で `status: draft`）。
- procedure ページと skill が二重化している（例: skill team-match-order 11,020字 ／ wiki team-match-order-import 8,026字）。→ ⑨

決定:

1. **型は6つ**: entity / concept / feature / procedure / overview / index。
   | 型 | 問い | 必須の節 |
   |---|---|---|
   | entity | X とは何か・どう識別するか・どこにあるか | 定義 / 識別子 / 置き場 / 形（要点） / 関連 |
   | concept | どう判定するか・なぜその規則か | 規則（結論を先頭）/ 適用先 / 例外・棄却済み |
   | feature | 何を出すか・どこにあるか | 概要 / 入口（ルート）/ 読むデータ / 適用する概念 / 未対応 |
   | procedure | どうやるか・どう確かめるか | 契機 / 手順 / 完了条件（検算）/ 落とし穴 |
   | overview | 全体の構成と境界 | 構成 / 境界 / 守ること |
   | index | どこにあるか | 一覧と1行説明のみ |
2. 運用の原則: **1ページ1型**（混在ページは一括では直さず、圧縮・追記のタイミングで分割する）／
   **事実の所有者は1つ**（ID の形式と置き場は entity ページだけが書き、他はリンクする）。
3. entity ページ: 大会・試合・会場は既存の tournament-data-structure を entity に再分類するだけ。
   **新規は Player と Team の薄いページ2つだけ**（定義・ID の形式・置き場のみ、3,000字以内）。

## ⑥ Ingest = compile（決定 2026-10-09）

現状（直近120コミット・マージ除く、パスで見た粗い測定）: コードを触るコミット73件のうち、同じコミットで wiki も更新したのが59件（81%）、
raw のノートも更新したのが55件（75%）。データだけのコミット15件のうち docs も更新したのは3件。書き戻しの習慣は定着している。
ただし更新内容が正確かどうかは測れていない。

- 編集が集中するページ（120コミット中の変更コミット数）: open-questions 36・public-pages 35・idea-backlog 33・data-model 32。
  4ページのうち2つは索引型（idea-backlog・open-questions）。public-pages は11,991字（予算ちょうど）、data-model は12,268字（超過）で、
  compile が限界にいるページに集中している。
  （訂正: 当初「索引を生成にすれば減る」と説明したが、④で生成するのは index.md だけ。idea-backlog と open-questions は対象外で、
  この2つへの編集の集中は本設計では減らない。→ 未決に残す。）
- 手順の実体は update-wiki.md の1本だけ。summarize-raw / create-adr は出力テンプレートでつながっていない。
  「どの事実をどのページに書くか」の判断はエージェントの頭の中にあり、Compile Log で事後に分かるだけ。

決定:

1. 手順は **Triage → Route → Write → Close** の1本に統合する（summarize-raw / update-wiki / create-adr を統合）。
   - Triage: 変更や raw の中身を「事実の種類」に分ける（summarize-raw の見出しはこれに置き換える）。
   - Route: 事実ごとに行き先（所有ページ）を決める。⑤の「事実の所有者は1つ」に従う。
   - Write: 該当節を**書き換える**（追記しない）。summary と status も更新し、コードで裏を取る（取れなければ Assumption）。
   - Close: Compile Log を書く／`check:wiki --strict` を通す／ADR の要否を判定する。
2. **2つのモード**を認める: インライン（実装と同じコミットで小さく。現状の81%）／バッチ（idea・research の raw が溜まったときにまとめて）。
   どちらも**実装したセッションが書き戻す**（文脈が残っているうちに）。
3. 行き先の表（Route）:
   | 事実の種類 | 行き先 |
   |---|---|
   | なぜそう決めたか・代替案 | ADR（基準は AGENTS.md の ADR rules） |
   | ID・置き場・データの形 | entity |
   | 判定規則・計算式・閾値 | concept |
   | 画面・ルート・読むデータ | feature |
   | 繰り返す手順・検算・落とし穴 | procedure |
   | 未解決の問い | 所有ページの節、または open-questions（⑧で確定） |
   | 棄却した案 | 該当ページに1行 ＋ ADR の Alternatives |
   | 実測値・経緯・検算の中身 | raw に残し、wiki にはリンクだけ |
   | この依頼限りの確認事項 | 落とす（理由を Compile Log へ） |
4. **Compile Log の書式を「行き先: 内容」の1行に揃える**。
   例: `wiki:database: team_rubber_order 列` ／ `ADR-023: 判断3つ` ／ `落とした(依頼限り): 再生リストURLが短い件`。
   現状の書き方に近いので移行は軽い。行き先のページが実在するかを ⑧ で機械検査する。

## ⑦ Query（決定 2026-10-09）

測定: 直近120コミットで、コードを触ったコミットが更新した内容ページ155件（索引3ページ index・open-questions・idea-backlog は
コードと無関係に更新されるので除く）について、変更したコードのパスがそのページ本文に出てくるか。
フルパス35%／＋ファイル名40%／＋ディレクトリ75%／パスの言及なし25%。全ページ（索引含む）ではフルパス28%。
（wiki は現在版で照合、「更新されたページ」を関連ページの近似に使っている。）
1コミットあたり、フルパス grep に当たるページは2.3件で、実際に更新されたのは0.9件（更新は平均3.3件）。
wiki 42ページのうち39ページが、コードのファイルパスを1つ以上書いている。
現状の入口 index.md はタイトルと印だけで、意図で選ぶ材料がほぼ無い。

決定:

1. Query は3つの経路を使う: **意図で選ぶ（主）**＝生成した index.md の summary／**触るコードで選ぶ（補助）**＝frontmatter の `code:`／
   **語で選ぶ（フォールバック）**＝docs/wiki の grep。
2. frontmatter に **`code:` を足す**（ディレクトリ〜モジュール粒度。本文のパス言及から機械的に初期値を作り、人が確認する。
   ファイル単位は壊れやすいので採らない）。**`area:` は足さない**。index は type 別に並べ、1行 summary を付けて生成する
   （ページが約60を超えたら再検討）。④で未決だった `code:` / `area:` はこれで決着。
3. 補助スクリプト **`wiki-for`**（引数のパスに前方一致する `code:` を持つページと summary を返す）を作る方針。実装は ⑨。
4. 読む順序: index から意図で選ぶ → `wiki-for` を引く → 選んだページを全文読む → 「なぜ」が要るときだけ ADR → 証拠が要るときだけ raw。
5. **自己修復のルール**: wiki を読んで足りなかった／違っていた箇所は、その場で直す（インライン Ingest の契機）。
   新しい調査を伴い結論が再利用できるものは、raw に research ノートを残す（⑥のバッチ compile へ）。

## ⑧ Lint / 整合性管理（決定 2026-10-09）

現状:

- 機械検査: ゲート＝リンク切れ・見出しアンカー・SQL 台帳。報告のみ＝文字数予算・適用範囲の行・孤立・ADR Status 書式・Compile Log 欠落。
  毎週月曜の cron で報告系を CI のサマリに出す。意味面の review-docs-drift.md は146字で契機も完了条件も無い。
- 過去の lint ノート（08-12 / 09-02 / 09-30）に同じ型の流れがある。手動 lint で見つけた問題が後で機械検査になっている
  （Compile Log 欠落26件 → 9/19 に報告／SQL 適用状態の追跡漏れ → 9/30 にゲート）。
  手動で見つかった「解けていたのに残っていた Open Question」はまだ機械化されていない。
- 本文中のコードパス388件のうち実在しないのは12件。文脈で確認した内訳: 意図的な記述8（削除済みと明記1・Deprecated で削除済み1・まだ作らない1・
  「〜ではなく」1・設計のみの段階2＝同じ対応表を2ページが記述・テンプレートの YYYY-MM-DD 2）／本物のずれ2（`lib/matchAnalysis.ts` と `lib/newsArticle.ts`。
  ディレクトリに分割された後も旧パスが残る）／要確認1（`scripts/normalize-player-names.mjs`。git に存在した形跡なし）／検査側の取りこぼし1（`tools/tournament`）。
  単純な存在検査をゲートにすると誤検知が約8割になる。`npm run …` の引用は55件で不在0件。

決定:

1. 検査を **3段**にする。
   - **ゲート**（誤検知ほぼ0・直し方が自明）: 現行（リンク切れ・SQL 台帳）に、(1) frontmatter の4項目と値の妥当性、
     (2) `code:` のパスが実在するか、(3) index.md が生成物と一致するか（`sync:skills --check` と同じ流儀）、
     (4) Compile Log の行き先（`wiki:<page>`・`ADR-NNN`）が実在するか、を足す。
   - **報告**（CI のサマリ・止めない）: 現行5項目に、本文中の実在しないパス（「削除済み」「Deprecated」「まだ作らない」「ではなく」を含む行は除外）、
     `npm run` 引用の不在、`code:` 配下を変えた PR で所有ページが未更新、`status: draft` なのに `code:` が全部実在（昇格漏れ候補）を足す。
   - **意味 lint**（エージェントが実行）: wiki の主張と実装の突き合わせ、解けた Open Question、Deprecated 候補、同じ事実を書く重複ページ、行き先の無い Compile Log。
   - 本文のパスはゲートにせず、frontmatter の `code:` だけをゲートにする。
2. **昇格ルール**: 意味 lint で同種の指摘が2回出たら機械検査（報告）にし、誤検知が小さいと確認できたらゲートにする。履歴が辿った流れの明文化。
3. 意味 lint の**契機は「大きめの実装の後」と「月次」**（過去の lint の間隔は3〜6週）。**出力は raw の lint ノート**（既存の書式を継続）。
   手順は `review-docs-drift.md` に書き起こし、完了条件を付ける（⑨で置き場を決める）。

## ⑨ Agent との接続（決定 2026-10-09）

現状:

- 指示は AGENTS.md ← CLAUDE.md（`@AGENTS.md`）で Claude Code と Codex が同じ1枚を読む。
  手順は skill が6つ（大会データ系5・idea-backlog。実体は `.claude/skills`、Codex は `.agents/skills` のリンク）。
  **wiki 自体の操作（compile / lint / 圧縮）だけは skill ではなく `docs/prompts/`** にある。
  AGENTS.md は「定型作業の手順は skill にまとめてある」と書いており、これだけ例外。
  直近120コミットでコードを触るコミットの81%が wiki を更新しているのに、自動発火する仕組みに乗っていない。
- 強制は `.githooks/pre-push`（高校データの鮮度のみ）と CI。エージェント固有の自動化は無い
  （共有の `.claude/settings.json` や hooks は無く、`settings.local.json` は権限設定だけで git 管理外）。
- `docs/prompts/` は消せない（AGENTS.md から1・wiki から2・raw から28・scripts と .github から各1のファイルがリンク。raw は追記のみ）。
- `check:wiki --strict` の実行は0.73秒。`sync:skills --check` が CI で skill の実体を1か所に保っている。

決定:

1. **wiki 操作の手順を3つの skill に移す**: `wiki-compile`（⑥ の Triage → Route → Write → Close。summarize-raw / update-wiki / create-adr を統合）、
   `wiki-lint`（⑧ の意味 lint。review-docs-drift を移す）、`wiki-slim`（slim-wiki-page を移す）。
   `docs/prompts/*.md` は raw からの28リンクを守るため、skill への1〜3行のリダイレクトとして残す。
   SKILL.md は特定ツールの道具名に依存させない（AGENTS.md の既存方針）。
2. **道具は npm script**（`wiki:for -- <path>`・`wiki:index`。`check:wiki` が index の鮮度と frontmatter も見る）、
   **強制は `pre-push` に `check:wiki --strict` を追加 ＋ CI**。
   **Claude Code 専用の hook は今は入れない（保留）**。Codex では効かずツール間で挙動が割れるため。
   見直す条件: `wiki:for` の導入後も、コードを触るコミットの wiki 更新率（現在81%）が上がらないとき。同じ git 測定で再計測する。
3. 並行作業（複数の worktree）の規則: 生成物（index.md）がコンフリクトしたら手で直さず再生成する。

## ⑩ AIDD 開発環境への統合（決定 2026-10-09）

現状（⑨ の補足）: 指示ファイルの入口は3つ（Claude Code＝CLAUDE.md、Codex＝AGENTS.md、Copilot＝`.github/copilot-instructions.md` の94字）で、
すべて AGENTS.md 1枚に収束している。PR は `claude/*` ブランチから出ている（直近 #189〜#193）が、PR テンプレートは無い。
Claude の memory は4件で、プロジェクトの事実や規則が混ざっている。

決定:

1. **変更1回の流れ**（AGENTS.md の「進め方」を部品に対応づける）:
   Query（index → `wiki:for` → 所有ページ）→ 仕様の下書き（新しい挙動や規則があるときだけ `status: draft`。「要件の確認」の項目は先に聞く）→
   確認（人が下書きの diff を見る。ADR の要否も決める）→ 実装（`code:` を更新）→ Compile（`draft` → `current`・Compile Log・index 再生成）→
   関所（pre-push と CI のゲート）→ PR（本文に「docs 同期」欄＝更新ページ・status の変更・ADR・落としたもの。Compile Log から写す）→
   定期（毎週月曜の報告・月次の意味 lint）。PR テンプレートに「docs 同期」欄を入れる。
2. **導入は P1〜P5 の段階導入**（各1 PR・単独で価値がある・元に戻せる）。**AGENTS.md の書き換えは P4 まで遅らせる**
   （先に書くと、まだ存在しない skill や script を使うよう全エージェントに指示してしまうため）。
   - P1: 42ページに frontmatter（`code:` の初期値は本文から機械生成して人が確認）＋ `check:wiki` の検証（ゲート1・2）。
     本文の「適用範囲」行は、混在の内訳など説明が要るページだけ残し、印の語は frontmatter を正とする。
   - P2: `wiki:index`（生成＋鮮度のゲート3）と `wiki:for`。
   - P3: skill 3つ（wiki-compile / wiki-lint / wiki-slim）、`docs/prompts` のリダイレクト化、Compile Log の書式（ゲート4）。
   - P4: AGENTS.md の書き換え、pre-push への追加、PR テンプレート、CI の報告項目。
   - P5（随時）: Player / Team の entity ページ、新規 raw の `kind`、混在ページの分割（圧縮時）、memory の棚卸し。
   `lib/matchAnalysis.ts`・`lib/newsArticle.ts` の旧パスと `normalize-player-names.mjs` の確認は、P1 の `code:` 作成の中で見つかるはず。
3. **効果の指標は3つ**: コードを触るコミットの wiki 更新率（基準 81%＝59/73。P2 以降は所有ページの更新率も測る）／
   CI の報告項目の件数（基準: 本文の実在しないパス12件のうち本物のずれ2、予算超過1）／月次の意味 lint の指摘数（初回を基準にする）。
4. **memory との役割分担**: プロジェクトの事実と規則は repo（wiki・skill・AGENTS.md）に置く。memory は個人の好みや作業スタイルだけ。
   他のエージェントからも見えるようにするため。P5 で既存4件を棚卸しする。
5. **記録の置き場**: この運用モデルの決定は **ADR-024「LLM Wiki の運用モデル」**（Draft）に要約した。P4 完了で Accepted にする。
   経緯と測定の詳細はこのノートが正。

## 実施状況

（P1〜P5 の進捗をここに書き込む。着手は指示を受けてから。）

- [x] P1 frontmatter（42ページ）＋ check:wiki の検証（2026-10-09・ブランチ `claude/llm-wiki-operating-model`）
  - 42ページに `type` / `scope` / `status` / `summary` を付け、36ページ・計149件のパスに `code:` を付けた（`code:` 無しは highschool-seo-m4-verification・idea-backlog・
    index・open-questions・score-general-availability・sns-story-platform の6ページ）。本文は旧パス5行の置き換えを除き1文字も変えていない
    （差分は挿入442行・削除5行）。type の内訳: feature 19／procedure 6／concept 6／overview 5／entity 3／index 3。status は draft が2
    （score-general-availability・sns-story-platform）。scope は本文の「適用範囲」の行から機械的に導出した。
  - `scripts/check-wiki-size.mjs` に frontmatter の検証をゲートとして追加（必須項目・値・未知のキー・summary の長さ・`code:` の実在・本文の適用範囲との一致）。
    9種類の壊し方を一時コピーで試し、すべて理由つきで検出されることを確認した。Prettier が引用符を `'…'` に書き換えても通る。
    文字数と「適用範囲」の行の検査は frontmatter を除いた本文で行う（計測値は 309,952 字のまま変わらない）。
  - ⑩ の計画からの差分: (a) 本文の「適用範囲」の行は残した（AGENTS.md が置くよう求めており、書き換えは P4 のため）。代わりに `scope` と一致することをゲートにした。
    行の整理は P4 で行う。(b) type は暫定: monetization は overview から feature に変えた。2つの型にまたがる ranking（concept）・data-import（procedure）・
    team-player-identity（concept）・players-pages（feature）などは、主な役割で1つに決めた。分割は圧縮・追記のときに行う。
  - ⑧ で見つけた本物のずれ2件を直した（`lib/matchAnalysis.ts` → `lib/matchAnalysis/`、`lib/newsArticle.ts` → `lib/newsArticle/` と `contextBlocks.ts`）。
    `scripts/normalize-player-names.mjs` は open-questions で「未実装」として挙げている意図的な記述だったので、ずれではない。
  - docs/prompts/update-wiki.md と slim-wiki-page.md に、frontmatter を付ける／残す旨を1行ずつ足した（AGENTS.md は P4 まで触らない）。
- [ ] P2 `wiki:index` ＋ `wiki:for`
- [ ] P3 skill 3つ ＋ docs/prompts のリダイレクト ＋ Compile Log の書式
- [ ] P4 AGENTS.md の書き換え ＋ pre-push ＋ PR テンプレート ＋ CI の報告項目
- [ ] P5 随時（entity 2ページ・raw の kind・混在ページの分割・memory の棚卸し）

## 未決（次以降）

- idea-backlog 索引と open-questions への編集の集中（120コミット中 33 / 36）は、本設計の生成対象（index.md）の外。
  idea-backlog の索引は各エリアページの表への手動同期なので、生成の余地があるかを別途検討する。
- **procedure ページと、大会データ系 skill の役割分担**（例: skill team-match-order 11,020字 ／ wiki team-match-order-import 8,026字）。
  ⑨ で決めたのは wiki 操作の skill 化だけで、この二重化は未解決。
- type の値は P1 で42ページを実際に分類しながら調整する（暫定分類は ⑤）。
- ADR 化の基準（docs/adr/README.md）に「docs・エージェント運用のモデル」は載っていない。ADR-024 は例外として起こした。基準に足すかは別途。
- 月次の意味 lint を誰がいつ回すか（契機は決めたが担当は未定）。`status: draft` のまま残ったページの扱い。

## Compile Log

（この節は ⑥ で決めた「行き先: 内容」の書式で書く。最初の適用例。）

- `ADR-024`: ①〜⑩ の決定の要約と、却下した案（ADR を第4の層にする・AGENTS.md の入れ子分割・`area:`・ファイル単位の `code:`・
  本文パスの存在をゲートにする・Claude Code 専用 hook）。
- `AGENTS.md`（未）: ③ の構成への書き換え → P4。
- `skill:wiki-compile / wiki-lint / wiki-slim`（未）→ P3。`frontmatter・wiki:index・wiki:for`（未）→ P1・P2。
- 落とした(測定ミスの訂正): `wc -m` がバイト数を返していた誤り（wiki の規模・AGENTS.md の字数）、Open Questions の二重管理という誤読、
  「索引の生成で編集集中が減る」という過大な説明。いずれも本文の該当箇所に訂正を残した。
- 落とした(議論の途中経過): 各ステップで私が出した暫定分類の細部（⑤ の42ページの個別割り当て）。P1 で実際に分類し直すので、ここには残さない。
