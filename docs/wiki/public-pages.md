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

高校カテゴリページ:

- `/highschool/[gender]`
- `/highschool/[gender]/[prefectureId]`
- `/highschool/[gender]/[prefectureId]/[teamId]`

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
- 実際に詳細データがある年度・種別のみをチップでリンク化し、年度降順で表示する。種別ラベルは `information/{tournamentId}.json` の `categories[].label` から解決する
- 各詳細 JSON から優勝ペア（`results[].tournament.rank.kind === 'winner'` のエントリーの選手名・所属）を抽出し、「歴代優勝者」表を表示する
- 構造化データは `CollectionPage` / `ItemList`（歴代優勝者）/ `BreadcrumbList` を出力する
- 大会一覧カード（`TournamentCard`）と年度別結果ページのパンくずからハブページへ内部リンクする
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
- 高校の学校ページでも掲載選手名を同様にリンクする（pid「姓_名_チーム_県」を `data/players/index.json` と姓名一致で解決）
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
