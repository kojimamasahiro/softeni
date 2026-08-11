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
| 成年（社会人・一般）カテゴリの都道府県ページ・強豪チームランキング | **発散フェーズ（2026-08-11、データ深度の再検証で評価修正）**。高校型（都道府県ページ＋チーム個別ページ）のフル横展開は**データ不足で非推奨**と判明: 成年1,167チームの試合数は中央値4試合、57.3%が5試合未満（`/teams/[teamId]`のnoindex閾値未満）、`team-name-mappings.json`でのカバーも5%のみ。当初「最有力」としたのはチーム数・都道府県カバー率だけを見た誤読で、試合数分布を見ると薄いページ量産のリスクが高い。上位12%程度（15試合以上、約142チーム）に絞った`/highschool/rankings`型の一覧ページなら見込みがあるが未検討。今回はSTリーグ出場チームの「メンバー」節・選手名リンクのみ先行実装（`st-league.md`参照） | [アイデア](../raw/2026-08-11-idea-general-category-prefecture-pages.md) |
| トーナメント表の作り直し | **実装済み・ビルド確認済み**（2026-07-31実装、2026-08-07 `npm run build` 実機確認・問題なし）。`TournamentBracket` は `describeBracketLayout` が成功すれば新描画 `BracketSheets`、失敗すれば従来描画にフォールバックする（`nextMatchId` の有無では分岐しない）。モジュールは `lib/bracketLayout.ts`（純粋関数）／`lib/bracketLayout.server.ts`（`fs` を使うので分離）／`lib/bracketDrawing.ts`（座標計算。SVG文字列ではなく配列を返しモックとReactで共有）／`src/components/Tournament/BracketSheets.tsx`。**`lib/bracketLayout.ts` は `tournamentRecords` から型だけを import すること**（`fs` が値で入るとクライアントバンドルが壊れる）。以下は設計の経緯。本命 A は**結果が未入力でもブラケットの全ラウンドと接続線が描かれていて、勝ち上がりを目で辿れる**こと。**勝者を選ぶインタラクションではないので状態管理は不要**（ユーザー確定。SSG のまま完結する）。あわせて大規模ドローの分割表示（B）と左右対称レイアウト（C）を検討したいが、これらは A と同じツリーへの別の見せ方に還元される。現行 `TournamentBracket.tsx` は `matches` のツリー（`nextMatchId`）前提のため**開催前は成立せず**（IH2026は`nextMatchId`が0件で60本の独立ツリーになる）、シード・足長も表示されない。復元は `lib/bracketLayout.ts`（前哨戦用に先行して切り出し済み）にあり、**全データ検証で209大会・20,571試合が一致／不一致0件**（`npm run bracket:verify`）。検証の副産物として不具合を2件修正: **(1) `type` の入力ミスで席がずれた10大会が誤ったラウンドを表示していた**（検出したら復元を諦める＋`bracket-slot-parity` ルール追加）、**(2) bye無しの2冪ドロー36大会を「シード未入力」と誤判定して取りこぼしていた**。復元できない残りは予選リーグ81（構造的に対象外）・`type` null の完了済み15（逆算可能・未実施）・席ずれ10。**描画用ツリー `buildBracketTree` は実装・検証済み**（209大会・20,571試合が正しいラウンドに配置、欠落0。`npm run bracket:verify:tree`）。IH2026（結果未入力）で512枠・9ラウンドがすべて揃うことを確認。**B・C の基準も確定**（2026-07-31）: **1枚64枠**（＝ベスト64が1枚に収まる）で、山シートは各山の代表が決まるまでの6ラウンド、それとは別に**ベスト64シート**を持つ（4〜6回戦が重複するのは承知の上）。各枚は**左右から中央へ収束**し、拡大縮小できること。512枠は9枚、64組以下の大会（210中124）は1枚で完結。描き方は**紙のドロー表と同じく選手名を左右の両端にだけ置き、内側は線だけで繋ぐ**（勝ち上がった選手を各ラウンドに書き直さない。勝者は線の濃さで示し、**縦線も勝者側の半分を太く**して横→縦→横が1本に繋がるようにする）。これにより64枠が**602×682px**に収まる。線を引くかどうかは `BracketNode.present`（その山にエントリーが居るか）で判断すること。`entries`（確定した entryNo）で判断すると**結果未入力の大会で線が消える**。不戦勝の枠は縦線を引かず、その選手の高さのまま次ラウンドへ通す（中点に寄せるとシードの線が折れる）。また**不戦勝で通した区間は、その先で勝った時点に遡って太くする**（シード・足長の太線が選手名の根本から始まるようにするため。引いた直後には太さが決まらないので、線は配列に貯めて後からまとめて出力する）。**ラウンド名の見出しは出さない**（列幅に対して長すぎて隣と重なる。紙のドロー表にも無い）。**エントリー番号は名前のさらに外側**、**スコアは上下それぞれの獲得ゲーム数をその側の横線の上に1つずつ**置く（`4-2` と1つにまとめると常に勝者が左に来てどちらの組の点か読めないため。勝者は濃く太字、敗者は薄く、棄権は敗者側に「R」）。**決勝だけは左右が同じ高さの1本になるので中央の左右に振り分ける**。**決勝の横線は両側とも中央まで引くが、太いのは勝った側だけ**（他のラウンドと違い左右が同じ高さでぶつかるため、両方太くすると1本の長い太線になりどちらが勝ったか読めない。負けた側は細い線で決勝まで来たことを示す）。**負けた枠へ向かう区間も太くする**（太線は「どこまで到達したか」を示すので、勝ち上がった先で負けた線が前の枠の中点で途切れて宙に浮かないように）。ただし**その試合が実際に行われている場合だけ**（未開催の試合へ伸ばすと勝ってもいないのに勝ち上がったように見える）。線の太さの規則は目視で気付きにくいので `lib/__tests__/bracketDrawing.test.ts` で固定している。**山シートのタブ名は「第N山」ではなくその山の entryNo の範囲**（例: 「1〜39」。読者は自分の応援する組の番号で山を探すため）。**ベスト64シートは `decided`（勝敗が決まった枠数）が0なら非表示・1以上なら初期表示**（山シートと重複するため、結果が無いうちは出す意味が無い）。**復元できない大会は従来描画にフォールバックする**（2026-07-31 時点で229大会が新描画・87大会が従来描画。内訳は予選リーグ81＝構造的に対象外、entryNoが連番でない6）。`type` が未入力・入力ミスだった19大会は `node scripts/backfill-entry-type.mjs --apply` で `matches` から逆算して埋めた（逆算結果を信じず、全knockout試合が正しいラウンドに配置されるか検算してから書き込む）（`nextMatchId` があれば従来の `buildBracket()`、無ければ席順復元の二段構え。`type` の逆算によるデータ一本化はしない）。モバイルの初期表示は第1山でよい（エントリー番号があるので自分の山を引き算で探せる）。`splitBracketSheets()` として実装済みで、モックは `npm run bracket:preview`。**`TournamentBracket.tsx` の差し替えまで実装済みで、`npm run build` も2026-08-07に確認済み。残タスクなし** | [アイデア](../raw/2026-07-26-idea-bracket-redesign.md) |

## Open Questions

- 本番で 2 ドメインをどうデプロイ/管理しているか
- `score` 側のヘッダー/フッター差し替え方針
- OGP 文言・サイト名の正式運用ルール
- 高校カテゴリの注目校表示ロジックを将来的に手動編集可能にするか
