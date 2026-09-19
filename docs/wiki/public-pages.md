# Public Pages

> **適用範囲: 混在**。サイトモード切替・構造化データ・パンくず・OGP の作り方は汎用。
> カテゴリ構成と大会名はソフトテニス固有。
> **2026-09-18 に現在の仕様だけへ圧縮した。** 実測値・不具合の経緯・実装の細部は
> [raw/2026-09-18-wiki-archive-public-pages.md](../raw/2026-09-18-wiki-archive-public-pages.md)。

`softeni-pick.com` と `score.softeni-pick.com` は別コードベースではなく、**同一リポジトリのモード切替**で運用する
（`lib/siteConfig.ts`）。切替は `SITE_MODE` / `NEXT_PUBLIC_SITE_MODE` / `NEXT_PUBLIC_PUBLIC_BASE_URL` /
`NEXT_PUBLIC_SITE_NAME` / `NEXT_PUBLIC_PUBLIC_OG_IMAGE`。canonical・OGP・サイト名は
`siteConfig.baseUrl` / `siteName` / `ogImage` を通して切り替わる（`MetaHead.tsx`）。

## ルーティング

`softeni-pick` mode: `/` / `/players/**`（[players-pages.md](./players-pages.md)）/ `/teams/**` / `/tournaments/**` /
`/highschool/**`（[highschool.md](./highschool.md)）/ `/secondaryschool/**`（[secondaryschool.md](./secondaryschool.md)）/
`/primaryschool/**`（[primaryschool.md](./primaryschool.md)）/ `/university/**`（[university.md](./university.md)）/
`/st-league/**`（[st-league.md](./st-league.md)）/ `/rankings` / `/news`・`/news/[articleId]` /
`/growth`・`/growth/[slug]` / `/beta/**`。
`score` mode: `/matches` / `/matches/[matchId]` / `/matches/growth`。

- **`/rankings` は1ページ**。年度・種目・男女をクライアント側で切り替える（薄いページを量産しない）。各表は上位100位。
  **タブ裏はクライアント描画なので、全年度・全種目の上位3位を静的 HTML で併載**する（[seo.md](./seo.md) #9）。
- **`/news` は大会展望（preview）専用**。結果記事は廃止（ADR-010。[news-context-blocks.md](./news-context-blocks.md)）。
- **`/growth` は運営キュレーションのショーケース**のみ公開・インデックス対象（ADR-004）。
  `/beta/matches-results/growth` は内部ツール面で noindex（`/beta` は robots Disallow）。
- 地域大会は `/tournaments/local/**`、地区（ブロック）大会は `/tournaments/block/**`。
  **別ルートなのは Next.js の制約**（`federationId` と `blockId` は同一階層の動的セグメントに共存できない）。
- `mixed` の高校大会結果は boys / girls の両方に出す。独立ページやタブは増やさない。

### `/teams`（チーム一覧）

- 掲載はチームマスタ `data/teams/teams.json` の `count>=2`。検索・絞り込みは全件クライアント側、
  既定は収録試合数の上位50件を静的 HTML に出力。
- **男女切替**（すべて/男子/女子）で行と収録試合数を切り替える。ミックスにしか出ていないチームは両方に出す。
- **リンクの出し分け（TeamLink 規則）**: (1) `/teams/[teamId]` があればそこへ（同名は STリーグを優先）、
  無ければ (2) 高校 (3) 中学生 (4) 小学生の**当たるものをすべて**出す（学校系は `(名前, 都道府県)` 照合）。
  行き先が1つでラベルが要らないときはチーム名自体をリンクにし、それ以外は後ろにラベル付きリンクを並べる。
  小中のページは男女共通なので男女切替に関係なく同じリンクを出す。
- パンくずは「ホーム > チーム一覧 > {チーム名}（> 年度）」。

### 大会ハブ（`/tournaments/[generation]/[tournamentId]`）

年度を含まない「大会名 結果」クエリの受け皿で、1大会の歴代まとめ。

- `getStaticPaths` は `details/{tournamentId}` 配下の年度ディレクトリ走査。`generation` は
  `index.json` / `local_index.json` の `generationId`（不明なら `unknown`）。
- **実際に詳細データがある年度・種別だけ**をチップでリンク化し、年度降順で表示する。
- 各詳細 JSON から優勝者を抽出して「歴代優勝者」表を出す。構造化データは `CollectionPage` /
  `ItemList` / `BreadcrumbList`。
- **SEO 集中**: 高校全国大会（`getHsNationalSlugByTournamentId` が解決）と `featurePath` を持つ大会
  （現状 STリーグ）のハブは `noindex, follow` にし、誘導バナーを出す（[seo.md](./seo.md) #3）。
- `information[].resultPath` は**結果がサイト内の別ページにある大会**用（例: STリーグ → `/st-league/2025/matches/`）。
  `/tournaments` は `resultPath` があれば内部リンク扱いにし、「結果あり」フィルタにも乗せる。
- **歴代優勝者表の行見出しは原則「性別のみ」**（グループ見出しが種目を示すため）。ただし
  **同じグループ内で短縮ラベルが衝突する大会はフルの種目名**を使う（全日本社会人＝一般男子/男子35歳…、
  全日本ミックス＝一般/35歳…）。同じ見出しの中で短縮とフルを混ぜない。
- 「学校部活動と地域クラブの内訳」節は `lib/clubTransition.ts` の allowlist の大会だけ（現状は全中）。
  下記参照。

### 年度別結果ページ

トーナメント表の組み立ては [tournament-bracket-logic.md](./tournament-bracket-logic.md)、
データの形は [tournament-data-structure.md](./tournament-data-structure.md)。

- **結果がある年だけの面**。開催前の年には URL を作らないので、**年度・カテゴリ切り替えの候補は
  `details/<tid>/<year>/<categoryId>.json` の実在で絞る**（`information` を一覧に使うと 404 を指す）。
- `SportsEvent` 構造化データと冒頭の説明文を持ち、title / description に「結果・トーナメント表」を含める。
- **「現在の反映状況」（`ResultCoverageNotice` / ADR-007）の分母は「決勝Tの参加数 − 1」**。
  シングルエリミネーションの試合数は不戦勝の有無に関係なくこの式で決まるので、**結果が0件でも総試合数は確定する**。
  参加数は `knockoutDraw` があれば非 null の席数、無ければ `entries` の数。
  **レコード数を分母にしてはいけない**（追記していく大会では分母が進行とともに増え、進捗率が常に高く出る）。
  **予選リーグは分母に混ぜないが、「まだ何も反映されていない」かの判定には見る**。
  決勝Tが未決着でも予選リーグが決着していれば title は「結果・組み合わせ」のまま、
  文言は「予選リーグ◯試合の結果を掲載中。決勝トーナメント(全◯試合)はこれから反映します。」。
- **「対戦詳細」は 24 組より多い大会だけ畳む**（`COLLAPSE_MIN_ENTRIES = 24`。24組以下も22.7%あり、
  小さい大会まで畳むと「開く」操作が増えるだけでスクロール量は元から問題にならない。
  [経緯](../raw/2026-09-01-idea-list-representation-and-result-page.md)）。畳む大会は上位だけを並べ、
  残りは「その他の組」の `<details>` に入れる（HTML には全件残るので選手リンクは1件も失われない）。
  検索中はその `<details>` を強制的に開く（検索語が下半分にしかないことがあるため）。
- **「対戦詳細」のカードは畳むが、上位（優勝/準優勝/ベスト4/ベスト8）の組は開いた状態で始める**
  （畳まない小さい大会でも同じ）。まず読まれるのがその数組のため。そのぶん節が伸びるので、
  **畳んでいることは説明文ではなく、状態1行＋チップ（検索窓の直下と下端の2か所）で出す**。
  1行は「全48組のうち、ベスト8以上の8組を表示しています。」の形で件数を入れる。**トリガーに
  リンク色は使わない**（遷移に見える）。上のチップから開いたら `<details>` の位置へ送る。
  セグメント切替に戻す案は却下（[経緯](../raw/2026-09-19-match-results-collapse-affordance.md)）。
- **カードの中の「以降の試合」（自分を倒した組のその後）は畳んでおく**（`<details>`。見出しの行が `summary`、
  ラベルに件数を入れて `以降の試合（2試合）`）。その組自身の勝ち上がりが本題で、以降は読みたい人だけが開く。
  **`table-fixed` の列幅は空のヘッダー行が決めている**ので、畳んだ表でもヘッダー行自体は落とさない。
- **ラウンド欄は決勝Tなら `round`、予選リーグなら「予選 グループA」**（`lib/roundLabel.ts` の
  `formatRoundLabel`）。予選リーグを複数の組で行う大会が収録 118 種目のうち 116 あり、
  「予選」だけだとどの組の試合か画面から分からない。組の表記は成績欄（`グループA 1位`）と揃える。
- **団体戦の対戦ごとの記録**（[ADR-020](../adr/ADR-020-team-match-rubber-details.md)）がある試合は、
  各カードに「第N対戦・ペア・本数」を並べる（`MatchResults.tsx` の `TeamMatchList`）。
  **向きはカードの組から見る**（左がその組、右が相手）。勝った側は太字＋`sr-only` で読み上げ。
  状態は「打ち切り」「未実施」「棄権」「不戦勝」（相手側は「相手が〜」）。
  **本数だけでは勝敗が逆に読める**ため必ず出す。不戦勝で出さなかった側は「出場なし」。
  選手名は姓名の完全一致でリンク。記録のある試合があるページだけ節の冒頭に注記。
- **ゲームごとのポイントは、その対戦行の直下に全幅で1行**（`TeamMatchGames`。実施順・左がその組）。
  **そのゲームを取った側（多いほう）を太字**にし、丸数字（`④`）は使わない（`⑩` 以上の字形と読み上げが環境で揺れる）。
  ファイナルゲームに印は付けない。**ポイントを持つのは元資料にある大会だけ**（インターハイ・アジア大会。
  高校選抜は本数まで）なので、無い対戦は行ごと出さず、冒頭の注記も**ポイントがあるページでだけ**1文足す。
  本数セルに縦積みする案・対戦ごとに開閉する案は却下（[ADR-020 追記8](../adr/ADR-020-team-match-rubber-details.md)）。

### 学校部活動と地域クラブの内訳

中体連が2023年度から全中に「地域クラブ活動の参加資格の特例」を設けた制度変更を、自前の出場団体データで裏付ける節
（集計は `lib/clubTransition.ts`、検証は `npm run club:verify`）。

- **分類は「クラブと断定できる積極的な証拠があるときだけ club」という下限カウント**。中学の大会名は略称と
  正式名称が混在し、「中学校を含まない＝クラブ」と推定すると**トレンドが表記ゆれのアーティファクトになる**。
  判定できないものは `unknown` として学校にもクラブにも数えない。
- 判定順: ①学校マーカー（`中学校` `学園` `学院` `附属` `高校` `中$` 等）②クラブマーカー（`クラブ` `少年団` `STC` 等）
  ③ラテン文字2文字以上 ④カタカナ3文字以上連続 ⑤それ以外は `unknown`。
- UI では判定不能件数を年度ごとに併記し、**「地域クラブ数は下限」と明示する**。
- **`club:verify` の単調増加チェックは制度変更後（2023年度以降）だけに要求する**（それ以前はクラブ数が固定で
  分母だけが動くため、出場団体が増えると比率が下がる）。前後で跳ねたことは別の判定「前の最大 < 後の最小」が守っている。

## 開催前の大会を出す

結果DBとして積み上げた結果、サイトは**過去形のページしか持っていなかった**。**新規 URL は増やさず**既存面を更新して受ける。

| 面 | 何を出すか | 実装 |
|---|---|---|
| 大会ハブ | 「開催前」ブロック（会期・開催地・実施種目・**会場**・公式情報）。`venues` の唯一の描画先 | `UpcomingTournamentSection.tsx` |
| 同上 | 「関連する大会」（予選会↔本大会の相互リンク） | `RelatedTournamentsBlock.tsx` |
| 大会一覧 `/tournaments/` | 「これから開催」（開催日昇順・最大3件） | `UpcomingTournaments.tsx`（共有） |
| トップ `/` | 同上（最大5件） | 同上 |
| `/tournaments/major/` | 開催前の大会と、結果が専用ページにある大会も出す | `TournamentCard.tsx` |
| 選手結果ページ | 「これから開催される国際大会」ブロック | `PlayerUpcomingInternational.tsx` / `lib/upcomingInternational.ts` |
| 大会ハブ（国際大会） | 代表名簿、または予選会の上位進出者 | `DelegationSection.tsx` / `QualifierFinishersSection.tsx` |

- **開催前ブロックは `endDate >= 今日` の information がある大会に出る。**「その年度の結果がまだ無い」を
  条件に入れない（組み合わせだけ投入した未開催の大会まで消えるため）。**「今日」は描画時に評価する**
  （`getTodayInTokyo()`。ビルド時刻に固定すると終わった大会が残る）。
- **1年分も結果が無くこれから開催される大会は、h1・title・description・本文を「歴代結果」から「日程・会場」へ切り替える**
  （条件は「結果ゼロ」かつ「未来の予定あり」の2つ。結果が入れば**自動的に歴代表示へ戻る**）。
- **実施種目のラベルは `details/` のファイルがあるときだけリンクにする**（`getStaticPaths` が
  `details/` からしか paths を作らないため、要項段階の種目をリンクにすると 404）。
- **予選会↔本大会の対応付けは `tournamentId` の命名規約**（`{本大会ID}-qualifier`）。本大会が未登録ならリンクが出ないだけで壊れない。
- 「これから開催」のリンク先は**サイト内の大会ハブ**（カードの既定導線だと外部の公式サイトへ出てしまうため）。
- **構造化データ**: 開催前ブロックが出る大会には単体の `SportsEvent` を出す（`venues` があれば住所まで）。
  **`organizer` は出さない**——既定値が Softeni Pick で、当サイトは主催者ではないため。
- **広告位置との関係**: `/tournaments/` の「これから開催」は広告枠より上なので `UPCOMING_LIMIT = 3`
  （5件だと枠がファーストビューから外れる。**増やすときは測り直す**）。トップはこの制約が無いので5件＝**意図的な差**。
- **`/tournaments/major/` は「収録大会の一覧」**（`isMajorTitle` では絞っていない）。年度は
  ①`resultPath` があれば内部リンク1本 ②会期が終わっていなければ「開催予定 …」 ③終わったのに結果が無い年度は出さない。
- **選手ページへの push**: 予選会出場者の選手ページに本大会を出す。**書ける事実は「予選会に出場した（＋成績）」と
  「本大会がいつどこで開催される」だけで、日本代表だとは書かない**（団体・混合の選考は別経路）。
  **予選会の「回」を絞る**（本大会の開始日より前の最も新しい回。`resolveQualifierEdition`）。
- **公式発表された代表名簿**（[data-model.md](./data-model.md)）がある大会に限り「日本代表に選出されている」と書ける。
  **外部発表の転記**なので出典を必ず併記し、**名簿に無いことは足さない**。**名簿がある大会では予選会の上位進出者を
  出さない**（上位4人に代表でない選手が混ざる）。名簿は予選会と独立の入口で、年が一致する回だけ採る。
- **種目別の日程**: 大会ハブは開催前ブロックに「種目別の日程（予定）」表（`SportsEvent.subEvent` にも日付）。
  選手ページは**代表名簿に載っている選手の出場種目だけ**（無い種目を並べると出場するように読める）。
  出典・確認日・「予定」・**会場の現地時刻**であることを必ず併記し、出典の無い `schedule` は表示しない。
- **種目別の競技方式**: 年度別結果ページのカテゴリ切り替えの下に「◯◯の競技方式」ブロック
  （[ADR-021](../adr/ADR-021-category-competition-format.md)）。**主催者が方式を文章で公開していない大会だけ**に出す。
  出典・確認日を必ず併記し、出典の無い `format` は表示しない。**推定は「※ …当サイトの推定です」として本文と分けて**出す。
  置き場所は広告より下（リード文と広告の間に要素を足さない。ADR-016）。
- **対応もれの検査は `npm run check:upcoming`**（information に行が無いと**静かに出なくなる**ため）。
  終了コードは常に0で prebuild には入れない。残作業は [upcoming-tournaments-runbook.md](./upcoming-tournaments-runbook.md)。

## 中止（開催されなかった回）の見せ方

`information` に `status: 'cancelled'` を持つ年は、**結果が無い年として落とさず「中止」と明示して並べる**
（落とすと年表の穴が「未収録」と区別できない）。出す面は大会一覧（バッジは**日付判定より優先**）/ 大会ハブの年度別結果 /
歴代優勝者の表（その年を列にして全セルを「中止」）/ 選手ページの主要タイトル表。リンクは張らない。

- 「中止」の一語で**理由は書かない**。日程・会場は**実績と同じ書き方をしない**（実績は「開催地: / 日程:」、
  中止は「開催予定:」）。年表の本文は**回次を出す**（回次の飛びを説明するのが目的）。
- **注意（未来判定）**: 中止の回は**過去日付だが `endDate` を持つ**。`endDate >= today` や
  `!resultYears.has(year)` で「これから開催」を判定している箇所は必ず `isCancelledEntry()` で除外する。
  除外漏れがあると `SportsEvent` の `eventStatus: EventScheduled` で構造化データに嘘が入る。
  中止の回は歴代優勝者の `ItemList` にも入れない。`/tournaments/major/` にも出さない。

## トップページ（`/`）

並びはサイドナビ（`lib/navigation.ts`）のグループ順に揃える: サイト紹介(h1) → これから開催 →
最近追加された大会 → よく見られている選手 → よく見られているチーム → 選手ランキング →
カテゴリから探す（小学生・中学生・高校生・大学生・STリーグ）。

**SEO 方針**（`src/pages/index.tsx`）: **本文を静的 HTML に含める**（日付はクライアントでロケール整形せず
`getStaticProps` で整形して渡す）/ **内部リンクはクローラ可能に**（`onClick` ではなく `next/link`。
外部リンクを内包するカードはストレッチドリンク方式）/ 見出しは `h1`(1個) → `h2` → カード `h3` /
JSON-LD は `Organization` / `WebSite` / `ItemList` で**ビルド日は出さない**。

### よく見られている選手・チーム（GA4 の手動取り込み）

GA4 の閲覧数の上位3件をカードで出す。**リアルタイムではなく手で取り込んだ時点の並び**。

- データは `data/popular-pages.json`（コミットする）。**並びだけを持ち、表示回数は書かない**（リポジトリが公開のため）。
- 取り込みは `npm run popular:import -- <CSV>`（`--dry-run` で確認）。集計期間は**直近28日**。
  手順は GA4 → レポート → エンゲージメント → ページとスクリーン → 次元を「ページパス + クエリ文字列」
  → 表示行数を最大 → CSV 出力。
- 数えるページ: 選手＝`/players/{id}/results/`、チーム＝`/teams/{id}/`・高校の学校ページ（男女別）・中学/小学生のチームページ。
- **`?q=` 付きと `#google_vignette` 付きの行は数えない**（前者は検索窓の1文字ごとの入力、後者は広告由来の重複）。
- 消えたリンク先は落とす。足りないときは選手は固定の3人で埋め、チームは出せる件数だけ出す。
- **2026-09-09 より前の期間には開発中の自分の閲覧が混ざっている**（スクリプトが警告を出す）。
- **表示回数の3割超が `?q=` 付き**なので、PV や回遊検証の分母を読むときは差し引く（[open-questions.md](./open-questions.md)）。

## 共通の作り

### パンくずの構造化データ（BreadcrumbList）

`src/components/Breadcrumb.tsx` が **`BreadcrumbList` JSON-LD の唯一の出力元**。ページ側で個別に書いてはいけない
（可視パンくずと同じ `crumbs` から生成されるのでずれない）。`crumb.href` は相対・絶対どちらでもよく、
コンポーネントが絶対 URL 化して末尾スラッシュを付ける。**配下ページを末尾に足さない**（祖先を並べるもの）。

- **共通レイアウト**: `PageLayout.tsx`（`maxWidth` prop は `3xl`〜`6xl`）。`<main>` は `_app.tsx` 側なので
  ページ側では使わない。`/beta/**` は対象外。
- **UI 文言**は [ux-writing.md](./ux-writing.md) が正。**収録＝母数、掲載＝表示**の使い分け（断り書きは必ず「収録」側。
  定数は `lib/uiText.ts` の `SCOPE_NOTE_*`）、**空状態は「状況 → 理由 → 次の行動」**、
  **「〜はこちら」をリンクにしない**（行き先を語で示す）。
- **`public/llms.txt`**（[llmstxt.org](https://llmstxt.org) 準拠）に主要 URL を案内する。掲載は公開導線のみで、
  robots で Disallow している `/api/` `/beta/` `/test-db` は含めない。**公開ページを追加したら更新する。**
- **ナビゲーション**は左サイドバー＋右コンテンツの2ペイン（ADR-006）。`score` mode は上部バーのみ
  （分岐は `isScoreSiteMode()`）。サイドバー第1階層は「セクション入口」に限定し、末端ページへの重複リンクは張らない。
  コンテキスト第2階層は本文上部のサブナビに置く。

### 試合詳細ページ

`/beta/matches-results/[matchId]` と掲載大会配下のネスト URL は同じ `PublicMatchDetailPage` を共有する。

title は `{チームA} vs {チームB}｜{大会名}{ラウンド} 試合詳細・スコア`、canonical は
`getPublicMatchDetailPath(match)` ＋末尾スラッシュ。JSON-LD は `SportsEvent`（`startDate` は `match_date` 優先で
**ビルド日は使わない**。掲載大会があれば `superEvent`）。パンくずは ホーム → 試合一覧 →（大会）→ 試合。

`SportsEvent` 構造化データの項目規約（`lib/sportsEventJsonLd.ts`）は [seo.md](./seo.md)「構造化データの決めごと」。

### 年度別結果ページの OGP 画像

ベスト16のトーナメント表を 1200×630 の `summary_large_image` で出す。索引は `data/tournaments/og-images.json`、
ページ側は `lib/tournamentOgImage.ts` が読む。生成の仕様と運用（`--changed` / `--only` の落とし穴、
全件再生成が churn になる理由）は [sns-day1-images.md](./sns-day1-images.md)「年度別結果ページの OGP 画像」。

## 発展候補アイデア一覧（Idea Backlog）

表の「状況・目的」は**状況と1行の目的・残りだけ**（規則は [idea-backlog.md](./idea-backlog.md)）。

| アイデア | 状況・目的（1行） | 詳細 |
|---|---|---|
| トップの「よく見られている選手・チーム」 | **実装済み・手動取り込み**（2026-09-14）。週1の自動化は手動運用を試してから判断 | [アイデア](../raw/2026-09-14-idea-top-popular-pages-ga4.md) |
| `/teams` から小中のチームページへリンク | **実装済み**（2026-09-14）。複数カテゴリに当たる行はラベル付きリンクを並べる | [アイデア](../raw/2026-09-13-idea-teams-index-junior-links.md) |
| 日体大ページと大学カテゴリの関係 | **実装済み**（2026-09-14）。`/teams/nssu/` を残し、大学37校を同じ型で追加 | [アイデア](../raw/2026-09-13-idea-nssu-team-page-and-university.md) |
| ライブ配信一覧 `/live/` | **発散フェーズ**（2026-09-06）。まず配信の供給量を掲載せずに実測する | [アイデア](../raw/2026-09-06-idea-live-streams.md) |
| ユーザーの課題を体系的に見つける | **発散フェーズ**（2026-09-06）。GA4 の検索語を保持期限内に読む。X 調査済み（団体戦のオーダー・当日の進行表） | [アイデア](../raw/2026-09-06-idea-user-problem-discovery.md) / [X調査](../raw/2026-09-17-x-posts-user-problem-findings.md) |
| 大学カテゴリの公開ページ | **実装済み**（2026-09-13）。仕様は [university.md](./university.md) | [アイデア](../raw/2026-08-12-idea-university-category-pages.md) |
| 成年カテゴリの都道府県ページ | **発散フェーズ**（2026-08-11）。高校型の横展開はデータ不足で非推奨 | [アイデア](../raw/2026-08-11-idea-general-category-prefecture-pages.md) |
| トーナメント表の作り直し | **実装済み**（2026-07-31）。照合は `bracket:verify`（CIゲート）。残タスクなし | [アイデア](../raw/2026-07-26-idea-bracket-redesign.md) |
| 一覧表現の方針（カード／リスト／表） | **大会結果ページのみ実装**（2026-09-01）。サイト全体の方針は未確定 | [アイデア](../raw/2026-09-01-idea-list-representation-and-result-page.md) |

## Open Questions

- 本番で2ドメインをどうデプロイ・管理しているか。
- `score` 側のヘッダー/フッターの差し替え方針、専用ブランド/ナビ設計をどこまで分けるか（Draft）。
- OGP 文言・サイト名の正式運用ルール。
- 高校カテゴリの注目校表示ロジックを将来的に手動編集可能にするか。

**Deprecated**: Host 判定や referer 判定でモードを切り替える方針（現行は `siteConfig.mode` が基準）。
