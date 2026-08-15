# Highschool Pages（高校カテゴリ）

高校カテゴリの公開ページ方針と、全国大会の歴代記録ページの現状仕様。
高校カテゴリの URL 一覧と公開面全体の構成は [public-pages.md](./public-pages.md)「ルーティング」を参照。
SEO カニバリ集中（高校歴代へ寄せる方針）は [seo.md](./seo.md) #3。
実装のページ別処理解説は `docs/highschool-pages.md`（ルート直下）にある。

## 高校カテゴリの公開ページ方針

- 高校需要期は `全国大会成績` を主軸に SEO を強化する
- `全国高等学校総合体育大会`、`高校総体`、`インターハイ` 周辺の検索意図を補足説明で受ける
- 都道府県一覧 → 都道府県ページ → 学校ページの内部導線を厚くする
- 高校トップと都道府県ページの男女切り替えは共通のセグメント型リンクを使う
- 都道府県ページの切り替えは、同じ都道府県の男子/女子ページへ移動する
- 都道府県ページでは、直近1年の主要大会結果ページに掲載された学校を優先表示する
- 高校大会の `mixed` 結果は男子・女子の両方で参照できるようにする
- FAQ / CollectionPage / Article / ItemList などの構造化データで文脈を補う
- 公開ページの説明文では、内部ファイル名・データ構造名・実装都合の表現を出さず、機能として自然に伝わる言い回しを優先する
- `/highschool` は `public/_redirects`（Cloudflare Pages）で `/highschool/boys/` へ 301 リダイレクトする（ページ側の meta refresh はフォールバック）。sitemap からは除外する
- 都道府県一覧では収録 0 校の県はリンクせず「収録準備中」として表示する
- 都道府県ページの学校一覧は直近 3 年分の成績のみ表示し、それ以前は学校ページへ誘導する
- 学校ページのサマリーはインターハイに加え、国体・ハイスクールジャパンカップ・選抜を含む主要 4 大会の掲載数・最新・最高成績を表示する
- 学校ページに年度別メンバー一覧を表示する（「◯◯高校 ソフトテニス メンバー」検索意図への対応）。収録大会結果に選手名が掲載された選手のみを年度別に集計し、全部員の名簿ではない旨を明記する。選手ページがある選手は `/players/{id}/results/` へリンクし、title / description / FAQ にも「メンバー」を含める
- 高校カテゴリ共通の定数・判定ロジック（大会優先度、ベスト8 判定、mixed 表示判定など）は `lib/highschool.ts` に集約する

## 高校 全国大会の歴代記録ページ（2026-06 追加）

対象 URL: `/highschool/tournaments`（入口）、`/highschool/tournaments/[tournament]`（大会別）。

- 都道府県別・学校別とは別軸で、代表的な全国大会そのものを起点に歴代の上位入賞を確認できる回遊ページ
- 対象大会はインターハイ（`highschool-championship`）、ハイスクールジャパンカップ（`highschool-japan-cup`）、全日本高等学校選抜（`highschool-senbatsu`、2026-07-17 追加・2020〜2025年度収録）。大会定義（スラッグ・正式名称・公式 URL・説明）は `lib/highschoolNationalTournaments.ts` の `HS_NATIONAL_TOURNAMENTS` に集約する
- `/highschool/tournaments` は 3 大会への入口一覧。`/highschool/tournaments/[tournament]` は大会別ページで、`tournament` スラッグは `championship` / `japan-cup` / `senbatsu`。選抜は団体戦のみのため種目は男女団体の2つ
- データは既存の `data/tournaments/details/{tournamentId}/{year}/{category}.json` と `information/{tournamentId}.json`（開催地・日程・種別ラベル）から年度別・種目別に抽出する。上位入賞の判定は `results[].tournament.rank.kind` が `winner` / `runnerup`、または `best` かつ `bestLevel === 4`。記録範囲はベスト4まで
- 種目は男子→女子、団体→ダブルス→シングルスの順に並べ、各種目から既存の年度別結果ページ（`/tournaments/highschool/{tournamentId}/{year}/{category}/{age}/{gender}`）へ「対戦表を見る」で内部リンクする
- 上部に種目別の歴代優勝サマリー表を表示する。各行（種目）×各列（年度）のセルに、優勝の「年度・学校・選手・都道府県」を載せる（団体は校名、個人は選手名＋所属）。データは `ChampionSummaryRow` / `ChampionCell`（`buildChampionSummary`）。優勝者不明の年は表示しない
- 上位入賞の所属校から各校の戦績ページ（`/highschool/{gender}/{prefectureId}/{teamId}`）へ内部リンクする（2026-06 追加）。リンク解決は `getSchoolResolver()`（`lib/highschoolNationalTournaments.ts`）が `data/highschool/prefectures/<prefId>/summary.json` を唯一の正として `(team, prefectureId, gender)` の実在を確認し、**一意に特定できる場合のみ**リンクする（デッドリンク防止。同名校が複数残る場合はリンクせず名前のみ表示）。`mixed` は男子・女子どちらのページにも出る規約に合わせる。リゾルバはモジュールスコープで一度だけ構築してキャッシュする
- 上位入賞・歴代優勝サマリーの選手名から各選手の試合結果ページ（`/players/{id}/results`）へ内部リンクする（2026-06 追加）。リンク解決は `getPlayerResolver()`（`lib/highschoolNationalTournaments.ts`）が `data/players/index.json` を唯一の正として、結果ページが実在する選手（`count>=5`、`results.tsx` の `getStaticPaths` と同条件）のみを姓名一致でリンクする（デッドリンク防止。結果ページが無い選手は名前のみ表示）。同姓同名は最初の ID を使う（学校ページ・`players/index.tsx` と同じ規約）。`RecordPlacement.playerLinks` / `ChampionCell.playerLinks` として保持し、ページ側は `PlayerNames` で描画する。リゾルバはモジュールスコープで一度だけ構築してキャッシュする
- 開催予定セクション（2026-06 追加）: `information/{tournamentId}.json` に登録があり、まだ結果（`details`）が無い年度を「開催予定（または集計待ち）」として新しい年順に表示する（`UpcomingEdition` / `upcoming`）。開催地・日程・実施予定種目ラベル・出典（`source` / `sourceUrl`、無ければ公式 URL）を載せ、結果確定前から大会の存在と検索意図を受ける。先頭の `upcoming[0]` は title / description / FAQ に「N年大会は…開催予定です」として動的に埋め込む
- 構造化データは `BreadcrumbList` / `ItemList`（歴代優勝者）/ `FAQPage` を出力する。canonical は各ページ自身。`dateModified` は `information` 中の最新日付（`lastModified`）由来で、ビルド日は使わない。ページ下部に「最終更新」として同じ日付を表示する
- 既存の大会ハブ（`/tournaments/[generation]/[tournamentId]`）と対象データは重なるが、こちらは高校カテゴリ内の導線として「ベスト4までの歴代上位入賞」を主軸に差別化する
- SEO: 高校全国大会は検索面をこの高校歴代ページへ集中させる方針（2026-06 決定）。重複する汎用大会ハブ（`/tournaments/highschool/highschool-championship` ほか）は `noindex, follow` にし、ハブ→高校歴代ページの誘導バナーで評価と回遊を流す。カニバリ整理の全体像と判定実装は [seo.md](./seo.md) #3 を参照
- `/highschool/[gender]` の都道府県一覧の上に入口カードを追加して回遊させる
- 静的ルートが優先されるため `/highschool/[gender]`（boys/girls）とは衝突しない
- Assumption: 2022 インターハイ男子ダブルスは元データに優勝・準優勝が複数登録されており、ページはこれを忠実に表示する（重複の整理が必要なら元データ側で対応する）
- 実装: `src/pages/highschool/tournaments/index.tsx`、`src/pages/highschool/tournaments/[tournament]/index.tsx`、`lib/highschoolNationalTournaments.ts`

## 開催中の全国大会の表示（2026-08-01 追加）

対象 URL: 大会別歴代ページ、都道府県ページ、学校ページの**既存3種**（新規 URL は作らない）。

- 会期中は「{通称}{年} 結果」の需要がピークになるが、**新規ページを作ってもインデックスが間に合わない**。そこで既にインデックス済みの3種のページを更新して受ける。設計判断と背景は [seo.md](./seo.md) #11 の 2026-08-01 追記、経緯は [raw/2026-08-01-in-progress-tournament-seo.md](../raw/2026-08-01-in-progress-tournament-seo.md)
- 「開催中」の判定は**日付ではなくデータの状態**で行う。`computeResultCoverage`（`lib/tournamentCoverage.ts`・ADR-007）の `status` が `in_progress`（一部反映済み）または `not_recorded`（組み合わせのみ）の種目を対象にする。`completed` / `abandoned` は従来どおり「年度別の記録」側で表示する
- 大会別歴代ページ: `InProgressEdition` / `InProgressCategory`（`lib/highschoolNationalTournaments.ts`）。**上位入賞（優勝〜ベスト4）が未確定でも**、出場校数・都道府県数・エントリー数・種目別の進捗・現在の勝ち上がり・年度別結果ページへの直リンクを最上部に出す。`upcoming`（開催予定）からは開催中の年を除外し、同じ年を二重に出さない
- 都道府県ページ・学校ページ: `lib/highschoolInProgress.ts` が `(都道府県, 性別)` と `(学校名, 都道府県, 性別)` の索引をモジュールスコープで一度だけ構築し、`getPrefectureInProgress` / `getSchoolInProgress` で引く。学校ページ・選手結果ページへのリンク解決は歴代ページと同じ `getSchoolResolver` / `getPlayerResolver` を再利用する（デッドリンク防止）
- 開示ルール: 結果が1件も入っていない種目は「途中経過」と名乗らず「**組み合わせ**」と表記する。現在勝ち上がり中の名前は `ALIVE_LEADERS_MAX`（=32）以下のときだけ列挙し、序盤に全エントリーを羅列しない
- `lastModified` はビルド日で頭打ちにする（`clampToBuildDate`）。開催前・開催中の大会は `information` の `endDate` が未来日で、そのまま出すと構造化データの `dateModified` と表示上の「最終更新」が未来日になり鮮度シグナルが効かないため（`next-sitemap.config.js` の同名関数と同じ理由）
- **会期後は自動で元に戻る**。優勝が確定すると対象種目が `completed` になり `inProgress` が null になるため、title・description・h1 は従来の「歴代」インテントへ戻る。巻き戻し作業は不要
- 実装: `lib/highschoolInProgress.ts`（新規）、`lib/highschoolNationalTournaments.ts`、`src/pages/highschool/tournaments/[tournament]/index.tsx`、`src/pages/highschool/[gender]/[prefectureId]/index.tsx`、`src/pages/highschool/[gender]/[prefectureId]/[teamId].tsx`

## 学校ページの「主な卒業生」セクション（2026-07-18 追加・Phase 2）

対象: `/highschool/[gender]/[prefectureId]/[teamId]`。集計は `lib/highschoolAlumni.ts`（`getSchoolAlumni`、モジュールスコープキャッシュ）。

- 定義（ページにも注記）: 「当サイト収録の高校全国大会に本校所属で出場し、卒業後も収録大会に出場した選手」。転校・中退は判定不能
- 在籍判定: 高校3大会（IH/ハイジャパ/選抜）の participants に当該校所属で出現（性別はファイル名の categoryId 由来、mixed は両性別）
- 卒業後判定: 高校最終出現年 **+1以降** に、大学・社会人・国際大会 or STリーグ（`data/st-league/*/participants.json`）へ**別チーム**で出現（中学生の同姓同名混入を防止）
- 掲載閾値: 選手結果ページ実在（count>=5）AND（全日本系大会ベスト8以上 or STリーグ出場 or 国際大会出場）。ノイズ最小化を優先した設計（2026-07-18 ユーザー決定）
- 表示: 上位5名・実績順。「代表実績1行（大会名+成績+年）・最後に確認できた所属」。選手結果ページへリンク。FAQ「◯◯出身の主な選手は？」も動的生成
- 実績の序列: 大会tier（全日本主要20/国際18/STリーグ16/その他10）+ 成績（優勝9/準優勝7/ベスト4 5/ベスト8 3）。同点は新しい年を優先
- 掲載規模: 約64学校×性別（全632中）。閾値により強豪校に自然と集中する
- 強豪校ランキングの配点には使わない（ランキングの定義は「高校の成績」のまま）
- 同姓同名は既存規約（players/index.json の最初の id・homonym は名前ベース）に従う。改姓による追跡切れは対応しない
- **都道府県版（2026-07-18 追加）**: 都道府県ページにも「{県名}の高校出身の主な選手」を表示（`getPrefectureAlumni`。県内高校の卒業生を横断して実績順の上位5名、同一選手が県内複数校に出現した場合は最良1件に統合）。出身校リンクは summary の team→teamId で解決し、解決できない校名はテキスト表示（デッドリンク防止）。FAQ「{県名}の高校出身の主な選手は？」も動的生成
- 実装: `lib/highschoolAlumni.ts`、`src/pages/highschool/[gender]/[prefectureId]/[teamId].tsx`、`src/pages/highschool/[gender]/[prefectureId]/index.tsx`

## 強豪校ランキングページ（2026-07-17 追加）

対象 URL: `/highschool/rankings/`（全国・男女別、1 URL・男女はクライアント切替）。

- 収録済みの高校全国大会（インターハイ・ハイジャパ・選抜）の成績をポイント化した独自集計。データソースは `data/highschool/prefectures/*/summary.json`、集計は `lib/highschoolRanking.ts`（`buildSchoolRankingBoards`）
- 配点: 優勝10・準優勝6・ベスト4 4・ベスト8 2・その他出場0.5 を基礎点に、団体戦×2、年度重み（最新から 1.0/0.8/0.6、それ以前 0.3）を乗算。同点は同順位（丸め後ポイントで判定）。上位100校掲載
- **Assumption**: 配点・重みは運用判断の初期値（ユーザー未確定。docs/raw/2026-07-17-idea-highschool-strong-school-ranking.md）。国体・未収録年度の選抜は対象外で、データ追加時に自動反映
- ページ上部に配点と scope 注記（非公式・収録大会のみ）を明示。FAQ でも「公式か」「計算方法」「対象大会」に回答
- 学校名→学校ページ、都道府県名→都道府県ページへ内部リンク。タブ裏対策の静的「男女別 上位校まとめ」（上位10校）を掲載（seo.md #9 と同型、カニバリ整理は seo.md #10）
- 構造化データ: BreadcrumbList / ItemList（上位10校）/ FAQPage
- 入口: `/highschool/`（カード）と `/highschool/[gender]`（誘導セクション）からリンク
- **都道府県別ポイントランキング（2026-07-18 追加）**: 県内校の合計ポイントによる47都道府県ランキングを同ページに併設（タブ連動の全県表＋静的な男女別上位10まとめ＋「強い都道府県」FAQ）。集計は `buildPrefectureRankingBoards`。都道府県名→都道府県ページ、県内1位校→学校ページへ内部リンク。「ソフトテニス 強い県」系クエリの受け皿
- 都道府県ページには県内絞り込みの「県内強豪校」上位5校を表示（`getPrefectureTopSchools`、2026-07-18 追加）
- 実装: `src/pages/highschool/rankings/index.tsx`、`lib/highschoolRanking.ts`

## 発展候補アイデア一覧（Idea Backlog）

| アイデア | 状況・目的（1行） | 詳細 |
|---|---|---|
| 開催中の全国大会を既存ページで受ける（会期中SEO） | **実装済み**（2026-08-01、インターハイ2026 会期中に着手。上記セクション参照）。会期中に唯一順位が付いていた大会ハブが「結果が確定し次第…最新情報は大会公式サイトを」と表示して訪問者を逃がしていたのが出発点。新規URLはインデックスが間に合わないため作らず、**ハブ1枚＋都道府県94枚＋学校243枚**の既存インデックス済みページを更新して「{通称}{年}」「{県名}／{学校名} インターハイ 2026」を受ける。会期後は `inProgress` が null になり自動で「歴代」インテントへ戻る。実機`npm run build`は2026-08-07確認済み・問題なし。残はGSC での効果測定（**2026-08-07見直し**: 母数が小さく統計的有意差は見込みにくいため4週間待つ設計ではないと明確化。インデックス確認は即実施、クエリ計測はGSC反映遅延を踏まえ8/10〜14頃に軽め初回チェックへ前倒し。**2026-08-15: 第1回チェック実施**——インデックス・カニバリ（seo.md #3/#7/#10）は問題なし、強豪/ランキング系クエリは維持〜向上、ヘッドクエリ「ソフトテニス 高校」のみ順位悪化。次回は2026年9月末の平常期チェックで再確認。詳細は[raw/2026-08-15-m4-gsc-review.md](../raw/2026-08-15-m4-gsc-review.md)・[検証ランブック](./highschool-seo-m4-verification.md)） | [経緯・検算](../raw/2026-08-01-in-progress-tournament-seo.md) / [seo.md #11](./seo.md) |
| 高校ソフトテニス 強豪校ランキングページ | **M2 v1 実装済み**（2026-07-17、`/highschool/rankings/`。上記セクション参照）。選抜46〜51回収録・歴代ページ・県内/都道府県ランキング・主な卒業生まで**全て実装完了**（2026-07-18）。残: **M4 GSC検証**（**2026-08-15: 第1回チェック実施**——インデックス・カニバリ（seo.md #3/#7/#10）は問題なし、「強豪」「ランキング」「県別強豪」系クエリは維持〜向上（ヘッドクエリ「ソフトテニス 高校」のみ順位悪化）。詳細は[raw/2026-08-15-m4-gsc-review.md](../raw/2026-08-15-m4-gsc-review.md)。次回は2026年9月末の平常期チェック。[検証ランブック](./highschool-seo-m4-verification.md)参照）、国体データ、県別展開/公私立フィルタ（強豪系クエリは獲得できているため着手検討可） | [アイデア・計画](../raw/2026-07-17-idea-highschool-strong-school-ranking.md) / [SERP 調査](../raw/2026-07-17-highschool-head-query-seo.md) |
| 高校総体 地方（地区）大会結果の掲載 | **9地区の個人戦ダブルス・団体戦とも実データ投入済み**（個人戦2026-07-26、団体戦も同日2026-07-26のコミットで9地区全て`team-none-boys/girls`登録済みと2026-07-30に確認・訂正。旧版の本行は「団体戦は近畿のみ」としていたが誤りだった）。`region`8→9区分化・`blocks.json`・`/tournaments/block`＋`/tournaments/block/[blockId]`・`local_index.json`の`blockId`対応・パンくず/フィルタ対応に加え、9地区（北海道〜九州）の男女ダブルス・男女団体`information`/`details`を登録済み。東海はベスト8で大会打ち切りのため`status:'abandoned'`運用を新設（`lib/tournamentAbandonment.ts`、[打ち切りUI設計](../raw/2026-07-26-abandoned-tournament-ui-design.md)）。高校カテゴリ（ランキング/卒業生集計/都道府県ページの主要大会表示）へは統合しない方針を維持し、コード上のallowlist（`RANKING_TOURNAMENTS`等）でも未混入を確認済み。残: `needsReview`フラグ付き名前分割の精度確認、ADR-007/`tournament-data-structure.md`への打ち切り語彙の追記、本番ビルドでの目視確認 | [アイデア](../raw/2026-07-22-idea-highschool-block-tournament-data.md) / [ページ構成決定](../raw/2026-07-22-highschool-block-tournament-page-structure.md) / [打ち切りUI設計](../raw/2026-07-26-abandoned-tournament-ui-design.md) |
| 地区大会結果とインターハイnewsプレビューの連携 | **一部実装済み**（2026-07-26）。「前哨戦・再戦」ブロックを`lib/priorMeetings.ts`として実装し、プレビュー記事（起こりうるカード＋カバレッジ）と年度別結果ページ（実際に組まれた再戦のみ）の両方に差し込み済み。**個人戦・団体戦の両方**に対応し、プレビュー記事／年度別結果ページ／大会ハブ／選手結果ページの4面に展開済み。IH2026実測で4種目合計492件（男子D205・女子D251・男子団体17・女子団体19）。再戦の有無は`EntryStanding`と連動した4状態（実現/起こりうる/もう起こらない/未掲載）で表示する。以下は経緯。当初の④`recentAchievers`統合案から、**「前哨戦・再戦」という新規表現**へ主軸を移した。地区大会には「両ペアがそのままIH2026に出場している既知の対戦カード」が352件あり（男子158・女子194）、IH出場ペアの62〜70%が対戦履歴を持つ。IH1回戦で既に再戦1件が実現。IH2026の`matches`は1回戦のみ登録のため、**プレビュー専用ではなくADR-007の`ongoing`運用と組み合わせて大会進行中に光る**機能になる。凍結中の`head-to-head`（優先度C）は、**2026-07-26の実測により「ダブルスのペア単位に限れば現在の名寄せ水準でも安全」と判明**（当初は「地区大会という狭スコープなら安全」と見立てたが、誤マッチ率は全データ2.92%に対し地区大会のみ2.11%とほぼ下がらず否定された。効くのはスコープの狭さではなく照合キーの結合度で、ペア単位ならIH2026で名前セットの重複0件・都道府県不一致0件）。「地区優勝＝IH優勝候補」の定量表現は**地区大会データが2026年の1年分しかなく基準率が出せない**ため過去年度投入が前提（16組の地区王者のうち同一ペアでのIH出場は12組）。SEOは「新規URLを増やさず選手結果ページの情報密度を上げる」（seo.md #2追記と同型）が本命。団体戦は個人戦と同じブロック内に校単位で併記する方針。**副産物として、地区大会投入で壊れていた選手ページのnoindex選別を修正済み**（seo.md #2追記2参照）。**2026-07-30追記**: 主軸ではなくなった旧④`recentAchievers`案も、「団体は per-player 不可のため対象外」だった設計課題を解消（`teamMatchKey`／`championKeyToEntryNo`で個人戦と同じ仕組みに統合。候補大会の取得も`index.json`のみ→`local_index.json`も連結し地区大会を拾えるよう修正）。実測でIH2026男子団体プレビューに地区大会（中国・近畿）の優勝校・入賞校が表示されることを確認済み。詳細は[news-context-blocks.md](./news-context-blocks.md)「直近大会の好成績者の再登場」 | [アイデア](../raw/2026-07-26-idea-block-tournament-news-integration.md) |
