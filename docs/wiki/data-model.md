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

識別・名寄せ用データ:

- チームマスタ（連番id）: `data/teams/teams.json` ＋ 文脈 `data/teams/team-context.json`
- チーム名の正準対応表: `data/tournaments/team-name-aliases.json`
- 同姓同名の別人分割: `data/players/homonyms.json`
- 詳しくは [チーム・選手の名寄せと識別](./team-player-identity.md)

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

### 段階で分割された大会の最終成績（2026-08-26 追加）

1つの大会を、進行段階ごとに複数の `categoryId` へ分けて取り込むことがある。
実例は2025年のアジア競技大会日本代表予選会で、
`singles-tournament-*`（決勝トーナメント）→ `singles-semifinal-*`（準決勝リーグ）→
`singles-final-*`（決勝リーグ）の3カテゴリに分かれている。

**規約: 最終成績（`results[].tournament.rank`）は、決着したカテゴリだけが持つ。**
先の段階へ進んだ選手は、手前のカテゴリでは `tournament: null` にする。

そうしないと、同じ選手・同じ大会が「ベスト8」と「優勝」の2エントリーとして集計され、
進出率やタイトル数が二重計上される。`results[].roundrobin.{group,rank}`（組内順位）は
別フィールドで、ブラケット復元（`lib/bracketLayout.ts`）が使うので**消さない**。

段階を表す `age` 語彙: `final` / `semifinal` / `tournament` / `qualifying` / `upper` / `lower` /
`top` / `second`。年齢区分（`over50` 等）や学年区分とは別物で、
**年齢区分の重複出場（全日本シニアの over50 と over60 など）は正常**。

検査は `npm run check:placements`（`scripts/check-duplicate-placements.mjs`）。

**注意**: この規約だけでは進出率の二重計上は解けない。`lib/playerStats/facts.ts` の
`isKnockoutSinglesDoublesMixed` が `appearsInKnockout`（knockout の試合に出たか）でも true になるため、
順位を外したエントリーも分母に残る。**2026-08-26 に `reachRates` 側で
`placement.kind === 'unknown'` を分母から外し**（`ENGINE_VERSION` 1.6.0→1.7.0）、
この規約と組で「分母を増やさずに最終成績を記録する」が成立するようになった。

### 大会の会場データ（`venues`）

`information/*.json` の各年レコードは、開催地を2系統で持つ。

- `location`（string）… 都道府県。**既存フィールド。書き換えない**
- `venues`（配列）… 会場の構造化データ。2026-07 に追加

`location` を温存するのは、`src/pages/tournaments/index.tsx` の `prefNameToId[info.location]` が
開催地フィルタの逆引きに使っているため。`"兵庫県、京都府"` のように壊れた値も存在するが
（複数県開催を1文字列に詰めたもの）、整理は読み取り側を `venues` へ切り替えるときにまとめて行う。

**「書き換えない」は構造の話であって、事実誤りは直す。** 温存するのは
「複数県を1文字列に詰める」「`venues` があっても `location` を消さない」といった**形**であり、
都道府県そのものが間違っていれば修正対象。`location` は**前年レコードからの複製で壊れる**
失敗モードが実在する（2026-08-28: 全中2026が前年の `熊本県` のまま。正しくは `島根県`。
検算方法は[会場データの取得元](#会場データの取得元)、経緯は
[raw/2026-08-28-zenchu-2026-location-fix.md](../raw/2026-08-28-zenchu-2026-location-fix.md)）。
`location` は年別結果ページの description（「開催地は◯◯。」）に出る**公開値**なので、
誤りはそのまま利用者に見える。

`venues` を**配列にする理由**は、大会と会場が 1:N だから。次の3パターンが実在する。

- 日別に会場が変わる（例: 全日本選手権は開会式・競技1〜2日目・3日目で施設が異なる）
- 種目・年齢区分別に会場が分かれる（例: 全日本シニアは年齢区分ごとに3〜4施設）
- 複数市区町村・複数都道府県にまたがる（例: 兵庫県神戸市／京都府福知山市・舞鶴市）

#### フィールド定義

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `prefecture` | string | ○ | 都道府県。複数県開催ではここが正（`location` ではなく） |
| `city` | string \| null | ○ | 市区町村 |
| `name` | string \| null | ○ | 施設名。要項PDF未取得なら `null` |
| `aliases` | string[] | | 別名。**ネーミングライツによる改称・旧称**を入れる |
| `nameRaw` | string | | 出典の表記そのまま。`name` と異なるときだけ書く |
| `postalCode` / `address` / `tel` | string | | `address` は都道府県から書く |
| `courts` | number | | 面数 |
| `surface` | string | | 下記の正規化語彙 |
| `usage` | string | | どの日・どの種目に使われたか。**自由文** |
| `note` | string | | 出典の誤りを直した場合の根拠、値を書かなかった理由 |

`venues` と同じくレコード直下に置ける任意フィールド:

| フィールド | 型 | 説明 |
|---|---|---|
| `guidelineUrl` | string \| null | 大会要項PDFのURL |
| `note` | string | 入力時のメモ（出典の誤り、値を書かなかった理由、日程のずれ等）。**公開ページには出さない** |

型定義は `src/types/tournament.ts` の `TournamentInformationEntry` / `TournamentVenue`。

#### 記載ルール

- **`surface` は正規化語彙**。要項の表記は「クレー**コート**」「砂入り人工芝」のように
  末尾の「コート」の有無が揺れる。施設名は識別子なので原文を保つが、`surface` は将来の
  絞り込みに使う閉じた語彙なので入力時に揃える。
  現行値: `クレー` / `ハード` / `砂入り人工芝` / `木床フローリング`
  （確認は `grep -rho '"surface": "[^"]*"' data/tournaments/information/ | sort -u`）
- **`indoor` は持たない**。要項に屋内/屋外の明記がないことが多く、施設名からの推測になるため。
- **`usage` は構造化しない**。`categories[].categoryId` と紐付けたくなるが、年度によっては
  `categories` が空で参照先がない（例: `zennihon-senior` の2026年度）。用途が固まるまで原文を保つ。
- **推測で埋めない**。値が壊れていれば書かず、`note` に理由を残す
  （例: TEL「0773-63-764」は9桁で桁落ちのため `tel` を省略）。

#### 出典（要項PDF）の誤りへの対処

**要項PDF自体に誤記がある。** 実例（`zennihon-senior` 2025年度）:
「三段池科研電機（**福山市**三段池公園）テニスコート 〒620-0017 **京都府福知山市**字猪崎377-1」。
括弧書きは誤りで正しくは福知山市。**福山市は広島県に実在し STリーグ プレーオフの開催地**でもあるため、
鵜呑みにすると正しそうな見た目のまま別県に紐づく。

対処は `name`（修正値）＋ `nameRaw`（原文）＋ `note`（根拠）の3点セットで、**原文を必ず残す**。
検出は **`address` 先頭の都道府県と `prefecture` の一致**で行う（上記の誤記はこの1点で検出した）。

#### 描画先（2026-08-25 追加）

`venues` は長らく**どこにも描画されていなかった**（`grep -rn "venues" src` が0件）。
2026-08-25 に大会ハブの「開催前」ブロックが唯一の描画先になった
（`src/components/tournaments/UpcomingTournamentSection.tsx`、仕様は
[public-pages.md](./public-pages.md)「開催前の大会を出す」）。
**結果が確定した過去の大会では今も描画されない**——過去の会場情報の需要が未検証のため、
まず開催前だけに絞っている。未来大会9件のうち `venues` が入っているのは2件だけで、
補充は[実行ランブック](./upcoming-tournaments-runbook.md) の S7（検出は `npm run check:upcoming`）。

#### 施設マスタ（`data/venues/venues.json`）はまだ作らない

施設属性は当面 `venues[]` にインラインで持つ。**同一施設が3回以上出現した時点でマスタへ切り出す**。
出現見込みは `千葉県白子町` 5回 / `大阪府大阪市` 4回 / `広島県広島市` 4回 / `東京都江東区` 3回 /
`北海道札幌市` 3回（`data/local-sources/venue-candidates.json` 集計）。

インライン → マスタの正規化は後から可能だが、逆はID体系を情報不足のまま決めることになるため避ける。
`aliases` にネーミングライツの旧称を貯めておくことが、切り出し時の名寄せコストを下げる。

#### 会場データの取得元

- `data/local-sources/jsta-yearly-events/{年度}.json`
  日本連盟の「大会日程及び開催地一覧」PDF（`t_records/{年度}/{年度}_taikai_alle.pdf`）を構造化したもの。
  2024・2025・2026年度が存在。**手動転記**（自動パーサ未実装）。市区町村レベルまで。
- 施設名・住所・面数・サーフェスは各大会の**要項PDF**（`{年度}_{分類コード}_10.pdf`）の「4. 会場」節。
- `data/local-sources/venue-candidates.json`
  上記と `information` を突き合わせたレビュー用候補ストア。`detected-documents.json` と同型で、
  人が `status` を確定してから `information` へ書き戻す。**日付だけの照合は同日開催の別大会と
  誤マッチするため、大会名の類似度を併用する**（誤マッチは confidence 0.5前後に落ちて分離できる）。

**この照合は `venues` の候補出しだけでなく、既存 `location` の検算にも使える。**
`startDate` 一致＋大会名の正規化類似度で `information` と jsta を突き合わせ、都道府県を比較する。
2026-08-28 に 2024〜2026年度の全 `information` へ通し、真の誤りを1件検出した（全中2026）。
ヒットした他2件は誤マッチ（類似度0.63）と既知の `"兵庫県、京都府"` で、真マッチの類似度は0.83。
落とし穴が2つある。

- **都道府県の切り出しを `..[県]` 系の正規表現で書かない**。和歌山県・神奈川県・鹿児島県
  （3文字＋県）が誤検出になる。47都道府県のリストで前方一致すること。
- **「連続する年で `location` が同じ」だけでは誤りを判定できない**。全21件中の大半は
  全日本インドア＝大阪府、天皇賜杯・皇后賜杯＝東京都のような**固定会場の正常データ**。
- jsta ソースは2024年度以降しか存在しないため、**2023年以前は機械照合できない**。
- 作業手順と貼り付け用の断片: [venue-input-worksheet.md](../venue-input-worksheet.md)（作業用・入力完了後は破棄可）
- 経緯: [raw/2026-07-26-idea-tournament-metadata-platform.md](../raw/2026-07-26-idea-tournament-metadata-platform.md)

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

団体戦の表示ルール:

- 団体戦の `participants[]` は姓名を持たず（JSON 上は `lastName`/`firstName` が `null`）、`team` と `prefecture` だけを持つ。
- 表示は個人戦の「選手名（所属）」ではなく **「チーム名（都道府県）」**（例: `東北（宮城県）`）。`prefecture` が無い大会（コリアカップ、大学王座など）はチーム名のみ。
- 団体戦かどうかの判定は `src/utils/playerName.ts` の `isTeamFormatPlayers()` に集約する。**`lastName === null` で判定してはいけない**: `lib/packedPageData.ts` の `unpackTournamentDetailData()` が `readString()` を通して `null` を `''` に変換するため、ページ側に届く時点で `null` ではなくなっている。これを踏むと個人戦扱いになり、空の選手名＋括弧つきチーム名（`（東北）`）で表示される（2026-08 修正）。
- 適用箇所は対戦詳細（`MatchResults` のエントリー見出しと対戦相手名）とトーナメント表（`TournamentBracket`）。`BracketSheets` と大会トップの優勝者表示は元々「姓名が空なら団体戦」と偽値で判定している。

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

## 発展候補アイデア一覧（Idea Backlog）

| アイデア | 状況・目的（1行） | 詳細 |
|---|---|---|
| 大会メタデータ基盤（会場・施設・日程・大会要項） | 発散フェーズ（2026-07-26）。試合中心のデータ構造に会場・施設・日程・要項を独立エンティティとして足し「大会を管理するサイト」へ広げる案。調査の結果、`information/*.json` は既に `location`/`startDate`/`endDate` を全112件保持し、`/tournaments/` も開催地カラム・フィルタ済みで出発点は0ではないと判明。一方 `location` は38種・中央値2件、2024年以前は24件しかなく、会場ページ生成は `seo.md` が潰したばかりの薄いページ問題を再生産する。暫定結論は「SEOは会場名をliteralで出せば足り、エンティティ化は履歴が貯まるまで待つ。いま着手するのは機能でなくデータ収集」。**jsta.or.jp 実地調査済**: `t_records/{年度}/{年度}_taikai_alle.pdf`（2024・2025年度のみ存在）が全国大会の日程・開催地の一次ソース、要項PDF `{年度}_{分類}_10.pdf` に施設名・住所・コート数・サーフェス・駐車場・日程内訳が定型記載。初回評価の「施設スペックは取得コスト高」は誤りと判明。大会:会場は1:N（日別に変わる）。事前閾値「全国80件中56件」に対しカバー可能は56件でちょうど到達。**2026-08-25: 観戦者視点から再検討し、次の一歩が確定**——`grep venues src` は0件で、収集した会場データ（128レコード中33件が `venues`・22件が `guidelineUrl`）は**サイト上のどこにも描画されていない**。原因は実装遅れでなく構造で、venueが載るべき「開催前の大会ページ」が存在しない＝欠けているのは会場データでなく**時間軸（未来形）の面**。未来日付の大会は既に8件あり「開催予定」バッジも実装済みだが、年度降順グループに埋もれている。**実測でアジア競技大会日本代表予選会2025の出場者103人は全員が5大会以上の履歴を持つ**（サイト全体では4.6%）**うえ、サイト全体で10大会以上の選手113人の66.4%（75人）がこの103人に含まれる**＝サイト内で最も厚いクラスタであり、`seo.md` の薄いページ問題の真逆。一方 `index.json` は**国際大会の国内予選3件を持つが国際大会そのものを1件も持たず**、`isMajorTitle` も国内4大会のみ。推奨は ①アジア競技大会（本大会）を `information`/`index.json` に登録し予選会→本大会→既存選手ページの導線を通す ②`/tournaments/` に「これから開催」ブロック（新規URLゼロ）③年間カレンダーの判断はその観測後。制約として**代表名簿はシングルス予選しか無く自社データから導出できない**。**同日、①②とも実装済み**——`asian-games` を `index.json`/`information` に登録（会期2026-09-18〜23・名古屋市東山公園テニスセンター・5種目、`courts`/`surface` は一次情報が無く未記録）、大会ハブに「開催前」ブロック（**`venues` の初の描画先**）と「関連する大会」ブロック、`/tournaments/` に「これから開催」（昇順・最大5件）を追加。**新規URLは0**。`isMajorTitle` は Elo K値・ランキングtier・主要タイトル数に効くため**触らない**と判断（国際大会を主要扱いしたい場合は別フラグ）。関連リンクは開催前ブロックから独立させないと**「予選会→本大会」の向きが繋がらない**と実装中に判明。残は `npm run build` 完走・広告と「これから開催」の上下関係の実測判断・`replayData.mjs` が国際大会を `local` tier 扱いする件 | [アイデア](../raw/2026-07-26-idea-tournament-metadata-platform.md) |
| Knowledge Graphによるデータ設計・UX統合 | 発散フェーズ（2026-07-11）。選手/チーム/大会/試合の関係解決ロジックが機能ごとに重複実装されている実態を確認（`matchReverseIndex.ts`と`playerStats/reverseIndex.ts`等）。新機能=グラフ上の新ビュー追加、に寄せられないかを検討中。次の一歩は候補ビュー（対戦相手ネットワーク等）の小さな試作 | [アイデア](../raw/2026-07-11-idea-knowledge-graph-views.md) |
| 全中（全国中学校ソフトテニス大会）ブロック大会の掲載 | 収束方向（2026-08-08）。高校地区大会と同型。既存の`blocks.json`/`local_index.json`の`blockId`/`/tournaments/block`はgeneration非依存でコード変更不要と確認済み。ブロック区分は東北のみ相違（中学は北海道込み7県で1ブロック、高校は北海道が独立）のため`blocks.json`に中学用ブロック追加が必要。中学専用カテゴリページは作らず「通常の大会として登録」する方針で合意。次の一歩は実データ取得。**2026-08-11に東海ブロックで通し確認を実施し、その後9ブロック全ての2026年度データを投入済み**（結果行1,064・校/団体534）。**なお「中学専用カテゴリは作らない」の部分は2026-08-12に上書きされた**（下行「中学カテゴリの公開ページ」参照） | [アイデア](../raw/2026-08-08-idea-zenchu-block-tournament-data.md) |
| 中学カテゴリの公開ページ（/highschool 型の横展開） | **方針決定済み・実装前**（2026-08-12）。ユーザーが実データを見たうえで「高校型フル横展開」を選択。2026-08-08の「中学専用カテゴリは作らない」決定を上書きする（9ブロック分の実データ投入で土台が変わったため）。実測: 中学は結果行2,758・校/団体1,049で、**ページ候補は高校の1.9倍・データ量は0.45倍**（出場延べの中央値2 vs 高校6、5未満が72.3% vs 47.2%）。ユーザーの懸念3点の検証結果は、①都道府県のまとまり=**懸念は当たらない**（県判明率100%・複数県にまたがる率0.6%で高校と同水準）、②クラブ混在=**実在し今後増える**（「中学校」名の率は全中49.9%・ブロック17.4%・クラブ選手権プレ0.0%。2025年度から地域クラブの全中参加が解禁）、③大会結果不足=半分当たりだが**真のボトルネックは表記ゆれ**（同一県内で複数表記を持つキーが**9.9%＝高校0.5%の約20倍**。全中は略称・ブロックPDFは正式名称という出典差が原因）。したがって採用の前提条件は**(a) 中学校名の名寄せ層を先に作る**（95件、手作業可能な規模）**(b) 掲載閾値5以上**（名寄せ後283校/約435ページ・47県すべて非空で高校553校と同オーダー。無制限だと959校/約1,156ページで7割が薄い）**(c)「学校」でなく「チーム」として設計**（クラブ増加に備える）**(d) 高校の集計へ混入させない**。外部環境は全中が2027年度から30%規模縮小（ソフトテニスは存続）のため厚みは過去年度の遡及投入で稼ぐしかない。**2026-08-12: 着手前の調査2件は完了**——(1)名寄せは既存パイプライン＋[ADR-013](../adr/ADR-013-scoped-team-name-aliases.md)（alias の大会スコープ）で解消、(2)ページ規模は**閾値5・ブロック大会込みで280チーム/328ページ**と確定（高校289団体・409ページと同等。`node scripts/measure-juniorhigh-scale.mjs` で再現可）。**ブロック大会は掲載判定には使うが集計には使わない**（全中＋都道府県対抗のみだと158団体まで落ち京都・宮崎・山梨・沖縄が1団体になる一方、ブロックは県別出場数が北海道65対福岡4とブロック構成の差が出るため配点に使えない。高校の「地区大会を統合しない」原理は維持している）。また**閾値5の283団体は学校117/クラブ116/判定不能50でクラブが約4割**あり、「学校ページ」ではなく「チームページ」として設計する必要が実測で確定した。**同日追記: 「高校とは違う中身」を4候補まで実データで検証**。起点は**ダブルスペアの所属一致率**で、高校IH 0.00%・全中 0.00%に対し**ブロック18.65%・県対抗38.89%**——高校が「学校を主役」にできたのは混成ペア0%だからであり、中学でそれが成立するのは全中だけと判明（＝高校の設計思想を持ち込む必然性が無い）。①**進路の接続（中学→高校）が最有力**: 両方に出る選手547人（中学の18.5%、県一致301件、同姓同名の証拠は0件/2,956人）、うち**中学のペアがそのまま高校でも同じペアが48組**（系列校内部進学と外部進学が混在）。両カテゴリを名寄せ済みで持つサイトにしか作れず、既存の高校学校ページにも「どの中学から来ているか」の逆引きとして還流する ②**県対抗を県ページの主役に**: 2年とも47都道府県が完全に揃い各県6ペア＋2名で固定という、サイト内で最も規則正しいデータ。出場数バイアスなしに県の強さを比較できる（高校では原理的に作れない） ③**地域移行トラッカー → 2026-08-12 実装済み**: 全中の大会ハブに「学校部活動と地域クラブの内訳」節を追加（新規URLなし＝ADR-010と整合）。確定値は2022年度1団体(1.0%)→2023年度10(9.6%)→2024年度21(21.2%)→**2025年度39(36.8%)**で、日本中体連が「地域クラブ活動の参加資格の特例」を設けた**2023年度と跳ね上がりが一致**。分類は表記ゆれで数字が壊れるのを避けるため「クラブと断定できる積極的な証拠がある場合のみ」の**下限カウント方式**（`lib/clubTransition.ts`、検証は`npm run club:verify`）。仕様は[public-pages.md](./public-pages.md)「学校部活動と地域クラブの内訳」。残は`npm run build`完走とGSC効果測定 ④**選手中心の設計は棄却**（中学単独で出場5回以上は4人/2,956人＝0.1%。ただし「既存の選手ページに中学時代を足す材料」としては有効で①に吸収）。副産物として`四天王寺高校`が中学データに混入しているのを発見（名寄せ時に要確認） | [アイデア・実測](../raw/2026-08-12-idea-juniorhigh-category-pages.md) |
