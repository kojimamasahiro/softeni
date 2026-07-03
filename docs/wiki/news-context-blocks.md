# 文脈ブロック / 速報・プレビュー機能

## 概要

時事系（速報・プレビュー）流入を、運用負荷を上げずに獲得するための機能群。本機能の本質的価値は「記事生成」ではなく **「文脈ブロック生成」** にある。競合のテンプレ SEO サイトでも結果記事は生成できるが、Softeni Pick の大会・選手・試合データを横断して生成する文脈情報は再現が難しい。よって**文脈ブロックを一次成果物**とし、記事はその再利用先の一つとして扱う。

状態: **一部実装済み（2026-06-21）**。優先度A 3ブロックの生成ロジック、大会ハブ・選手ページへの差し込み、`/news` 記事まで実装（Step1-7）。head-to-head（Step8）と承認 UI は未実装。詳細設計は raw を参照: [親仕様](../raw/2026-06-21-news-auto-draft-design.md)、[Step1](../raw/2026-06-21-historical-winners-logic.md)、[Step2](../raw/2026-06-21-milestone-logic.md)、[Step3](../raw/2026-06-21-career-record-logic.md)。

> **更新（2026-06-27, ADR-010）**: `/news` の **結果記事（result）は廃止**した。「大会ごとの結果・優勝・歴代まとめ」は、年度ごとに増える result 記事ではなく、**大会ごと 1 枚で全年度を蓄積する大会ハブ `/tournaments/[generation]/[tournamentId]`**（高校全国大会は `/highschool/tournaments/[tournament]`）に一本化する。`/news` は大会前の **preview（展望: 前回王者・出場校 ほか）専用**。result はハブと同一実体の二重ページ（[seo.md](./seo.md) #8）になっていたため。実装: `lib/newsArticle.ts` の `listPublishedPreviews()`、`src/pages/news/*`（preview 限定）、`scripts/generate-news-drafts.mjs`（preview 専用）、`public/_redirects`（旧 result URL の 301）。以下の result に関する記述は **Deprecated**（preview と既存ページ差し込みは有効）。

実装状況（実装が source of truth）:

- 実装済み:
  - `lib/tournamentRecords.ts`（historical-winners・連覇判定。`readYearDetail` / `buildParticipantMap` / `resolveEntryToChampion` を export し、優勝者以外の試合＝敗退試合の参照を可能にしている）
  - `lib/milestones.ts`（repeat-title / first-title / champion-defeat。career-wins / best4-first / first-appearance は名寄せ整備まで保留）
    - `repeat-title` / `first-title` の判定単位（2026-06-24〜）: **個人戦（シングルス/ダブルス）は「選手個人」単位**で判定する。ダブルスはペア単位ではなく各選手をそれぞれ主役にし、パートナーが替わっても本人が連続開催で優勝していれば連覇、本人が掲載範囲で優勝歴ゼロなら初優勝として **1 選手 1 イベント**を出す（例: 同一年に「鈴木 連覇」と「（ペア替わりの）佐藤 初優勝」が並ぶ）。比較は `ChampionEntry.playerKeys`（`lib/tournamentRecords.ts` の `playerKey()`＝正規化済み「名前@所属」、`players` と index 対応）で行う。**団体戦は従来どおり校（`championKey`）単位**。差し込み側の重複排除キーには主役（`subject.display`）を含める（同一年・種目で複数選手のイベントが出るため）。選手ページは主役名で当該選手のイベントのみ採用する。
    - 種目の区別（2026-06-24〜）: 同一選手が**シングルスとダブルスで別々に連覇**することがあるため、`label` / `shortLabel` に「性別＋種目」（例:「男子ダブルス」「女子シングルス」「男子団体戦」）を前置して全ページ一貫で区別する。この表記は `categoryId`（`${category}-${age}-${gender}`）から決定的に組み立てる（`genreGenderLabel()`。性別 boys/girls/mixed→男子/女子/混合、種目は `lib/utils.ts` の `getCategoryLabel()`）。`information` の `categoryLabel` は「男子一般」のように種目が落ちる表記揺れがあるため採用しない。例:「鈴木 男子ダブルス3連覇（2023年〜）」。
    - `champion-defeat`（王者撃破）: 前回王者（対象年より前で直近に優勝者が判明している開催の優勝ペア/校）が対象年に**出場し試合で敗退した**場合のみ、撃破した側を subject にしたイベントを返す。当年 `matches` から `championKey`（所属＋名前）一致で前回王者エントリを特定し、敗戦試合の勝者を解決する。不出場・無敗（連覇）は出さない。`getChampionDefeat()` として優勝者視点の `getChampionMilestones()` とは分離（主役が優勝者ではないため）。confidence は `confirmed`（試合の勝敗は確定）だが「前回王者」認定は掲載範囲依存のため scopeNote を添える。
  - `lib/careerRecord.ts`（analysis.json＋優勝歴。CareerTitle に categoryId を保持）
  - 大会ハブ差し込み: `src/components/TournamentContextBlocks.tsx` ＋ `src/pages/tournaments/[generation]/[tournamentId]/index.tsx`（最新年度の milestone と curated 優勝者の通算成績）
  - 結果ページ差し込み（年度×種目）: `src/components/ResultContextBlocks.tsx` ＋ `src/pages/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]/index.tsx`（その年・種目の repeat-title / first-title / champion-defeat を「注目ポイント」バッジで表示。historical-winners を共有して二重走査を回避）
  - 選手ページ差し込み: `src/components/PlayerCareerHighlights.tsx` ＋ `src/pages/players/[id]/index.tsx`（通算成績・優勝歴・優勝歴由来の連覇/初優勝 milestone。curated 選手のみ）
  - `/news` 記事（プレビュー/結果）: `lib/newsArticle.ts`（記事レコード＋ビュー組み立て）、`src/pages/news/[articleId].tsx`、`src/pages/news/index.tsx`、生成 `scripts/generate-news-drafts.mjs`。記事レコードは `data/news/<articleId>.json`（state: draft→review→published、公開は published のみ）。結果は優勝者＋milestone＋歴代。プレビュー→結果は同一 articleId で type を昇格。
    - プレビューの構成（2026-06-25〜）: **curated 注目選手は廃止**（curated 選手が少なく、対象大会のエントリーにシード指定も無いため実質ゼロ件で見出しと中身が乖離していた）。代わりに当サイト掲載のエントリー＋前年/直近データの照合だけで決定的に出せる 5 ブロックを `lib/newsArticle.ts` で算出する: ①**連覇・防衛ウォッチ**（前回王者の出場可否＝`titleDefense`。ペア/校一致=intact、ダブルスで片方のみ継続=partial、不在=absent）、②**前回入賞者の再登場**（前年 results の 準優勝/ベスト4/**ベスト8**で今大会も出場する者＝`returningPlacers`。優勝は①が扱うため除外。2026-06-26 にベスト8まで拡大）、③**過去の優勝者の再挑戦**（前々回以前の歴代優勝者で今大会も出場＝`returningFormerChampions`）、④**直近大会の好成績者**（直近の他大会でベスト4以上＝`recentAchievers`。後述）、⑤**出場規模・勢力図**（エントリー数・都道府県別・複数エントリー校＝`fieldOverview`）。照合は `tournamentRecords` の `resolveEntryToChampion` で前年/直近エントリを解決し、`buildFieldIndex` の出場者集合と突合する。判定単位は milestone と同様（個人=選手単位、団体=校単位）。
    - 所属校の表記揺れ吸収（重要）: 年度間で所属校名の末尾に "_<都道府県>"（例: 2025「嬉野」/ 2026「嬉野_佐賀県」）が付くデータが混在する（HJSC 2026 では同名選手 75 人中 29 人で相違）。素の `playerKey`（名前@所属）で照合すると継続出場を取りこぼすため、プレビュー照合は `normalizeTeam()`（末尾 `_[^_]+?[都道府県]` を除去）で正規化したキーで突合し、表示は `cleanDisplay()` で同サフィックスを除去する。**本質的にはデータ側の表記統一が望ましい**（Open Questions 参照）。
    - 混成ペア（所属が異なるダブルス）の照合・表示（2026-07-03〜）: 一般大会ではペアの所属が割れる（クラブ＋実業団など）ケースがある。継続出場の照合は `ChampionEntry.playerTeams`（`players` と index 対応の選手個人の所属）を使い「名前@本人の所属」で突合する（従来はペアのどちらかの所属と一致すれば継続とみなしており、同名別人の誤マッチ要因だった）。表示は `teamDisplayOf` が混成ペアで null を返し、UI 側（`PlayerNames` の `perPlayerTeam`）が選手ごとに「名前（所属）」を付ける（所属が同じペアは従来どおりペア末尾に 1 回）。
    - 直近大会の好成績者の再登場（2026-06-26〜）: 当プレビュー種目の出場者のうち、**直近の他大会でベスト4以上**（優勝/準優勝/ベスト4）の成績を残した選手を `recentAchievers` としてピックアップする。直近の定義は **プレビュー開催日（`information[year].startDate`）から 3ヶ月以内・最大 2 大会**で、`index.json` の **`isMajorTitle` を優先**（major→新しい順で 2 件選抜＝`findRecentTournaments`）。自大会は除外（前回入賞は②が扱う）。「**種目を問わない**」: 直近大会のどの種目での好成績でもよく、個人戦のみ対象（団体は per-player 不可）。`buildRecentAchieverIndex` が直近大会の全種目の results からベスト4以上を `playerKey`（`playerMatchKey`）で人物単位（最良成績）に索引化し、各種目で当大会の出場者集合（`field.playerKeySet`）と突合する。既に①②③で出ている選手は名前で重複排除し、成績→major→新しさ順に最大 8 名（`RECENT_ACHIEVERS_PER_CATEGORY`）。表示は選手名（id 系結果ページへリンク）＋「大会名 年 種目 成績」、major には「主要大会」バッジ。閾値・件数は `lib/newsArticle.ts` の定数（`RECENT_WINDOW_MONTHS`/`RECENT_TOURNAMENT_LIMIT`/`RECENT_ACHIEVERS_PER_CATEGORY`）。
    - ピックアップ選手の途中経過/敗退（2026-06-26〜）: プレビューでピックアップした選手（①連覇・防衛ウォッチ＝前回王者、②前回入賞者、③過去の優勝者）について、その年・種目の大会が**進行中なら途中経過、敗退済みなら敗退情報**を「今大会: ◯◯」バッジで表示する（`EntryStanding`。alive=進行中・緑／eliminated=敗退・灰／champion・runnerup=琥珀）。データ源は当年・種目の `detail.results`（`rank.kind`）で、`normalize-core.js` が **大会途中でも results を生成する**運用変更（未実施試合は敗退でなく `kind:'ongoing'`）に対応したもの。`buildFieldIndex` が `championKey→entryNo`／`playerKey→entryNo`／`entryNo→EntryStanding` を持ち、`currentStandingOf()` がピックアップ対象（前年 `ChampionEntry`）を当年 entryNo に解決して標準を引く（ペア一致が無い partial は継続選手の playerKey で解決）。**results 未掲載（途中経過が未入力）なら何も出さない**（graceful）。`rank.kind` 語彙と運用の詳細は [tournament-data-structure.md](../tournament-data-structure.md)。
    - 結果ページへのリンク（2026-06-26〜）: プレビュー記事の各種目セクションからも、その年・種目の大会結果ページ（`/tournaments/{generation}/{tournamentId}/{year}/{category}/{age}/{gender}/`）へリンクする（結果記事と同形・文言は「大会結果を見る」）。リンクは結果ページが実在する場合のみ張る: `buildCategoryBlock` の `resultHref` を、当年・種目の detail（`readYearDetail`）が存在する場合のみ非 null にし、未掲載の年度ではリンクを出さない（結果ページの `getStaticPaths` が details ディレクトリ走査で生成するため、detail があれば必ずページが存在する）。`categoryId:null` のプレビューは details ディレクトリ走査で種目を列挙するため通常は全種目で実在し、明示 `categoryId` 指定時のみ実在ガードが効く。
    - 選手名のリンク（2026-06-25〜）: ①②③ の選手名は **id 系の結果ページ `/players/{id}/results/`** へ内部リンクする（`PreviewPlayerRef.playerId`）。解決は `data/players/index.json` を姓名一致（`count>=5`・同姓同名は最初の id）で行い、結果ページが無い選手は名前のみ（`lib/newsArticle.ts` の `resolvePlayerId`、学校ページ等と同じ既存規約）。**curated の slug プロフィール `/players/{slug}` は使わない**（curated が少なく網羅できないため）。slug 系と id 系の区別は [players-pages.md](./players-pages.md)「選手 URL の 2 系統」を参照。
  - `/news` 記事の OGP 画像（`summary_large_image` / 1200×630）: `tools/sns-images/news_og.py` が **ローカル生成**し `public/og/news/<articleId>-<hash>.png` を git にコミット（本番ビルドに依存を増やさない方針）。対象は `state==="published"` かつ `type==="result"` のみ。生成時に記事レコードへ `ogImage` を書き戻し、`src/pages/news/[articleId].tsx` が `ogImage` のある記事だけ large カードを出す（無ければ既定の `summary` カードへフォールバック）。`MetaHead` は `imageWidth`/`imageHeight` props で large と既定（192）を共存。preview のOGPは後回し。設計: [raw/2026-06-22-news-ogp-image-design.md](../raw/2026-06-22-news-ogp-image-design.md)。
- 公開フロー（human-in-the-loop）: 生成スクリプトは state:"draft" を作る。人が確認して `data/news/<articleId>.json` の state を "published" に変更すると公開される（承認 UI は未実装、当面 state 手書き運用）。
- 未実装: head-to-head ほか名寄せ依存ブロック（Step8）、career-wins / best4-first / first-appearance、承認 UI。

## 設計原則（確定）

データ取得は完全手動入力のまま維持し、自動化するのは生成のみ（外部速報元の自動クロールはしない）。本文は LLM を使わず**テンプレートのみ**で決定的に生成する（誤り混入ゼロ・低コスト・鮮度シグナル安定）。公開記事は **human-in-the-loop**（自動ドラフト→人が承認→公開）。既存ページへのブロック差し込みは決定的生成のためビルド時自動。

## パイプライン

```
大会データ
  ↓ イベント抽出（初優勝/連覇/王者撃破/通算節目/ベスト4初進出 など）
  ↓ 文脈ブロック生成（一次成果物）
  ↓ 再利用先：大会ページ / 選手ページ / ランキング / 記事
```

イベント抽出を上位概念に置くことで、抽出したイベント列を大会・選手・ランキング・記事の全面で再利用できる。`milestone` は実質その最初の具体例。

## 文脈ブロック（優先度）

データソースは `data/tournaments/details/**` 横断と `data/players/index.json`。詳細は [data-model.md](./data-model.md)。

優先度A（先行実装）は、その大会の歴代優勝者一覧を出す `historical-winners`（過去年度 `results` の `{kind:"winner"}` から機械的に算出。最も安全）、初優勝・連覇等の節目を出す `milestone`、対象ペア/選手の通算成績を出す `career-record`（「当サイト掲載大会分の通算」と明示）。優先度Bは、シードと到達ラウンドを対比する `seed-vs-result`（番狂わせ検出）。優先度Cは `head-to-head`（対戦履歴）で、同姓同名・名寄せ・ペア変更の誤判定リスクが高いため、名寄せ精度の検証が済むまで導入しない。

`historical-winners` の歴代優勝〜ベスト4抽出は、既存の高校歴代ロジック `lib/highschoolNationalTournaments.ts` を大会非依存に一般化して実装する（ゼロから作らない）。

## 出力先と URL

文脈ブロックは記事ページと既存ページ（大会・選手）の両方で再利用する。記事は `/news/<articleId>`（独立ツリー）に置く。`/tournaments/.../preview` のようなツリー内配置は既存大会ページとのカニバリ距離が近いため採らない。大会ページとの関連性は記事→大会/選手/歴代ページへの内部リンクで担保する。カニバリ制御の詳細は [seo.md](./seo.md) の重複マップ #8 を参照。

~~プレビュー記事は結果確定後に**同一 URL で結果記事へ昇格**させ（`articleId` 共有）、検索面を継続保有する。~~ **Deprecated（2026-06-27, ADR-010）**: result 記事は廃止したため昇格は行わない。結果確定後の検索面は大会ハブ／高校歴代ページが受ける。preview は結果確定後、不要になれば取り下げる（または開催前の次年度 preview に置き換わる）。

## 実装順序

記事機能が未完成でも既存ページの情報密度向上による SEO 効果を先取りできる順序にする。`historical-winners` → `milestone` → `career-record` → 大会ページ差し込み → 選手ページ差し込み → preview 記事（B）→ ~~result 記事（A）~~ → `head-to-head`。

> **更新（2026-06-27, ADR-010）**: result 記事（A）は廃止。結果・優勝・歴代まとめは大会ハブに集約したため、この順序の result 段階は実施しない。preview（B）と既存ページ差し込みは有効。

## 関連

- アーキテクチャ判断（なぜ文脈ブロックを一次成果物にするか）: [ADR-005](../adr/ADR-005-news-context-block-architecture.md)
- 大会途中の成績を `results`（`rank.kind:'ongoing'`）に保持する判断: [ADR-007](../adr/ADR-007-in-progress-tournament-standing.md)
- 親仕様（確定事項・全 Open Questions の決定）: [raw/2026-06-21-news-auto-draft-design.md](../raw/2026-06-21-news-auto-draft-design.md)
- Step1 詳細設計: [raw/2026-06-21-historical-winners-logic.md](../raw/2026-06-21-historical-winners-logic.md)
- データ構造: [data-model.md](./data-model.md) / [Data Import](./data-import.md)
- SEO カニバリ運用: [seo.md](./seo.md)
- 既存の歴代記録ロジック: `lib/highschoolNationalTournaments.ts`

## Open Questions

- `milestone` / イベント抽出の語彙確定（初優勝・連覇・3連覇・初出場・王者撃破・通算N勝・ベスト4初進出 のキー定義と判定条件）。
- `head-to-head` 導入可否を判断する名寄せ精度の検証方法。
- 記事 `articleId` の命名規約（プレビュー→結果で共有する安定 ID）。
- 大会改称をまたぐ歴代結合（エイリアス table を持つか tournamentId 単位で割り切るか）。
- **所属校名の表記統一**: `participants[].team` に "_<都道府県>" サフィックスが付くファイルと付かないファイルが混在し、年度間照合・集計の取りこぼし要因になる。現状はプレビュー側で `normalizeTeam()`/`cleanDisplay()` により実行時に吸収しているが、根本的にはインポート時にデータを正規化（または team とは別に prefecture 列へ分離）すべき。Assumption: 校名本体に "_" は出現しない前提でサフィックスを判定している。
