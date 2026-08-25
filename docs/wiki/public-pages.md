# Public Pages

## 概要

現時点では、`softeni-pick.com` と `score.softeni-pick.com` を別コードベースではなく、同一リポジトリ内のモード切替で運用する構成です。

確認根拠:

- `lib/siteConfig.ts`
- `README.md`
- `docs/beta-matches-results.md`

## 実装済み

### サイトモード切替

使用する主な環境変数:

- `SITE_MODE`
- `NEXT_PUBLIC_SITE_MODE`
- `NEXT_PUBLIC_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_SITE_NAME`
- `NEXT_PUBLIC_PUBLIC_OG_IMAGE`

モードごとの既定値:

- `softeni-pick`: `https://softeni-pick.com`
- `score`: `https://score.softeni-pick.com`

### ルーティング

`softeni-pick` mode:

- `/`
- `/players/**`
- `/teams/**`
- `/tournaments/**`
- `/beta/**`
- `/beta/matches-results/**`
- `/growth`（成長記録ハブ・公開/インデックス対象）
- `/growth/[slug]`（選手の成長記録ショーケース・公開/インデックス対象。対象は `data/growth-featured.json` の featured のみ。詳細は ADR-004）
- `/news`・`/news/[articleId]`（大会**展望（preview）専用**。結果記事は廃止し、結果・優勝・歴代まとめは大会ハブ／高校歴代ページに集約＝ADR-010。公開は `state==='published'` かつ `type==='preview'` のみ。詳細は [news-context-blocks.md](./news-context-blocks.md)）
- `/rankings`（選手ランキング・2026-07-02 追加）: Player Statistics Engine の
  `data/rankings/{year}-{discipline}-{gender}.json`（男女別×種目別・シーズンポイント＝年度の上位3大会合算）を
  1 ページに集約し、年度・種目・男女をクライアント側で切り替える（薄いページの量産を避ける）。
  各表は上位 100 位まで。結果ページを持つ選手（`count>=5`）のみ `/players/{id}/results/` へリンク。
  「掲載大会のみ・年度間の母数差」の scope 注記を必須表示。タブ裏はクライアント描画のため、
  全年度・全種目の上位3位を静的 HTML「年度別 上位選手まとめ」で掲載（クロール可能性の担保）＋
  初期表示ボードの ItemList JSON-LD を出力（カニバリ制御は [seo.md #9](./seo.md)）。
  導線: サイドナビ「成績・記録を調べる > ランキング」
  （`lib/navigation.ts`）/ ホームの「選手ランキング」カード / `/players` 一覧上部リンク /
  選手結果ページの「年度別ランキング推移」（相互リンク）。

`/teams`（チーム一覧・2026-08-11 更新）:

- 掲載はチームマスタ（`data/teams/teams.json`）の `count>=2`＝3,861件（D-014）。検索・絞り込みは
  全件クライアント側（props 175KB）。既定は収録試合数の上位50件を静的 HTML に出力。
- **男女切替**（すべて/男子/女子）: `boysCount`/`girlsCount` で行を絞り、収録試合数もその性別の値に
  切り替える。男子2,873件・女子2,405件。ミックス種目にしか出ていない78チームは両方に出す。
- **リンクの出し分け**（TeamLink 規則・D-025）: (1) STリーグ集計があれば `/teams/[teamId]`（60件）、
  (2) 高校は `(校名, 都道府県)` 照合で `/highschool/[gender]/[prefectureId]/[teamId]`（557チーム・
  701リンク。学校ページ721件中701件が一覧から辿れる）、(3) どちらも無ければ名前のみ。
  高校は男女で URL が分かれるため、「すべて」表示では校名の後ろに男子・女子リンクを併記し、
  性別選択中は校名自体をその性別のページへリンクする。

補足（成長分析の公開境界・2026-06）:

- 公開・インデックス対象は `/growth`（運営キュレーションのショーケース）。
- `/beta/matches-results/growth` は内部ツール面で `noindex`（`/beta` は robots Disallow）。対象は公開試合の参加者（`targets.json`）。

高校カテゴリページ:

- `/highschool/[gender]`
- `/highschool/[gender]/[prefectureId]`
- `/highschool/[gender]/[prefectureId]/[teamId]`
- `/highschool/tournaments`（全国大会の歴代記録 入口）
- `/highschool/tournaments/[tournament]`（大会別 歴代記録、`tournament` = `championship` / `japan-cup`）

補足:

- `mixed` の高校大会結果は、boys / girls の両方の一覧と学校ページに表示する
- `mixed` は独立した高校トップページや切り替えタブを増やさない

高校カテゴリの公開ページ方針・全国大会の歴代記録ページの詳細は
[highschool.md](./highschool.md) に集約した（URL 一覧は上記のとおり）。

地域大会結果ページ:

- `/tournaments/local`
- `/tournaments/local/[federationId]`

地区（ブロック）大会結果ページ（2026-07-22 追加）:

- `/tournaments/block`
- `/tournaments/block/[blockId]`

高校総体の地区大会など、複数都道府県にまたがる大会向け。`/tournaments/local`とは別ルート（`federationId`と`blockId`はNext.js Pages Routerの制約上、同一階層の動的セグメントに共存できないため）。

関連:

- [Tournaments Local](./tournaments-local.md)

`/tournaments` 一覧のモバイル表示:

- カードで大会状態を判別できるようにする
- `開催予定` はラベルを表示し、横に日付と開催地を並べる
- 結果未反映で外部リンク導線のみの大会は `外部掲載` を表示する
- 一覧構造や既存URLは変更しない

`information/{tournamentId}.json` の `resultPath`（2026-08-12 追加）:

- 結果が `data/tournaments/details/` ではなく**サイト内の別ページ**にある大会のための任意フィールド。
  値はその年度の内部URL（例: STリーグ 2025 → `/st-league/2025/matches/`）。
- `/tournaments` の `getStaticProps` は `resultPath` があれば `firstCategoryPath` に採用し、
  `hasInternalResult` も true にする。これにより details を持たない大会でも大会名リンク・
  「結果」バッジ・モバイルカードのタップ先が**内部リンク**になり、「結果あり」フィルタにも乗る。
- details がある大会では従来どおり `details/{年}/{categoryId}.json` の走査結果を使う（`resultPath` 優先）。

大会ハブページ（`/tournaments/[generation]/[tournamentId]`、2026-06 追加）:

- 年度を含まない「ソフトテニス 大会名 結果」検索クエリの受け皿となる、1大会の歴代結果まとめページ
- `getStaticPaths` は `data/tournaments/details/{tournamentId}` 配下の年度ディレクトリを走査して生成し、`generation` は `index.json` / `local_index.json` の `generationId` から解決する（不明時は `unknown`）
- SEO（カニバリ集中、2026-06）: 高校全国大会 ID（`getHsNationalSlugByTournamentId` が解決）に該当するハブは `noindex, follow` にし、検索面を `/highschool/tournaments/[tournament]` へ集中させる。該当時はページ上部に高校歴代ページへの誘導バナーを表示する。それ以外の大会のハブは従来どおり index 対象。詳細は [seo.md](./seo.md) #3
- 実際に詳細データがある年度・種別のみをチップでリンク化し、年度降順で表示する。種別ラベルは `information/{tournamentId}.json` の `categories[].label` から解決する
- 各詳細 JSON から優勝ペア（`results[].tournament.rank.kind === 'winner'` のエントリーの選手名・所属）を抽出し、「歴代優勝者」表を表示する
- 構造化データは `CollectionPage` / `ItemList`（歴代優勝者）/ `BreadcrumbList`（`Breadcrumb.tsx` 由来）を出力する
- 大会一覧カード（`TournamentCard`）と年度別結果ページのパンくずからハブページへ内部リンクする。トップページの「最近追加された大会」カードのリンク先もこのハブページ（年度なし）とする（2026-06 変更。以前はカテゴリ別の年度別結果ページへリンクしていた）
- 年度別結果ページ（`/tournaments/.../[gender]`）には `SportsEvent` 構造化データと冒頭の説明文を追加し、title / description を「結果・トーナメント表」を含む形に改善する
- SEO（特集ページへの集中、2026-08-12）: `index.json` の `featurePath` を持つ大会（現状 STリーグのみ）のハブも
  `noindex, follow` にし、検索面を特集トップ（`/st-league/`）へ集中させる。高校全国大会と同じ扱い（[seo.md](./seo.md) #3）。
  該当時はページ上部に特集への誘導バナーを表示し、`details` が無いため空になる「年度別結果」は
  `information[].resultPath` から年度カード（チップは「結果・順位表」1枚）を組み立てる。
  歴代優勝者表・文脈ブロックは details 由来のデータが無いので出さない
- 「学校部活動と地域クラブの内訳」節（2026-08-12 追加）: 出場団体を学校 / 地域クラブに分類し、年度別の推移を表で出す。
  対象大会は `lib/clubTransition.ts` の allowlist で絞る（現状は全中 `secondaryschool-championship` のみ。
  年度が2つ未満で推移として読めない大会は自動的に null）。詳細は下記「学校部活動と地域クラブの内訳」
- 実装: `src/pages/tournaments/[generation]/[tournamentId]/index.tsx`、`src/components/tournaments/TournamentCard.tsx`、`src/components/Tournament/ClubTransitionSection.tsx`

中学カテゴリ（`/secondaryschool`、2026-08-12 追加）:

- `/secondaryschool/`（入口・1枚）／ `/secondaryschool/[prefectureId]/`（47枚）／
  `/secondaryschool/[prefectureId]/[teamId]/`（280枚）の計328ページ
- **高校とは意図的に構成が違う**。性別を URL に入れない（男女別にすると32%が5件未満になる）、
  「学校」ではなく「チーム」として扱う（掲載チームの4割が地域クラブ）、大会軸のページを作らない
  （全中は大会ハブへ寄せる＝ADR-010 の重複回避）。詳細は [secondaryschool.md](./secondaryschool.md)
- **順位づけをするページ・節を持たない**。当初あった県別ポイントは、大会ごとに県の出場枠が違い
  （全中は県により20倍差）比較が成立しないため 2026-08-12 に廃止した。都道府県ページの役割は
  「県内にどのチームが収録されているか」の一覧
- チームページには「中学 → 高校の進路」を掲載する。両カテゴリを名寄せ済みで持っているサイトにしか作れない。
  **逆引き（高校の学校ページ→出身中学、81校）も同じデータから出す**（新規URLなし・`lib/highschoolFeederSchools.ts`）
- 生成は `npm run secondaryschool:build`（prebuild に組み込み済み）。
  **`normalize-team-names.mjs --scope=all` の後に流すこと**
- 実装: `src/pages/secondaryschool/**`、`lib/secondaryschool.ts`、
  `scripts/build-secondaryschool-index.mjs`、`scripts/build-secondaryschool-pathways.mjs`

### 学校部活動と地域クラブの内訳（2026-08-12 追加）

対象 URL: 大会ハブ（`/tournaments/[generation]/[tournamentId]`）のうち allowlist に載る大会。現状は全中のみ。
集計・分類は `lib/clubTransition.ts`、検証は `npm run club:verify`（`scripts/verify-club-transition.ts`）。
検討記録は [raw/2026-08-12-idea-juniorhigh-category-pages.md](../raw/2026-08-12-idea-juniorhigh-category-pages.md)（候補3）。

- 狙い: 日本中学校体育連盟が **2023年度（令和5年度）から全国中学校体育大会に「地域クラブ活動の参加資格の特例」を設けた**
  という外部の制度変更を、自前の出場団体データで定量的に裏付ける。実測は 2022年度1団体(1%) → 2023年度10(10%)
  → 2024年度21(21%) → 2025年度39(37%) で、**跳ね上がりの年が制度の変わり目と一致する**。
  「部活動 地域移行」「地域クラブ活動」というソフトテニス系サイトが取りに行っていないキーワード群の受け皿であり、
  [seo.md](./seo.md) #8 が言う「farm が構造的に持てない DB 由来の差別化」に当たる
- **分類は「クラブと断定できる積極的な証拠がある場合のみ club」という下限カウント**。
  中学の大会データは出典によって表記が混在しており（全中は略称、ブロック大会のPDFは正式名称）、
  `名寄`（= 名寄市立名寄中学校）`湊山`（= 米子市立湊山中学校）のように「中学校」を含まない学校名が多数ある。
  「中学校を含まない＝クラブ」と推定すると2022年度98団体中74件を誤ってクラブ側に倒し、
  **トレンドが表記ゆれのアーティファクトになる**。判定できないものは `unknown` とし、学校にもクラブにも数えない
- 判定順序: ①学校マーカー（`中学校` `中等教育学校` `学園` `学院` `義塾` `附属` `付属` `高等学校` `高校` `中$`）→ school
  ②クラブマーカー（`クラブ` `スポ少` `少年団` `ジュニア` `ユース` `協会` `STC` `JSC` `JSTC` `SOC` `Jr` 等）→ club
  ③ラテン文字2文字以上（区切り記号を除去して判定。`M's` `N.N` を拾うため）→ club
  ④カタカナ3文字以上連続（`スマイリー` `レペゼン千葉`）→ club ⑤それ以外 → unknown
- 規則の安全性は全中学大会データで検算済み: ラテン2文字以上を含む名前171件のうち学校マーカーも含むのは0件、
  末尾 `中` の38件にカタカナ・ラテンの混入は0件、学校マーカー持ちでカタカナ3連を含むのは
  `苫小牧市立ウトナイ中学校` の1件のみ（学校マーカーが先に効くので誤判定にならない）
- UI では判定不能件数を年度ごとに併記し、「地域クラブ数は下限」と明示する。数字が実態より確かなものに見えないようにするため
- Assumption: `男塾` `半田球友` のように名称からは判別できないクラブが unknown に残っている。下限であることの許容範囲として扱う
- データ品質メモ: 中学の大会データに `四天王寺高校` という高校名の団体が混入している（中高一貫校の表記ゆれと見られる）。
  学校であることは確かなのでクラブ側に倒さないよう `高校` を学校マーカーに含めてある

`score` mode:

- `/matches`
- `/matches/[matchId]`
- `/matches/growth`

### 開催前の大会を出す（2026-08-25 追加）

結果DBとして積み上げてきた結果、当サイトは**過去形のページしか持っていなかった**。
`information/*.json` に集めた `venues`（会場の構造化データ）が**どこにも描画されていなかった**のは
実装漏れではなく、venue が載るべき「開催前の大会ページ」が無かったため
（経緯: [raw/2026-07-26-idea-tournament-metadata-platform.md](../raw/2026-07-26-idea-tournament-metadata-platform.md) 追記6・7）。

**新規URLは増やしていない**。既存の2面を更新して受ける。

| 面 | 何を出すか | 実装 |
|---|---|---|
| 大会ハブ `/tournaments/[generation]/[tournamentId]` | 「開催前」ブロック（会期・開催地・実施種目・**会場**・公式情報）。`venues` の唯一の描画先 | `src/components/tournaments/UpcomingTournamentSection.tsx` |
| 同上 | 「関連する大会」ブロック（予選会↔本大会の相互リンク） | `src/components/tournaments/RelatedTournamentsBlock.tsx` |
| 大会一覧 `/tournaments/` | 「これから開催」ブロック（開催日**昇順**・最大5件） | `TournamentSearchTable.tsx` の `UpcomingHighlights` |

判定ルール:

- **開催前ブロック**は「`endDate >= 今日` かつ その年度の結果がまだ無い」information がある大会だけに出る。
  「今日」は `lib/highschoolInProgress.ts` と同じく**ビルド時刻**（静的書き出しのため）。
- 1年分も結果が無くこれから開催される大会（例: 2026年度のアジア競技大会）は、
  **h1・title・description・本文を「歴代結果」から「日程・会場」へ切り替える**。
  歴代を名乗ると中身と食い違い、かつこのとき実在する需要は「{大会名} 日程 / 会場」のほうであるため。
- **予選会↔本大会の対応付けは `tournamentId` の命名規約**（`{本大会ID}-qualifier`）で行い、
  データ側にフィールドを増やさない。本大会が未登録ならリンクが出ないだけで壊れず、
  将来 `world-championship` 等を登録すれば自動で繋がる。
- 「これから開催」のリンク先は**サイト内の大会ハブ**にする。カード側の導線は結果が無い大会だと
  外部の公式サイトへ出てしまうが、ハブには開催前ブロックがあるためそちらへ寄せる。

**「日程・会場」表示に切り替わる条件**（h1 / title / description / 本文の4点が同時に切り替わる）:

1. その大会に**1年分も結果が無い**（`details/{tournamentId}/` にカテゴリJSONが1つも無い）
2. かつ**開催前ブロックが出ている**（`endDate >= 今日` の information がある）

つまり「結果ゼロ」かつ「未来の予定あり」の大会だけ。過去の結果がある大会（例: 天皇賜杯）は
開催前ブロックは出るが h1 は「歴代一覧」のまま。大会が終わって結果が入れば条件1が崩れ、
**自動的に歴代表示へ戻る**（手作業の切り戻しは不要）。

**構造化データ**: 開催前ブロックが出る大会には、歴代の `ItemList` とは別に単体の `SportsEvent` を出す。
日付・会場・住所が揃うのはこの形のときだけで、`venues` があれば `streetAddress` / `postalCode` /
`addressLocality` まで入る（`buildEventPlaceFromVenue`）。**`organizer` は出さない**——
既定値が Softeni Pick で、当サイトは主催者ではないため（`lib/sportsEventJsonLd.ts` の
「虚偽の構造化データを避ける」方針）。

**広告位置との関係**: 「これから開催」は `/tournaments/` の**広告枠より上**（フィルターバーの前）。
`UPCOMING_LIMIT = 3` はこの制約から決まった数値で、5件だと枠がファーストビューから外れる
（375×812 実測: 5件=枠下端904px / 3件=779px）。増やすときは測り直すこと。
経緯は [ADR-016](../adr/ADR-016-manual-adsense-units-over-auto-ads.md) の 2026-08-25 追記。

**運用（対応もれの検査）**: 開催前ブロックも「これから開催」も、information に行が無ければ
**エラーにならず静かに出なくなる**。予選会↔本大会のリンクも命名規約に頼っており、
本大会を別IDで登録すると黙って繋がらない。`npm run check:upcoming`
（`scripts/check-upcoming-tournaments.mjs`）がこの3種の抜けを一覧にする。
終了コードは常に0（運用の残タスク一覧であり、ビルドを止めるエラーではないため prebuild には入れない）。

**既知の穴**: `/tournaments/major/` は「結果のある年度が1つ以上ある大会」だけを載せるため、
**開催前だけの大会は出ない**（`asian-games` への内部リンクは `/tournaments/` と予選会ハブの2枚のみ）。

**残作業**: ここまでは pull（探しに来た人が見つけられる）まで。push（関心が向いていない人へ届ける）は
未着手で、順番つきの一覧を
[開催前の大会・国際大会の露出 実行ランブック](./upcoming-tournaments-runbook.md)に置いた。

### トップページ（`/`）の SEO 方針（2026-06 改善）

実装: `src/pages/index.tsx`

- **本文を静的 HTML に含める**: 以前は全コンテンツを `{!isClient ? null : ...}` でクライアントマウント後のみ描画しており、`output: 'export'` の静的 HTML に h1・紹介文・カードが一切出力されていなかった。`isClient` ゲートを撤去し、SSG 時に本文を出力する
  - ゲートの目的だった `toLocaleDateString('ja-JP')` のハイドレーション不一致は、`getStaticProps` で `YYYY-MM-DD` から決定的に整形した `displayDate`（`YYYY年M月D日`）を渡すことで解消する。クライアントでロケール依存整形を行わない
- **内部リンクをクローラ可能にする**: 大会・選手・STリーグ・高校・チームへの導線は `<div onClick={() => (window.location.href = ...)}>` だったためクローラがたどれなかった。`next/link` の `<Link>` に置き換え、ハブページとして内部リンクを流す
  - チームカードは外部「公式サイト」リンクを内包するため、`<a>` の入れ子を避けるストレッチドリンク方式（カード `relative` + 内部 `Link` に `after:absolute after:inset-0` + 外部 `<a>` を `relative` で前面）にする
- **見出し階層**: `h1`（1個）→ セクション `h2` → カード `h3` に統一する。以前はカード内に `h2` が混在していた
- **title / description**: ブランド名「Softeni Pick」と主要キーワード（ソフトテニス / 大会結果 / 選手成績 / 全国大会 / 全日本選手権 / インターハイ）を含めて一意化する
- **構造化データ（JSON-LD）**: `Organization` / `WebSite` / `ItemList`（最近追加された大会）を出力する（`BreadcrumbList` は `Breadcrumb.tsx` 側が出力）。`WebPage` の `dateModified: new Date()`（ビルド日）は規約どおり撤去した（ビルド日は使わない）

### canonical / OGP / サイト名

`siteConfig.baseUrl`, `siteConfig.siteName`, `siteConfig.ogImage` を通して切り替える実装です。

確認根拠:

- `lib/siteConfig.ts`
- `src/components/MetaHead.tsx`

### パンくずの構造化データ（BreadcrumbList）

**`src/components/Breadcrumb.tsx` が `BreadcrumbList` JSON-LD の唯一の出力元。**
ページ側で `BreadcrumbList` の JSON-LD を個別に書いてはいけない（可視パンくずと同じ
`crumbs` から自動生成される）。

- 各ページは `<Breadcrumbs crumbs={[...]} />` に階層を渡すだけでよく、可視パンくずと
  JSON-LD が同じ配列から生成されるため両者がずれない
- `crumb.href` は相対パス（`/players`）でも絶対 URL でも受け付ける。コンポーネント側で
  絶対 URL 化し、`next.config.mjs` の `trailingSlash: true` に合わせて末尾スラッシュを付与するため、
  `item` は canonical と同じ形になる
- `BreadcrumbList` は「現在のページまでの祖先」を並べるもので、配下ページ（例: 選手ページから
  その選手の結果ページ）を末尾に足さない

経緯（2026-08-25）: 上記コンポーネントに加えて `src/pages/` 配下の 26 ファイルが同じ
`BreadcrumbList` を独自に出力しており、全ページで JSON-LD が 2 個重複していた。
ページ側の記述を削除してコンポーネントに一本化した。あわせて次の既存バグも解消した。

- crumb に絶対 URL（`pageUrl`）を渡していた 3 ページ（`/tournaments/block/[blockId]`,
  `/tournaments/local/[federationId]`, `/teams/[teamId]/[year]/[gender]`）で、
  `item` が `https://softeni-pick.com/https://softeni-pick.com/...` になっていた
- `/privacy` の可視パンくずのリンク先が `/players` になっていた

### 選手ページ（→ players-pages.md に分割）

選手 URL の 2 系統（`/players/{slug}` プロフィール系 と `/players/{id}/results` 結果ページ系）・
選手一覧ページ・選手ページの SEO 方針・選手結果ページの noindex 選別は、
[players-pages.md](./players-pages.md) に集約した。

### 試合詳細ページの SEO 方針（2026-06 改善）

対象は `src/pages/beta/matches-results/[matchId]/index.tsx`（実装本体）と、掲載大会配下のネスト URL（`/tournaments/.../matches/[matchId]`）。両者は同じ `PublicMatchDetailPage` を共有するため SEO も共通。

メタ:

- title / description は試合ごとに一意化する。`{チームA} vs {チームB}｜{大会名}{ラウンド} 試合詳細・スコア` を基本形とし、description にはゲームカウント・勝者・総ポイント数・分析観点を埋め込む
- canonical は `getPublicMatchDetailPath(match)` に末尾スラッシュを付けた実 URL（`trailingSlash: true` に一致）。siteLink 有無で本ネスト URL か一覧配下 URL かが切り替わる

構造化データ（JSON-LD、別 `<Head>` で出力）:

- `SportsEvent`：`sport: ソフトテニス` / `competitor`（両チーム）/ `startDate`（`match_date` 優先、なければ `created_at`。ビルド日は使わない）/ `superEvent`（掲載大会ページがある場合の大会）/ `location`（`court_name` がある場合）

可視パンくず / `BreadcrumbList`:

- `src/components/Breadcrumb.tsx` に `crumbs` を渡し、可視パンくずと `BreadcrumbList` JSON-LD の両方を生成する（このページは `PageLayout` 対象外のため個別に配置）。階層は ホーム → 試合一覧 → （大会）→ 試合 で、大会階層は掲載大会ページがある場合のみ挿入する

sitemap:

- `next-sitemap.config.js` で選手結果ページに最新出場大会日、大会結果ページに開催日を `lastmod` として出力する

### SportsEvent 構造化データの推奨項目（2026-06 追加）

GSC「イベント」拡張レポートで `SportsEvent` の推奨項目不足の警告（`eventStatus` / `image` / `endDate` / `location.address` / `organizer.url` / `performer` / `offers` など）が出ていた。必須項目（`name` / `startDate` / `location`）は充足しておりリッチリザルト自体はブロックされない警告だが、データと矛盾しない範囲で補う。

- 共通ヘルパー `lib/sportsEventJsonLd.ts` に集約し、4 箇所（大会年度別結果ページ、大会ハブの歴代優勝者 ItemList、試合詳細ページ、ST リーグ試合ページ）で利用する。
- 常に付与: `eventStatus = EventScheduled` / `eventAttendanceMode = OfflineEventAttendanceMode` / `image`（`siteConfig.ogImage`）。
- `endDate` は無ければ `startDate` で補完（`resolveEventDates`）。
- `location` は常に出力し、`PostalAddress`（最低限 `addressCountry: 'JP'`、都道府県等が分かれば `addressRegion`）を含める（`buildEventPlace`）。
- `organizer` は `url` 付き（`buildEventOrganizer`、既定 Softeni Pick。ST リーグは日本ソフトテニス連盟）。
- `performer`: 出演者が一意に定まるページのみ付与する。試合詳細＝対戦両チーム、歴代優勝者＝優勝者。年度別結果ページは出演者が一意でないため付与せず、`performer` の警告は許容する。
- `offers` は付与しない。無料の結果ページにチケット販売情報を付けるのは実態とずれ、虚偽の構造化データは手動対策リスクがあるため。`offers` の警告は許容する。

### 大会 年度別結果ページの OGP 画像（2026-07-31 追加）

年度別結果ページ（`/tournaments/.../[gender]`）の OGP を、**ベスト16のトーナメント表**
（1200×630、`summary_large_image`）にする。ベスト16→8→4→決勝の4ラウンドを、公開ページの
トーナメント表と同じ「両端に名前・内側は線だけ・勝者の線が太い」描き方で1枚にまとめる。

- **ベスト16まで**なのは可読性の制約。OGカードはタイムライン上で幅350〜600px程度に縮小されるため、
  ベスト64（縦32行）だと元画像で文字が約10px・縮小後は約4pxで読めない。ベスト16なら縦8行取れる。
- **画像に大会名・年・種目は入れない**。X はカードの下にページタイトル（「{大会名} {年}年
  {種目} 結果・トーナメント表 | ソフトテニス情報」）を必ず出すので、画像にも入れると同じ情報が
  2回出る。上部はサイト名だけのバーにし、フッターは廃止して残りの縦をすべて表に使う。
- **`matches` から直接組む**（`entries[].type` によるブラケット復元は使わない）。決勝から
  「その組が直前に勝った試合」を辿るだけなので、**予選リーグを含む大会でも生成でき**、
  ラウンド名の表記ゆれ（決勝を「4回戦」と書く大会）にも影響されない。316大会中**311件**で生成。
  残りは決勝が未確定で、既定の summary カードにフォールバックする。
- 生成: `python tools/sns-images/tournament_og.py --apply`（Pillow、`snslib.py` のブランド配色を流用）。
  **ローカル生成してPNGをコミットする**（`news_og.py` と同じ方針。本番ビルドに画像生成の依存を
  増やさない）。128色パレット化で 12MB / 311枚。RGBのままだと3倍近くになり git に重い。
- 索引は `data/tournaments/og-images.json`。**details JSON には書き戻さない**（matches の忠実な
  記録のままにしたいので、画像の有無という表示都合を混ぜない）。ページ側は
  `lib/tournamentOgImage.ts` が索引を読み、あれば `MetaHead` に `image` /
  `imageWidth=1200` / `imageHeight=630` / `twitterCardType='summary_large_image'` を渡す。
- ファイル名に内容ハッシュを付けているので、データ修正→再生成で別名になりキャッシュを踏まない。
  古いPNGは再生成時に掃除される。
- 対象は年度別結果ページのみ。大会ハブ・選手ページは従来どおり既定の summary カード
  （2026-06-22 の設計メモの結論を、トーナメント表ができたこの1面についてだけ更新した）。

### llms.txt（2026-06 追加）

LLM / AI クローラ向けにサイト概要と主要 URL を案内する `public/llms.txt` を配置している（[llmstxt.org](https://llmstxt.org) 準拠）。`public/` 配下のため `https://softeni-pick.com/llms.txt` として静的配信される。

- 構成: H1（サイト名）+ ブロッククォート（要約）+ 概要段落 + H2 リンクリスト（主要ページ / 試合結果・分析 / データ構造 / サイト情報 / Optional）
- 掲載 URL は公開導線のみ。`robots.txt` で Disallow している `/api/`・`/beta/`・`/test-db` や記録管理導線は含めない
- 公開ページ追加・主要 URL 変更時は `public/llms.txt` も更新対象とする
- 実装: `public/llms.txt`

確認根拠:

- `public/llms.txt`
- `public/robots.txt`

### 共通ページレイアウト

公開ページ（`/beta/**` を除く）は `src/components/PageLayout.tsx` で統一しています。

- 外側ラッパー: 背景色・余白（`py-10 px-4`）を統一
- 内側コンテナ: `maxWidth` prop（`3xl`〜`6xl`、デフォルト `3xl`）で各ページの幅を指定
- `<main>` は `_app.tsx` 側でラップされるため、ページ側では使用しない（入れ子 `<main>` 解消済み）
- `/beta/**` は対象外（開発中のため）

確認根拠:

- `src/components/PageLayout.tsx`
- `src/pages/_app.tsx`

### ナビゲーション再設計方針（2026-06-22 決定 / 実装前）

Draft（方針確定・実装前）。回遊（大会 ↔ 選手 ↔ 年度 ↔ チーム）を深めるため、
現行の横並びヘッダー1本から左サイドバー型2ペインへ刷新する方針を採用。
親仕様: `docs/raw/2026-06-22-nav-two-pane-design.md`、決定記録: ADR-006。

確定方針:

- `softeni-pick` mode: PC は左サイドバー＋右コンテンツの2ペイン。サイドバーは
  折りたたみ可能（ピン留め・状態保持）。モバイルはハンバーガーでドロワー化。
- `score` mode: サイドバーは出さず**上部バーのみ**（現行の試合一覧/成長分析を維持）。
  分岐は `isScoreSiteMode()` を踏襲。
- グローバル区分（サイドバー第1階層）は「セクション入口」に限定し、末端ページ
  （学校ページ等）への重複リンクは張らない。
- コンテキスト第2階層は**本文上部のサブナビ**に置く（サイドバー内ではない）。
- コンテンツ最大幅は現状最大（`max-w-6xl`）まで取れるシェルとし、サイドバーが
  コンテンツを狭めない。各ページの `maxWidth` 指定は維持。
- 年度の前後ナビは全エンティティ共通の汎用コンポ（`YearPagerNav`・仮）に集約。
- 既存 SEO 内部導線（都道府県一覧→都道府県→学校、男女セグメント型切替
  `HighschoolGenderToggle`、都道府県ページの直近3年表示など）は作り直さず再利用し、
  重複リンク・パターン二重化・絞り込み意図の上書きを避ける。

実装前の残課題は親仕様の「残課題」を参照。

## 現時点での論点

### URL

- `score` 側は `/matches*` を正規公開 URL にする設計
- `softeni-pick` 側には従来の `/beta/matches-results*` が残る

### OGP / site name

- `score` mode の既定 site name は `Softeni Pick Score`
- OGP 画像 URL もモードで切り替わる

### ヘッダー/フッター切替

Assumption:

- モードによって導線の見せ方を切り替える意図は強い
- ただし、今回確認した範囲では専用ヘッダー/フッターを完全分離する設計文書までは未確認

更新（2026-06-22）: ナビ再設計で `softeni-pick`=2ペイン、`score`=上部バーのみと
方針確定（上記「ナビゲーション再設計方針」/ ADR-006）。現行 `Header.tsx` の
`isScoreSiteMode()` 分岐を踏襲する。

## Draft

- `score.softeni-pick.com` を本体サイトから情報設計レベルでどこまで切り離すか
- score 側専用のブランド/ナビゲーション設計

## Deprecated

- Host 判定や referer 判定でモードを切り替える方針
  現行実装は `siteConfig.mode` を基準にしています

## 発展候補アイデア一覧（Idea Backlog）

| アイデア | 状況・目的（1行） | 詳細 |
|---|---|---|
| 大学カテゴリの公開ページ | **保留中（2026-08-14）。データの下ごしらえのみ適用済みで、公開ページ・コードは未着手（新規URLゼロ・`src/`への変更ゼロ＝サイトの表示は変わっていない）。** 再開の入口は[節の整理の設計](../raw/2026-08-14-highschool-pathway-sections-design.md)の案A/B/C決定。以下は保留までの経緯。2026-08-11 の成年カテゴリ検討で「大学は都道府県が0.5%しか付かないので向かない」と一度棄却したが、**深さを測っていなかった**ため見直した。実測で**大学は中学の真逆のプロファイル**——チーム数は少ないが**1チームが濃い**。`日本体育大学`は全チーム中1位なのに `/teams/[teamId]` の `getStaticPaths` が `team-name-mappings.json`（大学0件）＋STリーグのみなので**大学は1校もページが無い**。**2026-08-14、中学カテゴリの実装を踏まえて方針転換**: ツリーを作るのではなく**進路接続を先にやる**。理由は(1)`prefecture` が `日本学連`/`学連` で**地域軸が本当に存在せず**、ツリーを作っても135ページの平屋にしかならない (2)進路なら**新規URLは索引2枚だけ**で残りは高校の既存721ページへの節追加 (3)**高校×性別グループ300は中学の111の2.7倍**（高校ページの42%に付く。進路採用1,111件・受け皿123大学・3名以上を送り出す高校×性別122）。中学の実装からの学びとして**ランキングは作らない**（中学は県別ポイントを実装後に廃止。大学は深さの相当部分が一般大会由来なので分母がさらに恣意的）、**大会軸ページも作らない**（ADR-010、インカレ・王座は既存ハブへ）。**中学→高校→大学の3段接続は現時点で0人**（収録年が足りない）だが、**インカレ2026（例年8月末〜9月初旬）の結果投入で初めて成立する**。**着手前に節の並べ方の決定が要る**（2026-08-14）: 進学先大学を足すと高校の学校ページに「主な卒業生」66グループ・「出身中学」113・「進学先大学」300の3節が並び、**実測で96人＝主な卒業生の69%が二重に出る**（卒業生140件のうち55%は最後の所属が大学）。「出身中学」と「進学先大学」は同じ進路データの前後なので1節にまとめる案Aを推奨。詳細は[節の整理の設計](../raw/2026-08-14-highschool-pathway-sections-design.md)。**チーム名の下ごしらえは適用済み（2026-08-14）**: 186→163チーム、中央値20→25、試合5未満25.8%→16.6%。初回の「表記ゆれほぼ0」評価は誤りで、壊れ方が先頭文字脱落型のため通常の正規化をすり抜けていた。**大学名は大学大会の外にも現れる**ため専用大会だけを見た棚卸しでは取りこぼす、という教訓つき | [アイデア](../raw/2026-08-12-idea-university-category-pages.md) / [チーム名の下ごしらえ](../raw/2026-08-12-university-team-name-cleanup.md) |
| 成年（社会人・一般）カテゴリの都道府県ページ・強豪チームランキング | **発散フェーズ（2026-08-11、データ深度の再検証で評価修正）**。高校型（都道府県ページ＋チーム個別ページ）のフル横展開は**データ不足で非推奨**と判明: 成年1,167チームの試合数は中央値4試合、57.3%が5試合未満（`/teams/[teamId]`のnoindex閾値未満）、`team-name-mappings.json`でのカバーも5%のみ。当初「最有力」としたのはチーム数・都道府県カバー率だけを見た誤読で、試合数分布を見ると薄いページ量産のリスクが高い。上位12%程度（15試合以上、約142チーム）に絞った`/highschool/rankings`型の一覧ページなら見込みがあるが未検討。今回はSTリーグ出場チームの「メンバー」節・選手名リンクのみ先行実装（`st-league.md`参照） | [アイデア](../raw/2026-08-11-idea-general-category-prefecture-pages.md) |
| トーナメント表の作り直し | **実装済み・ビルド確認済み**（2026-07-31実装、2026-08-07 `npm run build` 実機確認・問題なし）。`TournamentBracket` は `describeBracketLayout` が成功すれば新描画 `BracketSheets`、失敗すれば従来描画にフォールバックする（`nextMatchId` の有無では分岐しない）。モジュールは `lib/bracketLayout.ts`（純粋関数）／`lib/bracketLayout.server.ts`（`fs` を使うので分離）／`lib/bracketDrawing.ts`（座標計算。SVG文字列ではなく配列を返しモックとReactで共有）／`src/components/Tournament/BracketSheets.tsx`。**`lib/bracketLayout.ts` は `tournamentRecords` から型だけを import すること**（`fs` が値で入るとクライアントバンドルが壊れる）。以下は設計の経緯。本命 A は**結果が未入力でもブラケットの全ラウンドと接続線が描かれていて、勝ち上がりを目で辿れる**こと。**勝者を選ぶインタラクションではないので状態管理は不要**（ユーザー確定。SSG のまま完結する）。あわせて大規模ドローの分割表示（B）と左右対称レイアウト（C）を検討したいが、これらは A と同じツリーへの別の見せ方に還元される。現行 `TournamentBracket.tsx` は `matches` のツリー（`nextMatchId`）前提のため**開催前は成立せず**（IH2026は`nextMatchId`が0件で60本の独立ツリーになる）、シード・足長も表示されない。復元は `lib/bracketLayout.ts`（前哨戦用に先行して切り出し済み）にあり、**全データ検証で209大会・20,571試合が一致／不一致0件**（`npm run bracket:verify`）。検証の副産物として不具合を2件修正: **(1) `type` の入力ミスで席がずれた10大会が誤ったラウンドを表示していた**（検出したら復元を諦める＋`bracket-slot-parity` ルール追加）、**(2) bye無しの2冪ドロー36大会を「シード未入力」と誤判定して取りこぼしていた**。復元できない残りは予選リーグ81（構造的に対象外）・`type` null の完了済み15（逆算可能・未実施）・席ずれ10。**描画用ツリー `buildBracketTree` は実装・検証済み**（209大会・20,571試合が正しいラウンドに配置、欠落0。`npm run bracket:verify:tree`）。IH2026（結果未入力）で512枠・9ラウンドがすべて揃うことを確認。**B・C の基準も確定**（2026-07-31）: **1枚64枠**（＝ベスト64が1枚に収まる）で、山シートは各山の代表が決まるまでの6ラウンド、それとは別に**ベスト64シート**を持つ（4〜6回戦が重複するのは承知の上）。各枚は**左右から中央へ収束**し、拡大縮小できること。512枠は9枚、64組以下の大会（210中124）は1枚で完結。描き方は**紙のドロー表と同じく選手名を左右の両端にだけ置き、内側は線だけで繋ぐ**（勝ち上がった選手を各ラウンドに書き直さない。勝者は線の濃さで示し、**縦線も勝者側の半分を太く**して横→縦→横が1本に繋がるようにする）。これにより64枠が**602×682px**に収まる。線を引くかどうかは `BracketNode.present`（その山にエントリーが居るか）で判断すること。`entries`（確定した entryNo）で判断すると**結果未入力の大会で線が消える**。不戦勝の枠は縦線を引かず、その選手の高さのまま次ラウンドへ通す（中点に寄せるとシードの線が折れる）。また**不戦勝で通した区間は、その先で勝った時点に遡って太くする**（シード・足長の太線が選手名の根本から始まるようにするため。引いた直後には太さが決まらないので、線は配列に貯めて後からまとめて出力する）。**ラウンド名の見出しは出さない**（列幅に対して長すぎて隣と重なる。紙のドロー表にも無い）。**エントリー番号は名前のさらに外側**、**スコアは上下それぞれの獲得ゲーム数をその側の横線の上に1つずつ**置く（`4-2` と1つにまとめると常に勝者が左に来てどちらの組の点か読めないため。勝者は濃く太字、敗者は薄く、棄権は敗者側に「R」）。**決勝だけは左右が同じ高さの1本になるので中央の左右に振り分ける**。**決勝の横線は両側とも中央まで引くが、太いのは勝った側だけ**（他のラウンドと違い左右が同じ高さでぶつかるため、両方太くすると1本の長い太線になりどちらが勝ったか読めない。負けた側は細い線で決勝まで来たことを示す）。**負けた枠へ向かう区間も太くする**（太線は「どこまで到達したか」を示すので、勝ち上がった先で負けた線が前の枠の中点で途切れて宙に浮かないように）。ただし**その試合が実際に行われている場合だけ**（未開催の試合へ伸ばすと勝ってもいないのに勝ち上がったように見える）。線の太さの規則は目視で気付きにくいので `lib/__tests__/bracketDrawing.test.ts` で固定している。**山シートのタブ名は「第N山」ではなくその山の entryNo の範囲**（例: 「1〜39」。読者は自分の応援する組の番号で山を探すため）。**ベスト64シートは `decided`（勝敗が決まった枠数）が0なら非表示・1以上なら初期表示**（山シートと重複するため、結果が無いうちは出す意味が無い）。**復元できない大会は従来描画にフォールバックする**（2026-07-31 時点で229大会が新描画・87大会が従来描画。内訳は予選リーグ81＝構造的に対象外、entryNoが連番でない6）。`type` が未入力・入力ミスだった19大会は `node scripts/backfill-entry-type.mjs --apply` で `matches` から逆算して埋めた（逆算結果を信じず、全knockout試合が正しいラウンドに配置されるか検算してから書き込む）（`nextMatchId` があれば従来の `buildBracket()`、無ければ席順復元の二段構え。`type` の逆算によるデータ一本化はしない）。モバイルの初期表示は第1山でよい（エントリー番号があるので自分の山を引き算で探せる）。`splitBracketSheets()` として実装済みで、モックは `npm run bracket:preview`。**`TournamentBracket.tsx` の差し替えまで実装済みで、`npm run build` も2026-08-07に確認済み。残タスクなし**。**2026-08-22: 予選リーグ→決勝T形式の大会（90ファイル）も新描画の対象になった**。この形式では決勝Tの席は**エントリーではなく予選リーグの組に属する**ため `entries[].type` では表せず（`entryNo` 順に積むと 90 大会中 17 大会が誤ったブラケットになる）、席順を `knockoutDraw`（(組, 組内順位) の並び）として details JSON に持たせた（[ADR-015](../adr/ADR-015-knockout-draw-by-group.md)）。**復元適用 285 → 372 大会・突合 26,527 → 27,633 試合で不一致0件**。生成は `npm run bracket:draw -- --apply`（`matches` から起こし、検算を通ったものだけ書き込む）。入力ツールも保存時に `knockoutDraw` を出力する（手順の実体は `tools/shared/knockout-draw.js` を共有）。決勝が1試合だけの大会（リーグ→リーグ→優勝決定戦）はブラケットが無いので対象外。開催前でも「A組1位 vs D組2位」として表を出せる土台になったが、未確定席の見せ方は未設計で現状は空席として描かれる | [アイデア](../raw/2026-07-26-idea-bracket-redesign.md) |

## Open Questions

- 本番で 2 ドメインをどうデプロイ/管理しているか
- `score` 側のヘッダー/フッター差し替え方針
- OGP 文言・サイト名の正式運用ルール
- 高校カテゴリの注目校表示ロジックを将来的に手動編集可能にするか
