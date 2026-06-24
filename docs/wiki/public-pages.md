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

高校カテゴリの公開ページ方針:

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

高校 全国大会の歴代記録ページ（`/highschool/tournaments`、`/highschool/tournaments/[tournament]`、2026-06 追加）:

- 都道府県別・学校別とは別軸で、代表的な全国大会そのものを起点に歴代の上位入賞を確認できる回遊ページ
- 対象大会はインターハイ（`highschool-championship`）とハイスクールジャパンカップ（`highschool-japan-cup`）。大会定義（スラッグ・正式名称・公式 URL・説明）は `lib/highschoolNationalTournaments.ts` の `HS_NATIONAL_TOURNAMENTS` に集約する
- `/highschool/tournaments` は 2 大会への入口一覧。`/highschool/tournaments/[tournament]` は大会別ページで、`tournament` スラッグは `championship` / `japan-cup`
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

地域大会結果ページ:

- `/tournaments/local`
- `/tournaments/local/[federationId]`

関連:

- [Tournaments Local](./tournaments-local.md)

`/tournaments` 一覧のモバイル表示:

- カードで大会状態を判別できるようにする
- `開催予定` はラベルを表示し、横に日付と開催地を並べる
- 結果未反映で外部リンク導線のみの大会は `外部掲載` を表示する
- 一覧構造や既存URLは変更しない

大会ハブページ（`/tournaments/[generation]/[tournamentId]`、2026-06 追加）:

- 年度を含まない「ソフトテニス 大会名 結果」検索クエリの受け皿となる、1大会の歴代結果まとめページ
- `getStaticPaths` は `data/tournaments/details/{tournamentId}` 配下の年度ディレクトリを走査して生成し、`generation` は `index.json` / `local_index.json` の `generationId` から解決する（不明時は `unknown`）
- SEO（カニバリ集中、2026-06）: 高校全国大会 ID（`getHsNationalSlugByTournamentId` が解決）に該当するハブは `noindex, follow` にし、検索面を `/highschool/tournaments/[tournament]` へ集中させる。該当時はページ上部に高校歴代ページへの誘導バナーを表示する。それ以外の大会のハブは従来どおり index 対象。詳細は [seo.md](./seo.md) #3
- 実際に詳細データがある年度・種別のみをチップでリンク化し、年度降順で表示する。種別ラベルは `information/{tournamentId}.json` の `categories[].label` から解決する
- 各詳細 JSON から優勝ペア（`results[].tournament.rank.kind === 'winner'` のエントリーの選手名・所属）を抽出し、「歴代優勝者」表を表示する
- 構造化データは `CollectionPage` / `ItemList`（歴代優勝者）/ `BreadcrumbList` を出力する
- 大会一覧カード（`TournamentCard`）と年度別結果ページのパンくずからハブページへ内部リンクする。トップページの「最近追加された大会」カードのリンク先もこのハブページ（年度なし）とする（2026-06 変更。以前はカテゴリ別の年度別結果ページへリンクしていた）
- 年度別結果ページ（`/tournaments/.../[gender]`）には `SportsEvent` 構造化データと冒頭の説明文を追加し、title / description を「結果・トーナメント表」を含む形に改善する
- 実装: `src/pages/tournaments/[generation]/[tournamentId]/index.tsx`、`src/components/tournaments/TournamentCard.tsx`

`score` mode:

- `/matches`
- `/matches/[matchId]`
- `/matches/growth`

### トップページ（`/`）の SEO 方針（2026-06 改善）

実装: `src/pages/index.tsx`

- **本文を静的 HTML に含める**: 以前は全コンテンツを `{!isClient ? null : ...}` でクライアントマウント後のみ描画しており、`output: 'export'` の静的 HTML に h1・紹介文・カードが一切出力されていなかった。`isClient` ゲートを撤去し、SSG 時に本文を出力する
  - ゲートの目的だった `toLocaleDateString('ja-JP')` のハイドレーション不一致は、`getStaticProps` で `YYYY-MM-DD` から決定的に整形した `displayDate`（`YYYY年M月D日`）を渡すことで解消する。クライアントでロケール依存整形を行わない
- **内部リンクをクローラ可能にする**: 大会・選手・STリーグ・高校・チームへの導線は `<div onClick={() => (window.location.href = ...)}>` だったためクローラがたどれなかった。`next/link` の `<Link>` に置き換え、ハブページとして内部リンクを流す
  - チームカードは外部「公式サイト」リンクを内包するため、`<a>` の入れ子を避けるストレッチドリンク方式（カード `relative` + 内部 `Link` に `after:absolute after:inset-0` + 外部 `<a>` を `relative` で前面）にする
- **見出し階層**: `h1`（1個）→ セクション `h2` → カード `h3` に統一する。以前はカード内に `h2` が混在していた
- **title / description**: ブランド名「Softeni Pick」と主要キーワード（ソフトテニス / 大会結果 / 選手成績 / 全国大会 / 全日本選手権 / インターハイ）を含めて一意化する
- **構造化データ（JSON-LD）**: `Organization` / `WebSite` / `BreadcrumbList` / `ItemList`（最近追加された大会）を出力する。`WebPage` の `dateModified: new Date()`（ビルド日）は規約どおり撤去した（ビルド日は使わない）

### canonical / OGP / サイト名

`siteConfig.baseUrl`, `siteConfig.siteName`, `siteConfig.ogImage` を通して切り替える実装です。

確認根拠:

- `lib/siteConfig.ts`
- `src/components/MetaHead.tsx`

### 選手 URL の 2 系統：`/players/{slug}` と `/players/{id}/results`（区別・重要）

選手まわりには **別系統の 2 種類の URL / 識別子** があり、混同しやすいので明確に区別する。

| 観点 | プロフィール系（slug） | 結果ページ系（id） |
| --- | --- | --- |
| URL | `/players/{slug}/`（＋ `/players/{slug}/information`） | `/players/{id}/results/` |
| 識別子 | **slug**（文字列。例 `funemizu-hayato`） | **数値 id**（例 `29`） |
| 正データ | `data/players/{slug}/`（`information.json` ＋ `analysis.json`） | `data/players/index.json`（全選手の `id` / 姓名 / `count`） |
| 対象範囲 | **curated のみ**（約 23 選手。手動整備したプロフィール） | **掲載選手全体**（結果ページが実在するのは `count>=5`、約 8,000 組） |
| 主な中身 | プロフィール（身長・所属・ポジション）＋通算成績＋career-record/milestone | 収録試合の結果一覧・対戦相手・主なペア |
| 実装 | `src/pages/players/[id]/index.tsx`（`[id]` には slug が入る）、`lib/careerRecord.ts` | `src/pages/players/[id]/results.tsx`、`data/players/index.json` |
| 名前からの解決 | `resolveSlugByFullName()`（`lib/careerRecord.ts`）。姓名**完全一致かつ一意**のときのみ slug を返す（曖昧なら null） | `data/players/index.json` を姓名一致（`lastName::firstName`、`count>=5`）。**同姓同名は最初の id**（学校ページ・高校歴代・チーム年度・news プレビュー共通の既存規約） |
| リンク付与条件 | curated 選手のみ（解決できた時だけ） | 結果ページが実在する選手（`count>=5`）のみ。無ければ名前のみ表示（デッドリンク防止） |

使い分けの原則:

- **選手名から「その選手の成績ページ」へ内部リンクしたい一般用途**は、原則 **id 系（`/players/{id}/results/`）** を使う。curated でない選手にも付くため網羅性が高い（学校ページ・高校歴代ページ・チーム年度ページ・/news プレビューはすべてこの方式）。
- **slug 系（`/players/{slug}`）** は curated プロフィールに限定。career-record/milestone など「手動整備済みの濃い情報」を出す場面でのみ使う（大会ハブの curated 優勝者など）。
- 結果ページ（id）→ プロフィール（slug）への**逆リンク**は、姓名一致で curated プロフィールがある時のみ表示する（`results.tsx`）。
- 2 系統の **URL 統合は当面しない**方針（2026-06 決定。カニバリ対象は curated 約 23 選手のみとスコープが小さく、統合は 301・移植の毀損リスクが上回るため）。

注意（Assumption）: `data/players/index.json` には所属（team）が無いため id 解決は**姓名のみ**で行い、同姓同名は最初の id に寄せる。所属で曖昧性を解消したい照合（連覇判定など）は別途 `tournamentRecords` の `playerKey`（名前@所属）を使う。

### 選手一覧ページ（`/players`）の検索対象（2026-06 変更）

- 検索対象は収録されている全選手（`count>=2`）。`count<5` の選手結果ページを持たない選手も検索でヒットする（リンクは付かず名前のみ表示）。
- 以前は「最小出場回数 2/10/20」ドロップダウンでビルド都合上 `count>=20`（`players-min20.json`）を既定表示していたが、UX 改善のため撤去した。
- データ構成（`scripts/generate-players-json.mjs` が生成）:
  - `players-min20.json`: SSR の初期表示用（クエリ無し時）。出場回数の多い 73 組をフル大会記録つきで保持。軽量で初期 HTML に埋め込む。
  - `players-search.json`: 検索用の軽量インデックス（全 8,174 組、約 2.7MB）。各組は `fullName / playerId / count / differentTeams / searchText`（名前・所属・大会名・年度を小文字結合した照合用テキスト）のみを持ち、選手ごとのフル大会記録配列は持たない。詳細は選手結果ページで見せる。
  - 旧 `players-min2.json`（約 19MB）/ `players-min10.json` は廃止。
- 動作: マウント時に `players-search.json` をプリフェッチ。検索クエリが入力されると全選手を `searchText` の AND 一致で絞り込み、結果は名前・所属・出場回数＋（`count>=5` なら）`/players/{id}/results/` へのリンクを表示する。クエリ無しのときは SSR の `players-min20.json` をフル表示。
- SEO: 検索はクライアント JS のみでクローラは実行しないため、検索インデックスの軽量化はインデックスに影響しない。選手ページの発見は従来どおり `next-sitemap`（`count>=5` を全件出力）が担保する。一覧の SSR 内部リンクは `min20`（73 組）のまま据え置き。
- 実装: `src/pages/players/index.tsx`。

### 選手ページの SEO 方針（2026-06 改善）

設計の経緯は `docs/raw/2026-06-12-player-page-seo-design.md` を参照。

内部リンク:

- 大会結果ページ（対戦詳細）のエントリー見出しで、選手ページを持つ選手（`count>=5`）の名前を `/players/{id}/results/` にリンクする（`MatchResults.tsx`）
- トーナメント表（`TournamentBracket.tsx`）の選手名も同様にリンクする。`participant.playerId`（結果ページを持つ選手のみ数値が入る）かつ個人戦（`lastName` あり）の場合だけ `/players/{id}/results/` へリンクし、それ以外は文字のみ表示（2026-06 追加）
- 高校の学校ページでも掲載選手名を同様にリンクする（pid「姓*名*チーム\_県」を `data/players/index.json` と姓名一致で解決）
- チームの年度別ページ（`/teams/{teamId}/{year}/{gender}`）の「選手別成績」表でも選手名をリンクする。`getStaticProps` で `info.players` の姓名を `index.json`（`count>=5`）と一致させて pid→数値id の `playerLinks` を作り、`TeamsRanking` に渡す。同姓同名は最初のIDを使う既存規約に準拠（`src/components/TeamsRanking.tsx`、2026-06 追加）
- 選手結果ページに「関連選手（主なペア）」セクションを表示する。`playerStats.byPartner` をペア試合数の降順で上位 8 名まで掲載し、結果ページを持つ選手（`index.json` の `count>=5`）のみ `/players/{id}/results/` へリンクする。選手ページ同士の双方向内部リンクを増やす目的（`src/pages/players/[id]/results.tsx`、2026-06 追加）
- 同姓同名は「最初の ID を使う」既存規約に従う
- numeric 結果ページから curated プロフィール（`/players/{slug}/`）への逆リンクを表示する（姓名一致で解決）
- 選手結果ページの大会ごとの「詳細 大会ページ」リンクは、公式サイト（`sourceUrl`）ではなくサイト内大会ページ `/tournaments/{generation}/{tournamentId}/{year}/{gameCategory}/{ageCategory}/{gender}/` に内部リンクする（詳細ファイル名を右側から gender / ageCategory / gameCategory に分解して組み立てる。2026-06 変更）
- プロフィール（`/players/{slug}/`）と結果ページ（`/players/{id}/results/`）の URL 統合は当面しない方針（2026-06 決定）。カニバリ対象は curated 23 選手のみとスコープが小さく、統合は 301・コンテンツ移植を伴い毀損リスクがあるため、条件付き先送りとする。GSC でカニバリが無視できない損失を出していると確認できた場合のみ着手する。なお本番は `output: 'export'`（静的書き出し）のため、統合時の 301 はホスト側（Cloudflare `public/_redirects`）で張る必要がある。統合方向（どちらを canonical にするか）は実績の厚い側へ寄せる前提で未確定（Assumption）

メタ・構造化データ:

- 選手結果ページの JSON-LD は `ProfilePage` + `mainEntity: Person`。`dateCreated` / `dateModified` は実データ（初出/最新出場大会の日付）由来とし、ビルド日は使わない
  - `dateCreated` / `dateModified` は ISO 8601 の**日時（タイムゾーン付き）**で出力する（例 `2024-07-28T00:00:00+09:00`）。Google ProfilePage は日付のみだと「日時値が無効」と判定するため、データ上の `YYYY-MM-DD` に JST オフセット `T00:00:00+09:00` を付与する（2026-06 修正）
  - ProfilePage では `mainEntityOfPage` を出力しない（Google が認識せず「項目を認識できません」になる）。エンティティ指定は `mainEntity` を使う（2026-06 修正）
- 大会結果ページの `datePublished` / `dateModified` も大会開催日由来
- canonical は必ず実 URL（trailingSlash あり）に一致させる。プロフィールの `/information` canonical は不具合だったため修正済み
- title / description には所属チーム・直近成績・通算成績を埋め込み、ページごとに一意化する
- curated プロフィールには FAQ（身長・所属・ポジション）を可視コンテンツ + FAQPage 構造化データで掲載する

選手結果ページの noindex 選別（2026-06 追加）:

- 背景: GSC の「クロール済み - インデックス未登録」が選手結果ページ（約 1,800 件）でほぼ全件発生していた。調査の結果、内部リンク（全ページ被リンク 3 本以上・トップから 2〜4 クリック）・クロール深度・canonical / robots・重複度はいずれも問題なく、原因は **本文の薄さ + ドメイン評価（インデックス枠）** と判断した。リンク追加は頭打ちのため、薄いページを noindex してインデックス枠を厚いページ・全国高校大会出場選手に集中させる方針を採る。
- 判定（`src/pages/players/[id]/results.tsx` の `getStaticProps`）: **収録試合数 `totalMatches >= 15`** または **全国高校大会出場歴あり**（`playerMatches` のいずれかの大会の `generationId === 'highschool'`）なら index 対象。どちらも満たさなければ `noindex` にする。全国高校大会出場選手（有名校の主力を含む）は試合数に関わらず常に index 対象とし、「検索対象になってほしい有名校ページ」を保護する。閾値定数は `PLAYER_INDEX_MIN_MATCHES`。
- robots: noindex 時は `noindex, follow`（`MetaHead` の `noindexFollow`）。薄いページからの内部リンク（関連選手・大会ページ）で残すページへ評価を流すため、`nofollow` にはしない。
- 自動復帰: 判定はビルド時のデータ由来のため、試合データが増えて `totalMatches` が閾値を超える、または全国高校大会に出場すると、**次回ビルドで自動的に index 対象へ戻る**（手動の解除は不要）。逆に閾値・基準を変えたい場合は `PLAYER_INDEX_MIN_MATCHES` か判定式の 1 箇所だけ変更すればよい。
- sitemap 連動: `next-sitemap`（`output: 'export'`）は `out/**/*.html` を一括列挙するだけで robots meta を見ないため、noindex ページも sitemap に載る。これを防ぐため postbuild に `scripts/filter-noindex-from-sitemap.mjs` を追加し、生成 HTML の `robots` meta が noindex のページの canonical を sitemap から除去する。判定はページ側 1 箇所に集約し、sitemap は生成物から派生させる（ロジック二重化なし）。postbuild 順: `next-sitemap` → `sort-sitemaps` → `filter-noindex-from-sitemap`。

### 試合詳細ページの SEO 方針（2026-06 改善）

対象は `src/pages/beta/matches-results/[matchId]/index.tsx`（実装本体）と、掲載大会配下のネスト URL（`/tournaments/.../matches/[matchId]`）。両者は同じ `PublicMatchDetailPage` を共有するため SEO も共通。

メタ:

- title / description は試合ごとに一意化する。`{チームA} vs {チームB}｜{大会名}{ラウンド} 試合詳細・スコア` を基本形とし、description にはゲームカウント・勝者・総ポイント数・分析観点を埋め込む
- canonical は `getPublicMatchDetailPath(match)` に末尾スラッシュを付けた実 URL（`trailingSlash: true` に一致）。siteLink 有無で本ネスト URL か一覧配下 URL かが切り替わる

構造化データ（JSON-LD、別 `<Head>` で出力）:

- `SportsEvent`：`sport: ソフトテニス` / `competitor`（両チーム）/ `startDate`（`match_date` 優先、なければ `created_at`。ビルド日は使わない）/ `superEvent`（掲載大会ページがある場合の大会）/ `location`（`court_name` がある場合）
- `BreadcrumbList`：ホーム → 試合一覧 → （大会）→ 試合

可視パンくず:

- `src/components/Breadcrumb.tsx` を使い、JSON-LD の `BreadcrumbList` と同じ階層・順序で画面上にも表示する（このページは `PageLayout` 対象外のため個別に配置）。大会階層は掲載大会ページがある場合のみ挿入する

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

## Open Questions

- 本番で 2 ドメインをどうデプロイ/管理しているか
- `score` 側のヘッダー/フッター差し替え方針
- OGP 文言・サイト名の正式運用ルール
- 高校カテゴリの注目校表示ロジックを将来的に手動編集可能にするか
