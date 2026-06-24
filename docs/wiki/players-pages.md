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
