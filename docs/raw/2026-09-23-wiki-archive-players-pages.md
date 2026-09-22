# wiki アーカイブ: players-pages.md（2026-09-23 圧縮前の全文）

2026-09-23 に [docs/wiki/players-pages.md](../wiki/players-pages.md) が1ページの目安（12,000字）を超えたため、
[docs/prompts/slim-wiki-page.md](../prompts/slim-wiki-page.md) の手順で現在の仕様だけへ圧縮した。
以下は圧縮前の全文をそのまま写したもの（リンクは `../wiki/` 基準に置き換え）。
作業ノートは [2026-09-23-docs-raw-growth-and-wiki-slim.md](./2026-09-23-docs-raw-growth-and-wiki-slim.md)。

---

# Players Pages（選手ページ）

> **適用範囲: 混在**。URL の2系統・薄いページの noindex 選別・集計エンジンの層構造は汎用。
> 大会名・種目・勲章カードのカテゴリはソフトテニス固有。
> **2026-09-18 に現在の仕様だけへ圧縮した。** 実測値・改修の前後比較・UI 実装の経緯は
> [raw/2026-09-18-wiki-archive-players-pages.md](../raw/2026-09-18-wiki-archive-players-pages.md)。

選手まわりの公開ページの現状仕様。公開面全体は [public-pages.md](../wiki/public-pages.md)、
SEO カニバリは [seo.md](../wiki/seo.md)（#1 / #2）、データ構造は [data-model.md](../wiki/data-model.md)。

## 選手 URL の2系統（混同しやすい・重要）

| 観点 | プロフィール系（slug） | 結果ページ系（id） |
|---|---|---|
| URL | `/players/{slug}/`（＋ `/information`） | `/players/{id}/results/` |
| 識別子 | **slug**（例 `funemizu-hayato`） | **数値 id**（例 `29`） |
| 正データ | `data/players/{slug}/`（`information.json` ＋ `analysis.json`） | `data/players/index.json` |
| 対象 | **curated のみ**（約23選手） | **掲載選手全体**（ページが実在するのは `count>=5`） |
| 実装 | `src/pages/players/[id]/index.tsx`（`[id]` に slug が入る） | `src/pages/players/[id]/results.tsx` |
| 名前からの解決 | `resolveSlugByFullName()`。姓名**完全一致かつ一意**のときだけ | `index.json` を姓名一致（`count>=5`）。**同姓同名は最初の id** |

- **選手名から成績ページへリンクする一般用途は id 系**を使う（curated でない選手にも付く）。
  slug 系は curated プロフィールに限る。結果ページ → プロフィールの逆リンクは姓名一致で解決できたときだけ。
- **URL 統合は当面しない**（カニバリ対象が curated 約23選手と小さく、301・移植の毀損リスクが上回る）。
  統合するなら `output: 'export'` なので 301 は Cloudflare の `public/_redirects` で張る。
- id 解決は**姓名のみ**（`index.json` に所属が無いため）。所属で曖昧性を解きたい照合（連覇判定など）は
  `tournamentRecords` の `playerKey`（名前@所属）を使う。
- **姓名の切り位置がぶれると同一人物が別 id になり、両方が `count>=5` を割って結果ページが消える**
  （`谷|明日里` / `谷明|日里`）。検出・運用は [team-player-identity.md](../wiki/team-player-identity.md)「姓名の分割ゆれ」。

## 選手一覧ページ（`/players`）

**役割は「選手を探す入口」**。かつて「同姓同名選手の一覧」を名乗っていたが、それは実装の誤解だった
（`count` は同名人数ではなく出場カテゴリ数、`differentTeams` は同名別人ではなくキャリア変遷）。
警告ボックスごと撤去済み。

構成は ①検索（全収録約9,400組。インデックスは **focus / 入力時に遅延ロード**）→ ②出場数の多い選手（上位200人の表）
→ ③**結果ページが実在する全選手への名前リンク**（内部リンクのハブ）。

- データは `scripts/generate-players-json.mjs` が生成。`players-index.json`（SSR 用。`featured` と
  `all`）と `players-search.json`（検索用。`fullName / playerId / count / team / teamCount / searchText`）。
  **`all` は結果ページの `getStaticPaths` と同じ集合を正にするので、デッドリンクが構造的に発生しない。**
- **`players-min20.json` / `players-min2.json` / `players-min10.json` は廃止**。全大会記録を SSR に埋め込んで
  HTML が肥大していたうえ、中身は選手結果ページと完全重複でカニバリ側だった。
- **姓の頭文字での分割ページ（`/players/あ` 等）は作らない**。頭文字は342種あり243種が5件未満で薄いページの量産になる。
  全件リンクは1ページに収める。
- 所属は**最新1件＋「他 N」**表示（表記ゆれを並べない。正規化は名寄せ側の課題）。
- JSON-LD は `CollectionPage` + `ItemList`（上位50件）。**実データ由来の日付を持たないので日付は出さない**
  （旧実装はビルド日を入れており毎ビルド動いていた）。`MetaHead` の `type` は `website`。
  `WebSite` + `SearchAction`（`urlTemplate: /players/?q={search_term_string}`）を持つ。
- 検索語は `?q=` に反映（shallow・400msデバウンス）。canonical は常に `/players/` なので正規化される。
- UX: 絞り込みは `useDeferredValue` で遅延、結果は50件ずつ段階表示、ハイライトは**全語**対象、
  件数に `aria-live="polite"`。**0件時に「選手名は漢字で登録されています」と明示する**
  （読み仮名データが無くかな検索は実装できない）。
- 見送り: 一覧カードへの全国大会優勝バッジ（`playerstats:public` が prebuild に無く、ビルドが約40秒増える）、
  都道府県によるブラウズ軸（元データに `prefecture` が無い）。

## 結果ページの表示仕様

- **大会ごとの所属**: 各大会カードにはその大会当時の所属を出す（`tournamentSelfTeam` → `PlayerTournament.team`）。
  ヘッダと JSON-LD の `affiliation` は**最新の所属**（`teamRecords` の最終年）。
- **主要タイトル表**（`MajorTitles.tsx` / 生成 `lib/majorTitles.ts`）は `isMajorTitle` の大会×年のマトリクス。
  列（年）は `information` 由来の年も含む（開催前の年に開催日を出すため）。**列は 2022 年以降だけ**
  （`MAJOR_TITLE_START_YEAR`。主要4大会がそろう最初の年で、それ以前は同じ `ー` が3つの別の意味になる）。
  **表の直下に「※ 2022年以降を表示しています。」の断りを必ず添える**（上部の「全国大会優勝N回」は
  2021年以前も数えており、断りが無いと食い違って見える）。

  | セル | 意味 |
  |---|---|
  | `優勝` / `ベスト4` など | その年のその大会での成績 |
  | `ー` | その選手が出場していない（または記録が無い） |
  | `中止` | 大会自体が開催されなかった年（`information` の `status: 'cancelled'`） |
  | `11/6` のような日付 | まだ開催前（`startDate` が未来） |

- **結果ページを持たない選手（`count<5`）は固有 URL を持たないクライアントモーダルで見せる**
  （`PlayerLiteLink.tsx`）。ページ化は薄いページの量産になるが「どの大会に誰と出たか」は見せたいため。
  URL が無くクローラも JS を実行しないのでインデックス対象にならない（`noindex` を量産するより優れる）。
  データは `scripts/generate-players-lite.mjs`（prebuild）が `public/data/players-lite/{id}.json` に出す。
  **リンク可否は `index.json` の `count` で判定する**（以前 `count<5` にリンクを張って404になっていた）。
- **パートナー名はエンジンが解決した `PlayerStats.byPartner[id].name` を先に使う**（部分集合だけに依存すると
  数値 ID がそのまま表示される）。

## SEO 方針

内部リンク（選手名 → `/players/{id}/results/`）を張る面: 大会結果ページの対戦詳細・トーナメント表 /
団体戦の対戦ごとの記録（ADR-020。**ただしこの対戦は選手の成績集計に数えない**）/ 高校の学校ページ /
チームの年度別ページ / 選手結果ページの「関連選手（主なペア）」。**結果ページが実在する選手だけ**リンクし、
無ければ名前のみ（デッドリンク防止）。大会ごとの「詳細」リンクは公式サイトではなく**サイト内の大会ページ**へ張る。

メタ・構造化データ:

- 選手結果ページの JSON-LD は `ProfilePage` + `mainEntity: Person`。`dateCreated` / `dateModified` は
  **実データ（初出/最新出場大会の日付）由来でビルド日を使わない**。
  **ISO 8601 の日時（JST オフセット付き。`T00:00:00+09:00`）で出す**——日付のみだと Google に「日時値が無効」と判定される。
  **`mainEntityOfPage` は出力しない**（ProfilePage では認識されない）。エンティティ指定は `mainEntity`。
- canonical は必ず実 URL（trailingSlash あり）に一致させる。
- title / description には所属・直近成績・通算成績を入れてページごとに一意化する。
- curated プロフィールは FAQ（身長・所属・ポジション）を可視コンテンツ＋`FAQPage` で持つ。

### 結果ページの noindex 選別

薄いページを外してインデックス枠を厚いページへ集中させる（GSC の「クロール済み - インデックス未登録」対策。
内部リンク・クロール深度・canonical・重複度はいずれも問題なく、原因は本文の薄さとドメイン評価と判断した）。

- 判定（`results.tsx` の `getStaticProps`）: **`totalMatches >= 15`（`PLAYER_INDEX_MIN_MATCHES`）
  または全国高校大会の出場歴あり**なら index、どちらも満たさなければ `noindex, follow`。
  全国高校大会の出場者は試合数に関わらず index にして「検索対象になってほしい有名校ページ」を守る。
- `nofollow` にしないのは、薄いページからの内部リンクで残すページへ評価を流すため。
- **自動復帰**: データが増えれば次回ビルドで自動的に index へ戻る（手動解除は不要）。
- sitemap は postbuild の `scripts/filter-noindex-from-sitemap.mjs` が生成 HTML の robots meta を見て除去する。
  **判定はページ側1箇所に集約し、sitemap は生成物から派生させる**（ロジックを二重に持たない）。
  順は `next-sitemap` → `sort-sitemaps` → `filter-noindex-from-sitemap`。

### 所属歴のメタデータ化

`title` / `description` は最新の所属しか持たず、世間がその選手を指す名前（実業団名・出身校）が
本文の表にしかない状態だった。整形は `lib/playerCareerAffiliations.ts` に集約（SEO 文言のヘルパーは `lib/` に置く規約）。
データ源は `playerStatistics.byTeam` で配線の追加は不要。

- `description` 末尾に `これまでの所属は◯◯・◯◯。`（**最新の所属は除く**。`displayName` に既出のため）
- JSON-LD `Person` に `alumniOf`（学校マーカーを持つもの）/ `memberOf`（それ以外）。`affiliation` は最新1件のまま
- テストは `npm run career:test`（CI のゲートに入っている）
- **description の予算配分**（`composeDescriptionTail`。閾値は `DESCRIPTION_MAX_WIDTH`）:
  ①予算内なら「主なペア」＋「所属歴」 ②入らなければ**所属歴を優先して主なペアを落とす**
  （ペアの相手は本文の関連選手から相互リンクされるが、所属歴はこのページにしか出ない語だから）
  ③どちらも入らなければ従来どおり主なペアのみ（**既存文言は削らない＝非破壊**）
- **既知の制約**: 効果は測れない（`alumniOf` にリッチリザルトは無く、description に足した語もほぼ本文に既出）。
  そもそも **「ページを厚くすれば順位が付く」という前提が実測で支持されていない**（[seo.md](../wiki/seo.md)）ので、
  期待値は低いと理解したうえで採用している。略称の学校（「高田商」）は `memberOf` 側に落ちる。
  語尾違いの表記ゆれは畳まない（前方一致は「中京」と「中京大学」のような別実体を誤結合する）。
- 見送り（ユーザー判断）: 代表所属を最新以外にする / 学校名を正式名で出す（1,100件規模の人手データが前提）/
  読み仮名の整備 / 異体字対応（Google が同一視することを実測済み）。

## 選手統計エンジン（Player Statistics Engine）

選手ページを「国内で最も情報量の多い選手データベース」にするための集計機能群。
アーキテクチャ判断は [ADR-011](../adr/ADR-011-player-statistics-engine.md)、データ契約は
[raw/2026-07-01](../raw/2026-07-01-player-statistics-engine-data-contract.md)（実装はこれを正とする）。

- **設計の核（単一プリミティブ方式）**: 全機能は選手1人ぶんの `PlayerMatchFact[]`（1試合1件）と
  `PlayerEntryFact[]`（1大会カテゴリ1件）へ一度だけ前計算し、あとは純関数の fold で導く。
  **個別機能ごとに `details/**` を走査し直さない。** すべてビルド時前計算でランタイム集計はしない。
- **層構造**: L0 `sourceAdapter.ts`（読込・大会メタ join）/ L1 `facts.ts` / L2 `aggregators/*.ts`（純関数 fold）/
  L3 `playerStatistics.ts`（オーケストレーション・memo）。公開ファサードは `getPlayerStatistics(id, options)`。
- **生成スクリプト**（`scripts/playerStats/`、prebuild に連結）: `generate-facts.ts` / `generate-rankings.ts` /
  `generate-public-json.ts`。**中間・成果物の置き場はリポジトリ直下の `.playerstats/`**
  （`data/players/` 配下に置くと `_facts` 18,000ファイル超を nft の output file tracing が毎回列挙する。
  [deployment.md](../wiki/deployment.md)）。成果物は `.gitignore`。
- **増分ビルド**: `.playerstats/_manifest.json` に入力の contentHash を持ち、前回との diff から
  **変更大会に出場した選手だけ** `_facts` を再生成する。下流（rankings / public JSON / analysis）は
  `lastRun` に従う。全再計算は `engineVersion` 変更・グローバル入力の変更・manifest 不在・`--full` のとき。
  config 変更は facts に影響しないので rankings/public の再生成だけを誘発する。
- **既存資産の一本化**: `data/players/<slug>/analysis.json` はエンジン Facts 由来で生成する
  （`legacyAnalysis.ts`）。旧スクリプトは委譲する薄いラッパで、独自の全大会スキャンは削除済み。
- **テスト**: `npm run playerstats:test` / `playerstats:verify`（golden・byte 一致・キャッシュ vs 再計算の一致）/
  `playerstats:perf`（時間予算と線形性）。

### 集計ルール（確定）

- **年区切り = 年度**（大会データの `year` が既に年度指定）。
- **勝率・ゲーム率**: `retired:true` は全除外（不戦勝と途中棄権がデータ上区別できないため）、draw は分母から除外。
  ただし順位・進出率・出場回数・優勝判定など placement 側には反映する（retired の勝者は勝ち上がっている）。
- **年度ランキング**はシーズンポイント制（tier × 順位係数を**その年度の上位3大会のみ合算**）。
  仕様は [ranking.md](../wiki/ranking.md)。年度別順位表の `playerKey` は**その年度の所属**を刻む（現所属で過去を汚染しない）。
  同ポイントは標準競技順位（1224方式）。**男女別に分離**して出力する。
- **H2H の既定軸は対個人**（相方問わず相手選手で名寄せ）。ペア対ペアは絞り込みオプション。
- **所属別成績・キャリア年表の「所属」は国際大会を除外**（`selfTeam` が国別代表コードで所属ではないため）。
  **国際予選は実クラブ所属で出るので除外しない。**
- 全集計は掲載大会分。`scope: 'site-covered'` と `scopeNote` を付し、「初」「通算」は `confidence: 'scope-limited'`。
- **学年別成績は実装しない**（確実な生年・入学年データが無い）。
- **同姓同名は当面融合を許容**（numeric id は「1名前=1id」）。緩和のみ実装: H2H/ペアは `playerKey` で分離、
  同一カテゴリ内の self-vs-self はスキップ、`homonyms.json` 登録名は `identity.homonymRisk` で警告。
- **ローマ字表記のみの国際大会参加者**は `resolveNumericId` で解決できないため、手動対応表
  `data/tournaments/participant-aliases.json` をフォールバックに使う（[data-import.md](../wiki/data-import.md)）。

### 主要大会の実績表示（勲章カード）と「全国大会優勝」SEO

**対象集合が2つあり、わざとずれている**（`lib/nationalTitles.ts` の大会マスタが2つのフラグで表す）。
**片方を直すときはもう片方も確認すること。**

| 用途 | 判定 | 含む | 除く |
|---|---|---|---|
| 勲章カード（ベスト8以上をカテゴリ別に表示） | `majorCategory !== null` | 小学生/中学生/ジュニア/高校生/大学/総合/**国際大会**/シニア | **社会人**・東西日本・国際予選 |
| 「全国大会優勝」SEO・`titles.national`・`firstNational*` | `nationalTitle === true` | 国内の全国大会（**社会人を含む**） | **国際大会**・東西日本・国際予選 |

- 社会人を SEO から外さないのは「全日本社会人選手権優勝」が全国大会優勝として事実正しいから。
  国際大会を「全国大会優勝」に数えないのは国内の全国大会ではないから。
- **`PlayerEntryFact.isNational` は使わない**。あれは `generationId` が国際系以外という広い定義で、
  東日本・西日本選手権という**地域大会まで true** になり「全国大会優勝」と出すと誤りになる。
  `isNational` の定義自体（ランキング tier 等で使用）は変えない。
- 大会を追加してもホワイトリストに足さない限り実績表示には現れない（安全側に倒す設計）。
- 各大会に `categoryLabel` を持たせる（`generationId` の `junior` に中学・小学・U20 が同居していて粒度を出せないため）。
- 学齢カテゴリはタイルを分けてある（高校生＝インターハイ/高校選抜/ハイジャパ、**ジュニア＝全日本ジュニア(U20)のみ**、
  中学生＝全中/都道府県対抗/クラブ選手権、小学生＝全日本小学生/全国小学生）。
  表示順は シニア → 国際大会 → 総合 → 大学 → 高校生 → ジュニア → 中学生 → 小学生（キャリアの新しい側から。**格付けではない**）。
- **成績の対象は UI＝ベスト8以上、SEO＝優勝のみ**（ベスト8は検索需要が薄く、title に入れると優勝の signal が薄まる）。
- データは `PlayerStatistics.majorResults` と `titles.national`。どちらも既存 entries の単一パス fold。

UI（`PlayerMajorResults.tsx`。h1 → リード文 → タイルの順）:

- **1カテゴリ=1タイル**で、出すのは**カテゴリ名と最高成績だけ**。大会名・年度・種目は `<details>` に送る
  （展開はタイルごとではなく**セクションに1つ**）。閉じていても DOM にあるので通称 literal はクローラに読まれる。
- **ベスト8未達カテゴリの空枠は出さない**（該当者の多くが1カテゴリのみで実績が薄く見えるため）。
  **「new」バッジもアイコンも置かない**（静的サイトで鮮度管理が要る／不要と判断）。
  成績は必ず文字で示し、色は補助に留める。非該当の選手には何も出さない。`scopeNote` を併記。
- **「主要タイトル」表とは役割が違うので統合しない**。あちらは4大全日本×全収録年度のマトリクスで、
  **空欄（`ー`）自体が「出ていない」という情報**。中身が無くても表を出す仕様は意図的。

SEO（詳細は [seo.md](../wiki/seo.md) #2）: title / description / 本文バッジに**通称を literal で出す**
（正式名称だけでは通称クエリに一致しない）。JSON-LD `Person` に `award`。**noindex 判定には影響しない**
（全国大会優勝者は既存 index 条件のスーパーセット）。**文言生成は `lib/nationalTitles.ts` に集約し、ページ側で組み立てない。**

`ENGINE_VERSION` は `majorResults` 追加・マスタの2フラグ化で **1.5.0**。バンプすると次回 prebuild で `_facts` がフル再生成される。

## 結果ページのセクション階層

主役（大会結果）が埋もれないよう、P3「段階的開示」に沿って4段に再編してある。

1. **h1 ＋ リード文 ＋ 勲章カード**（畳まない）
2. **スタッツ**（見出し無しの平置き）: 常時表示は**主なペア（上位8名）・よく対戦した相手（2回以上・上位5人）・直近3年の成績のチップ**だけ
   （総合成績はリード文と重複するので出さない）。`<details>`「成績を詳しく見る」の中に `SectionCard`（h3）を7枚:
   対戦成績・戦績ハイライト・年度別ランキング推移・大会別成績・H2H・所属別成績・キャリア年表。
   - **H2H は選手 id 単位**で数える（id が無い相手だけ `名前@所属`）。所属が変わっても同じ相手は1人。
     表示は2回以上対戦した相手だけ（`RIVAL_MIN_MEETINGS`。2026-09-22 ユーザー判断）。
     常時表示のチップは「{選手A} {選手B}」の検索語の受け皿（[seo.md](../wiki/seo.md)）。
   - **OG 画像**: 全国大会優勝者（171人）だけ成績カード（1200×630）を出す。索引 `data/players/og-images.json`、
     読むのは `lib/playerOgImage.ts`。生成は `npm run og:players:export` → `npm run og:players -- --apply`。
     ファイル名のハッシュは描く内容から取るので、成績が変わった選手だけが作り直される。対象を広げるかは未判断（1枚約25KB）。
   - **枠はトリガー（`<summary>`）だけに付ける**（中の `SectionCard` が自前の枠を持つため）。
   - **情報は削除しない**（閉じていても DOM に残りクローラは読む）。SEO が約束する実績文言は
     リード文として `<details>` の外に出ている。
3. **他機能への導線**（スコア詳細のある試合・成長記録）: 集計でも生データでもない第3カテゴリとして畳まず表示。
4. **大会結果（試合結果一覧）**: 主役として最後に表示し、その中に**主要タイトル表を内包する**
   （`MajorTitles` の見出しは `<h3>`。隣接する年グループと階層を揃える）。

旧「関連選手（主なペア）」セクションは撤去済み（サマリーのパートナー別と完全に同じデータだった）。
保留: 「スコア詳細のある試合」を大会結果の該当カードにバッジ統合する案（結合キーが `PlayerMatch` 型に無い）。

## 発展候補アイデア一覧（Idea Backlog）

表の「状況・目的」は**状況と1行の目的・残りだけ**（規則は [idea-backlog.md](../wiki/idea-backlog.md)）。

| アイデア | 状況・目的（1行） | 詳細 |
|---|---|---|
| 選手一覧ページの再設計 | **実装済み**（2026-08-08）。残は GSC 効果測定と読み仮名データ | [アイデア](../raw/2026-08-08-idea-players-index-redesign.md) |
| 選手ページの検索競争力（グループB） | **P2a 実装・P0 実測済み**（2026-09-09）。圏外の原因は未特定で、次は外部要因の切り分け。title の字数予算は2026-09-22に修正済み（[seo.md](../wiki/seo.md)） | [アイデア](../raw/2026-09-09-idea-player-page-serp-competitiveness.md) |
| 試合結果から選手の「戦評」を編む | **発散フェーズ**（2026-08-06）。検証を通った指標は「勝率調整済み圧勝度」のみ | [アイデア](../raw/2026-08-06-idea-match-result-style-commentary.md) |
