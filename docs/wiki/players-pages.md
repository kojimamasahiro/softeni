# Players Pages（選手ページ）

選手まわりの公開ページ（URL 2 系統・選手一覧・選手 SEO・結果ページの noindex 選別）の現状仕様。
公開面全体の構成・サイトモード切替・共通レイアウトは [public-pages.md](./public-pages.md) を参照。
SEO カニバリ整理は [seo.md](./seo.md)（#1 / #2）。データ構造は [data-model.md](./data-model.md)。

## 選手 URL の 2 系統：`/players/{slug}` と `/players/{id}/results`（区別・重要）

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

## 選手一覧ページ（`/players`）の検索対象（2026-06 変更）

- 検索対象は収録されている全選手（`count>=2`）。`count<5` の選手結果ページを持たない選手も検索でヒットする（リンクは付かず名前のみ表示）。
- 以前は「最小出場回数 2/10/20」ドロップダウンでビルド都合上 `count>=20`（`players-min20.json`）を既定表示していたが、UX 改善のため撤去した。
- データ構成（`scripts/generate-players-json.mjs` が生成）:
  - `players-min20.json`: SSR の初期表示用（クエリ無し時）。出場回数の多い 73 組をフル大会記録つきで保持。軽量で初期 HTML に埋め込む。
  - `players-search.json`: 検索用の軽量インデックス（全 8,174 組、約 2.7MB）。各組は `fullName / playerId / count / differentTeams / searchText`（名前・所属・大会名・年度を小文字結合した照合用テキスト）のみを持ち、選手ごとのフル大会記録配列は持たない。詳細は選手結果ページで見せる。
  - 旧 `players-min2.json`（約 19MB）/ `players-min10.json` は廃止。
- 動作: マウント時に `players-search.json` をプリフェッチ。検索クエリが入力されると全選手を `searchText` の AND 一致で絞り込み、結果は名前・所属・出場回数＋（`count>=5` なら）`/players/{id}/results/` へのリンクを表示する。クエリ無しのときは SSR の `players-min20.json` をフル表示。
- SEO: 検索はクライアント JS のみでクローラは実行しないため、検索インデックスの軽量化はインデックスに影響しない。選手ページの発見は従来どおり `next-sitemap`（`count>=5` を全件出力）が担保する。一覧の SSR 内部リンクは `min20`（73 組）のまま据え置き。
- 実装: `src/pages/players/index.tsx`。

## 結果ページの大会ごとの所属表示（2026-06 追加）

選手の所属は大会（年度・カテゴリ）ごとに異なりうるため、結果ページ（`/players/{id}/results/`）の各大会カードには **その大会当時の所属** を表示する。

- データ取得: `src/pages/players/[id]/results.tsx` の `getStaticProps` で、各大会レコードの該当選手 participant の `team` を `tournamentSelfTeam`（キー `tournamentId/year/category`）に保持し、`PlayerTournament.team` として渡す。
- ヘッダ（`{fullName} 選手の試合結果（{team}）`）や JSON-LD の `affiliation` は従来どおり **最新の所属**（`teamRecords` の最終年）を使う。大会ごとの所属はカード単位の表示のみ。
- 表示: `src/components/PlayerResults.tsx` の各大会カードで「ペア」の下（ペアが無い場合は「詳細」の下）に「所属 {team}」を表示（`info.team` がある時のみ）。

## 結果ページを持たない選手（count<5）の情報表示（2026-06 追加）

結果ページが実在するのは `count>=5` の選手のみ（`getStaticPaths`）。`count<5`（約 6,400 人）はページ化すると薄いページの量産になり SEO 上不利なので**個別ページは作らない**。一方で「どの大会に・誰と出たか」だけはユーザーに見せたいため、**固有 URL を持たないクライアントモーダル**で表示する。

- 非インデックスの担保: 固有 URL を持たず、クリック時に JSON を fetch して JS で描画するだけ。クローラは JS を実行せず URL も無いので**インデックス対象にならない**。`noindex` ページを量産する案（クロールバジェットを消費する）より優れる。
- データ生成: `scripts/generate-players-lite.mjs`（`prebuild` に追加）が `count<5` の各選手について `public/data/players-lite/{id}.json` を出力する（1 選手 1 ファイル）。中身は出場大会ごとの `tournamentName / year / team（当時の所属）/ partner{ name, id, hasPage }`。`id` は「同姓同名は最初の id」規約に合わせた canonical id。
- 表示: `src/components/PlayerLiteLink.tsx`。名前クリックでモーダルを開き当該 JSON を fetch（簡易キャッシュあり）。モーダル内のペアは `hasPage`（count>=5）なら `/players/{id}/results` へリンク、`count<5` は入れ子モーダルにせず名前のみ表示。
- 起点: ①結果ページの大会カードの「ペア」（`PlayerResults.tsx`、`PlayerTournament.partnerLiteId`）、②サマリーの「パートナー別」表（`PlayerSummaryStats.tsx`、`liteId`）。いずれも `count>=5` はページリンク、`count<5` は `PlayerLiteLink` に振り分ける。
- デッドリンク防止: 以前は `count<5` のペアにも `/players/{id}/results` を張って 404 になっていた。リンク可否は `data/players/index.json` の `count`（`PlayerInfo.count` として伝播）で判定する。

## 選手ページの SEO 方針（2026-06 改善）

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

## 選手統計エンジン（Player Statistics Engine・実装済み P1–P6 / 2026-07-02）

選手ページを「国内で最も情報量の多い選手データベース」にするための集計機能群。
実行計画 [docs/raw/2026-07-01-player-statistics-engine-implementation-plan.md](../raw/2026-07-01-player-statistics-engine-implementation-plan.md)
の **P1〜P6 を実装済み**（P7 増分・性能・golden 全体突合は未了）。設計 2 本:
機能仕様 [docs/raw/2026-07-01-player-page-comprehensive-design.md](../raw/2026-07-01-player-page-comprehensive-design.md)、
集計エンジン [docs/raw/2026-07-01-player-statistics-engine.md](../raw/2026-07-01-player-statistics-engine.md)、
データ契約 [docs/raw/2026-07-01-player-statistics-engine-data-contract.md](../raw/2026-07-01-player-statistics-engine-data-contract.md)（実装はこれを正とする）。

### 実装状況（2026-07-02）

- **配置**: エンジンは `lib/playerStats/`。公開ファサードは `lib/playerStats/playerStatistics.ts`
  （`getPlayerStatistics(id, options)` → `PlayerStatistics`。`getAllPlayerIds` / `toPlayerMeta` / `toPlayerJsonLd` も）。
  公開型は `src/types/playerStatistics.ts`、内部型は `lib/playerStats/types.ts`。
- **層構造**: L0 `sourceAdapter.ts`（読込・スキーマ変種判定・大会メタ join）/ L1 `facts.ts`（`PlayerMatchFact`・`PlayerEntryFact`）/
  L2 `aggregators/*.ts`（純関数 fold）/ L3 `playerStatistics.ts`（オーケストレーション・プロセス内 memo）。
- **生成スクリプト**（TS・`ts-node`。`scripts/playerStats/`）: `generate-facts.ts`（逆引き `_index/by-player.json` ＋ `_facts/{id}.json`）/
  `generate-rankings.ts`（`data/rankings/{year}-{discipline}.json`・`--years` で増分）/ `generate-public-json.ts`（`public/data/player-stats/{id}.json`）。
  `prebuild` に連結済み。中間・成果物（`_facts`/`_agg`/`_index`/`rankings`/`public/data/player-stats`）は `.gitignore`。
- **既存資産の一本化（P6）**: `data/players/<slug>/analysis.json` は **エンジン Facts 由来で生成**（`lib/playerStats/legacyAnalysis.ts`）。
  旧 `scripts/generate-player-analysis.mjs` はこの生成器へ委譲する薄いラッパになり、独自の全大会スキャン集計は削除（二重ロジック解消）。
  外部 JSON 形は従来互換（curated 22 名で byte 一致を検証）。`careerRecord` の通算値はこの `analysis.json` を読むため transitively エンジン由来。
- **利用文脈の配線（P5・非破壊）**: SSR `players/[id]/results.tsx` の `getStaticProps` が `playerStatistics` を追加提供（既存表示は維持）。
  記事供給は `lib/playerStats/articleMaterial.ts`。SEO 日付は `coverage`（実データ）由来。
- **テスト**: `npm run playerstats:test`（config/placement/aggregators/ranking 単体）/ `playerstats:verify`（golden・facade）/
  `verify-analysis-migration.ts`（analysis byte 一致）。
- **未了（P7）**: contentHash による増分再生成 / 性能予算の実測 / golden 全体突合 / ADR 追加。

> Assumption: 現状 SSR は `playerStatistics` を props に渡すのみで描画は未接続（新セクション UI は今後）。既存の戦績表示は従来ロジックのまま。

対象機能（自動生成）: 歴代戦績 / 年度別成績 / 大会別成績 / ペア別勝敗 / 全国大会初出場 /
全国大会初優勝 / 連覇・○回目優勝 / 通算優勝数 / 主要大会優勝数 / 年度ランキング推移 / 対戦相手 H2H。
追加統計（2026-07-01）: 最長連勝 / 最高勝率（年度別・最小10試合）/ 苦手選手・得意選手（H2H 3対戦以上）/
最多対戦相手 / 最多ペア / 所属別成績 / 決勝・準決勝進出率（ノックアウト個人戦を分母）/ キャリア年表。
※「学年別成績」は確実な生年・入学年データが無いため**除外（実装しない）**。
※追加統計はいずれも既存 Facts への単一パス fold で導け、データ構造・計算量（1選手 O(m log m)）を変えない。

設計の核（単一プリミティブ方式）:

- 全機能は、選手 1 人ぶんの中間データ `PlayerMatchFact[]`（1 試合 1 件）と `PlayerEntryFact[]`（1 大会カテゴリ 1 件＝最終順位）へ、
  一度だけ前計算してから軽く畳み込む。個別機能ごとに `details/**` を走査し直さない。
- 生成は prebuild スクリプト（`scripts/generate-player-facts.mjs` 想定）→ `data/players/_facts/{id}.json`（中間）→
  純関数 fold で `data/players/_agg/{id}.json`（選手集計）。既存 `analysis.json` / `careerRecord` / `milestones` /
  `majorTitles` はこの facts 入力へ統合し、ロジック二重化を解消する。
- 年度ランキングのみ全選手横断のグローバル計算のため 2 段目 `scripts/generate-rankings.mjs` →
  `data/rankings/{year}-{discipline}.json` を経由し、各選手へ逆展開する。
- すべてビルド時前計算（本番 `output:'export'`）。ランタイム集計はしない。全 H2H・全ペア等の大量データは既存 lite 方式で遅延取得。

確定した集計ルール（2026-07-01）:

- **年区切り = 年度**。大会データの `year` が既に年度指定のため `year` をそのまま使う（日付からの再計算不要）。
- **全国大会 = `index.json` の大会のうち `generationId` が `international` / `international-qualifier` 以外**（国際大会・国際予選は含めない）。`isMajorTitle` は従来どおり 4 大全日本。
- **勝率・ゲーム率の算入**（データ実体に基づき改訂）: 不戦勝と途中棄権はデータ上 `retired:true` で区別できないため、`retired:true` は勝率・ゲーム率から全除外（実際に戦った試合ベース）、draw は勝率の分母から除外。ただし順位・進出率・出場回数・優勝判定など placement 側には反映する（retired の勝者は勝ち上がっているため）。
- **年度ランキング**: 決定的な「シーズンポイント制」を主指標とし、大会格 `tier` × 順位係数を **その年度の上位 3 大会のみ合算**（掲載範囲の偏り補正）＋ `scope-limited` 注記。tier・係数は `data/ranking-config.json` に外出し。副指標として Elo 系レーティングの時系列推移を将来追加可能。
- **対戦相手 H2H の既定軸 = 対個人**（相方問わず相手選手で名寄せ）。ペア対ペアは絞り込みオプション。
- 全集計は当サイト掲載大会分。`scope: 'site-covered'` と `scopeNote` を付し、「初」「通算」は `confidence: 'scope-limited'` を明示する。

データ実体確認済み（2026-07-01）: 不戦勝 / bye は独立表現を持たず `retired:true` で登録され途中棄権と判別不能（上記ルールに反映済み）。実装時に残る確認: `ranking-config.json` の tier・係数・閾値初期値の運用調整。[open-questions.md](./open-questions.md) 参照。
