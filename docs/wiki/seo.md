# SEO カニバリゼーション / 重複制御

## 概要

Softeni Pick は同一データから複数の切り口でページを生成するため、ページ種別間でキーワードや検索意図が重なりうる。本ページは、その重複（カニバリゼーション）と制御手段を**横断的に**整理する一覧である。個別ページの実装詳細は各 wiki ページに譲り、ここでは「どのページ種別が重なり、どう棲み分けるか」に絞る。

制御手段は次の4つに整理する:

- **インテント分割**: 狙うクエリ（年あり/なし、解説/結果 など）を分け、本文・title・description を差別化する
- **canonical 統一**: 同一実体に複数 URL がある場合、正規 URL へ寄せる
- **noindex**: 薄い/重複したページをインデックスから外し、インデックス枠を厚いページへ集中させる
- **内部リンク集約**: 解説や入口を1ページに集約し、重複ページ自体を作らない

実害の判定は GSC（同一クエリへの複数 URL 出現・順位変動・クリック分散）で行う。実害が確認できない限り、canonical 統一や 301 は急がない（移植・リダイレクトに伴う毀損リスクがあるため）。

## ページ種別の重複マップ

各ペアについて「重なり / 現状の制御 / 状態」を記す。状態は **対策済 / 監視 / 未判断** の3区分。

### 1. 選手プロフィール × 選手結果ページ

- URL: `/players/{slug}/` × `/players/{id}/results/`
- 重なり: 同一選手の curated プロフィールと、数値 ID の結果ページ
- 制御: URL 統合は条件付き先送り。両ページ間に逆リンクを張って相互接続。カニバリ対象は curated 約23選手のみでスコープが小さい
- 状態: **監視**（GSC で無視できない損失を確認できた場合のみ統合着手。統合時の 301 はホスト側 Cloudflare `public/_redirects` で張る）
- 詳細: [players-pages.md](./players-pages.md)「選手ページの SEO 方針」

### 2. 選手結果ページ同士（薄いページのインデックス枠競合）

- URL: `/players/{id}/results/`（約1,800件）
- 重なり: 似た構造の薄いページが多数あり、ドメインのインデックス枠を食い合う（GSC「クロール済み - インデックス未登録」が多発していた）
- 制御: `totalMatches >= 15` または全国高校大会出場歴ありなら index、どちらも満たさなければ `noindex, follow`。判定閾値は `PLAYER_INDEX_MIN_MATCHES`。sitemap も `scripts/filter-noindex-from-sitemap.mjs` で連動除去
- 状態: **対策済**（データ増で自動的に index 復帰）
- 詳細: [players-pages.md](./players-pages.md)「選手結果ページの noindex 選別」
- **追記2（2026-07-26・「全国高校大会出場歴」の判定範囲を修正）**: 上記の「全国高校大会出場歴あり」
  条件は `tournamentMeta.get(tid)?.generationId === 'highschool'` で判定していたが、その元である
  `loadTournamentIndex()`（`lib/tournamentData.ts`）は **`index.json` と `local_index.json` を連結**
  して返す。`local_index` 側にも `generationId: 'highschool'` の大会（**地区大会9件＋東海高等学校
  選抜**）があるため、地区大会に 1 試合出ただけの薄い選手ページが試合数に関わらず全て index 対象に
  なっていた。これは本節の設計思想（薄いページを外してインデックス枠を厚いページへ集中させる）を
  構造的に反転させる。
  - 規模: `local_index` の `generationId=highschool` 大会のユニーク選手は約 **3,223 人**。現在の
    ページ生成対象（`count >= 5`）は 1,917 人。`data/players/index.json` が地区大会投入（2026-07-26）
    より前の生成物だったため**まだ顕在化しておらず**、次の再生成前に修正できた。
  - 修正: `lib/tournamentData.ts` に `loadNationalTournamentIds()`（`index.json` 収録 ID のみ・
    キャッシュ付き）を追加し、判定を `nationalTournamentIds.has(tid) && generationId === 'highschool'`
    に限定。規約の出典は `lib/playerStats/sourceAdapter.ts` の「index.json＝national 候補 /
    local_index＝常に非 national」。
  - 効果（全 details 走査の実測）: `hasHighschoolNational=true` の選手が **7,625 人 → 5,727 人
    （−1,898 人）**。この 1,898 人は本来の `totalMatches >= 15` 判定に戻る。
  - **教訓**: `local_index.json` に新しい大会カテゴリを足すとき、`generationId` を条件に使っている
    既存ロジックが `index.json` 限定のつもりでないかを必ず確認する。両者を連結して返すローダー
    （`loadTournamentIndex` / `tournamentHelpers.server.ts` の `loadTournamentIndexEntries`）が
    複数あるため、`generationId` 単独での判定は原則として不十分。
  - 実装: `lib/tournamentData.ts`（`loadNationalTournamentIds`）、`src/pages/players/[id]/results.tsx`
  - 経緯: [raw/2026-07-26-idea-block-tournament-news-integration.md](../raw/2026-07-26-idea-block-tournament-news-integration.md)
- 追記（2026-07-20・全国大会優勝の通称 literal）: index に残る側のページの一意性・情報密度を上げる
  施策として、**全国大会優勝歴のある選手（236人）の title / description / 本文に大会の通称を
  literal で出す**。狙いは「{選手名} インターハイ 優勝」のような**選手名＋通称**のクエリで、
  #3 の「インターハイ 歴代 優勝」（大会側の検索意図）とは別インテントなのでカニバらない。
  - title は該当者のみ `{選手名}（{所属}） インターハイ優勝｜試合結果・戦績 | ソフトテニス`。
    複数大会は先頭2大会まで（2件で26字超なら1件）＋「ほか全国優勝計N回」。
  - description は先頭近く（通算成績より前）に `全国大会優勝1回: 2024年全国高等学校総合体育大会
    （インターハイ・高校総体・インハイ）。`。正式名称に通称が含まれない場合だけ括弧で添える。
  - 通称・略称の定義は `lib/nationalTitles.ts` の `shortLabel` / `aliases`。#3 の「ハイジャパを
    専用ページを作らず literal で拾う」手法と同型で、**新規 URL は増やさない**ため重複マップに
    新しい行は作っていない。
  - 状態: **監視**。効果は未測定（Assumption）。高校シーズン後に GSC で対象クエリの表示回数・
    CTR を確認し、立たなければ title からの撤去も選択肢。撤去は `nationalTitleTitlePhrase` の
    呼び出し 1 箇所で戻せる。
  - 見送り: 学校ページ・大会結果ページ参加者一覧など**選手名が出る他ページへのバッジ展開**は
    保留。同じフレーズを複数ページで機械的に反復するとテンプレ的な重複と見なされうるため、
    まず結果ページ1箇所で反応を見る。
  - 粒度は**優勝のみ**に据え置く（2026-07-20 決定）。同時に UI 側の勲章カードは**ベスト8以上**に
    広げたが、ベスト8は検索需要が薄く、title に入れると優勝者の強いシグナルが薄まるため
    SEO 文言には反映しない。つまり **UI はベスト8以上、SEO は優勝のみ**。
  - 「全国大会優勝」に数える大会には**社会人（全日本社会人・実業団・クラブ選手権）を含み、
    国際大会は含まない**。勲章カードの対象集合とは意図的にずれている（詳細は players-pages.md）。
  - 詳細: [players-pages.md](./players-pages.md)「主要大会の実績表示（勲章カード）と「全国大会優勝」SEO」

### 3. 大会ハブ（年なし） × 高校全国大会 歴代記録 ← 未判断の主リスク

- URL: `/tournaments/[generation]/[tournamentId]` × `/highschool/tournaments/[tournament]`
- 重なり: インターハイ / ハイスクールジャパンカップ / 全日本高校選抜（2026-07-17 追加）の「歴代まとめ」。両方とも self-canonical かつ index 対象
- 追記（2026-07-17）: 選抜を `HS_NATIONAL_TOURNAMENTS` に追加（slug `senbatsu`、2020〜2025年度収録）。汎用ハブ `/tournaments/highschool/highschool-senbatsu` は `getHsNationalSlugByTournamentId` の逆引きにより自動で noindex, follow＋誘導バナー対象になる。略称は「高校選抜」を aliases で集約（「センバツ」は野球との衝突があるため title には使わない）
- 現状の差別化（内容面）: 大会ハブ＝歴代優勝者中心、高校歴代＝ベスト4までの上位入賞＋高校カテゴリ内の回遊導線
- 懸念: 「ソフトテニス インターハイ 結果 歴代」系のクエリで2 URL が競合しうる
- **決定（2026-06）**: 高校全国大会は `/highschool/tournaments/[tournament]` へ検索面を集中させる。高校はリリース間もなく GSC の実測がまだ取れていないが、高校シーズンが近いため、計測を待たず先に寄せる。
  - 汎用ハブ（`/tournaments/highschool/highschool-championship` / `…highschool-japan-cup`）は `noindex, follow` にして検索面から外す。`follow` なので link equity は残し、ハブ→高校歴代ページの内部リンク（誘導バナー）で評価と回遊を流す。判定は `getHsNationalSlugByTournamentId(tournamentId)`（`lib/highschoolNationalTournaments.ts`）が高校全国大会 ID を逆引きして行い、対象 ID のときだけ noindex にする。
  - 高校歴代ページ側は title 先頭に「ソフトテニス」を入れて「ソフトテニス {大会名} 結果」系クエリの exact 一致を強める（その他のメタ・構造化データは既に歴代クエリ向けに最適化済み）。
  - 復帰: データが揃い高校歴代ページの実績が確認できれば、ハブの noindex を外すのは判定 1 箇所の変更で戻せる。逆にハブを正にしたくなった場合も同様。
  - **Assumption**: 現状どちらの URL が実績厚かは未測定。集中先は「高校カテゴリ内の回遊が厚い高校歴代ページ」を選んだ運用判断。
- **特集ページを持つ大会への横展開（2026-08-12）**: 同じ「ハブを noindex, follow にして特集側へ集中させる」扱いを、
  `data/tournaments/index.json` の `featurePath` で汎用化した。第1号は STリーグ（`/tournaments/corporate/st-league`
  → `/st-league/`）。判定は高校全国大会の `getHsNationalSlugByTournamentId` と同じ 1 箇所（ハブの `getStaticProps` /
  `MetaHead`）で、外すのも `featurePath` を消すだけ。詳細は [st-league.md](./st-league.md)「大会一覧との連携」
- **略称クエリの集約（2026-06）**: 「ハイジャパ」（ハイスクールジャパンカップの通称）など略称での検索を、専用タグページを作らず `/highschool/tournaments/japan-cup` ハブ1枚に集約する。競合（ソフトテニスマガジン）は記事タイトルへの literal「【ハイジャパ】」＋ `/tag/ハイジャパ/` で略称を取っているが、当サイトで別 URL を作ると #3 の集中方針に反し薄いページを増やすため採らない。代わりに略称を `HsNationalTournamentMeta.aliases` に持たせ、ハブ側の title・h1・meta description・FAQ（「『ハイジャパ』とは？」）に literal で1〜2回出して exact 一致を取る。差別化は「ハイジャパ 歴代 優勝」等のロングテール（DB由来の歴代記録）で行う。
  - 実装: `lib/highschoolNationalTournaments.ts`（`aliases`）、`src/pages/highschool/tournaments/[tournament]/index.tsx`（headingName・description・FAQ）、`src/pages/highschool/tournaments/index.tsx`（入口の通称表記）
  - **併記のルール（2026-08-05 修正）**: 表示名は `label（shortLabel）` に alias を足す形だが、
    alias が `shortLabel` または `label` と同じ場合は**併記しない**（`displayAlias`）。
    高校選抜は `shortLabel` も `aliases[0]` も「高校選抜」のため、素通しすると title・h1・
    description が「全日本高等学校選抜ソフトテニス大会（高校選抜）（高校選抜）」と二重になり、
    title は 70字でサーバ上の SERP で確実に切れていた（本番 HTML で確認）。
    FAQ（「『高校選抜』とは？」）は略称クエリの受け皿なので `primaryAlias` のまま残す。
    修正後の title は 64字、ハイジャパ（`shortLabel` と異なる alias）は従来どおり併記される
- **追記3（2026-08-06・「link equity は残る」という前提が崩れていた）**: 上の決定は
  「汎用ハブを `noindex, follow` にすれば link equity は残り、誘導バナー経由で高校歴代ページへ
  流れる」という前提だったが、**サイト全体の内部リンクの大半が noindex ページを1ホップ挟む**
  構造になっていた。ビルド済み `out/` の実測（`href` 完全一致）:
  - `/tournaments/highschool/highschool-championship/`（noindex 汎用ハブ）への被リンク **1,111枚**
    （うち選手ページ 1,084・大会 25・news 1・トップ 1）
  - `/highschool/tournaments/championship/`（集中先）への被リンク **194枚**
  - 比較: `/tournaments/all/zennihon-singles/`（index の汎用ハブ）への被リンク **1,929枚**
  - `follow` でも長期 noindex のページはクロール頻度が落ちるため、9割の内部リンクが
    実質的に減衰していた。「インターハイ 歴代」#7 に対し「全日本シングルス 歴代」#3 という
    順位差の最大の構造要因はこれ（年度カバレッジは IH 6年・シングルス 5年でほぼ同じ、
    可視テキストは IH 3,797字・シングルス 1,012字で IH のほうが厚い）
  - 修正: `lib/highschoolNationalTournamentMeta.ts` を新設し、**`getTournamentHubHref()` を
    大会ハブへのリンク生成の唯一の入口**にした。高校全国大会のみ `/highschool/tournaments/{slug}/`
    を返す。ハブ URL のベタ書きは全廃（`PlayerStatisticsSections` / `majorTitles` /
    `TournamentCard` / トップ / `players/[id]` / `newsArticle`）。
    **ハブへのリンクを新たに書くときは必ずこの関数を通すこと。**
  - メタ定義を新モジュールに切り出したのは、`lib/highschoolNationalTournaments.ts` が
    `import fs` していてクライアント側コンポーネントから使えないため。サーバー側は
    新モジュールを re-export しており定義は二重管理していない
  - パンくず（ハブ自身・年度別ページ）と `pageUrl`（canonical）は**振り替えていない**。
    URL 階層上の親を指すのがパンくずの意味で BreadcrumbList にも出る、かつ該当25枚と量が
    小さいため
  - 検算: 全29大会で 3大会のみ振替・26大会は従来どおり、リンク先 HTML が全て存在（デッドリンク0）
  - 経緯: [raw/2026-08-06-rekidai-serp-gap-interhigh-vs-singles.md](../raw/2026-08-06-rekidai-serp-gap-interhigh-vs-singles.md)
- **追記4（2026-08-06・title は「歴代」を先頭30字以内に置く）**: 日本語 SERP のタイトル表示は
  概ね30字。実測では「歴代」の開始位置が **開催中モード40字目・通常モード28字目**（全日本
  シングルスは17字目）で、歴代クエリで出てもタイトルに「歴代」が見えていなかった。
  - 修正: title の頭を正式名称（`headingName`）から短い通称（`shortLabel`）に変え、正式名称は
    後半へ。収録年度（`（2021〜2026年度）`）と次回開催予定は title から外して description・FAQ へ
    （どちらも30字より後ろで SERP に出ていなかった。収録年度は「6年分しか無い」ことを
    SERP 上で先に伝える面もある）
  - 略称の併記（ハイジャパ）は**通常モードのみ**。開催中モードは先頭に「{通称}{年} 結果・途中経過」が
    入るため、併記すると「歴代」が40字目に戻る。開催中でも略称は h1・description・FAQ に literal で残る
  - 検算（3大会×2モード）: championship 通常14字目/開催中26字目、japan-cup 通常28字目、
    senbatsu 通常12字目/開催中24字目。**japan-cup の開催中モードのみ33字目で枠に入らない**が、
    正式名称が13字あり結果インテントと両立できないこと、会期（6月）が歴代クエリの需要ピークと
    ずれることから許容
  - 実装: `src/pages/highschool/tournaments/[tournament]/index.tsx`（`titleLeadName` / `titleFormalSuffix`）
- **未実施・効果の天井が最も高い施策（2026-08-06）**: IH の収録は 2021〜2026 の**6大会のみ**。
  一方「インターハイ 歴代」上位の競合は埼玉県高体連の全国大会記録（全年度）、YouTube の
  1989〜2019 一覧、shindeme.com の都道府県別 歴代出場校 と、30年以上を持っている。
  「歴代」の検索意図は全史なので、上記2つの対策は取りこぼしを塞ぐものであって、
  この構造的不足は解消していない。対戦表データ不要の **champions-only レイヤー**
  （年 / 優勝 / 準優勝）を足すのが次の一手（先例: `src/pages/st-league/champions.tsx`）。
  出典の確保と検算が必要。**Assumption**: 全日本シングルスの #3 は競合が Wikipedia と
  個人ブログしかいない薄さによるもので、ページの出来の差ではない
- 状態: **対策済（先行集中・監視継続）**。GSC が取れ次第、集中先が正しいか（高校歴代ページが対象クエリ・略称クエリで上位を取れているか）を確認する。**2026-08-15: M4検証第1回でカニバリ確認、気になる分散なし**（[raw/2026-08-15-m4-gsc-review.md](../raw/2026-08-15-m4-gsc-review.md)）。集中先の実績（順位）自体は未計測のまま
- 実装: `src/pages/tournaments/[generation]/[tournamentId]/index.tsx`（ハブの noindex＋誘導バナー）、`src/pages/highschool/tournaments/[tournament]/index.tsx`（title 最適化）、`lib/highschoolNationalTournaments.ts`（`getHsNationalSlugByTournamentId`）
- 関連: [highschool.md](./highschool.md)「高校 全国大会の歴代記録ページ」、[public-pages.md](./public-pages.md)「大会ハブページ」

### 4. 大会ハブ（年なし） × 年度別結果ページ

- URL: `/tournaments/[generation]/[tournamentId]` × `/tournaments/.../[year]/.../[gender]`
- 重なり: 同一大会。ハブ＝「大会名 結果」、年度別＝「大会名 {年} 結果」
- 制御: 年あり/なしのインテント分割（意図的）。ハブから各年度別ページへ内部リンク
- 状態: **対策済**（設計上の棲み分け）

### 5. STリーグ ハブ × 試合ページ × 解説（about）

- 重なり: STリーグ関連クエリ
- 制御: 試合ページはハブとのカニバリ回避でキーワードを絞る（狙うのは「STリーグ {年}」「第N回STリーグ 結果・会場」）。「STリーグとは」の解説は `/st-league/about` に集約し、ハブとのキーワード重複を避ける
- 状態: **対策済**
- 詳細: [st-league.md](./st-league.md)

### 6. 試合詳細 ネスト URL × 野良 URL（＋2ドメイン）

- URL: `/tournaments/.../matches/[matchId]`（掲載大会）× `/beta/matches-results/[matchId]`（野良）。score ドメインの `/matches/[matchId]` も同一コンポーネント
- 重なり: 同一試合が複数 URL で到達可能
- 制御: canonical はネスト URL（`siteLink` から生成）を正とする。野良試合（`siteLink` なし）は `/beta/matches-results/[matchId]` に残し noindex。`softeni-pick` / `score` のモード差は `siteConfig.mode` で分岐
- 状態: **対策済**
- 詳細: [score-site-link.md](./score-site-link.md)

### 7. 高校 学校ページ × 選手ページ × 都道府県ページ

- URL: `/highschool/[gender]/[prefectureId]/[teamId]` × `/players/{id}/results/` × `/highschool/[gender]/[prefectureId]`
- 重なり: 「◯◯高校 ソフトテニス メンバー」など、粒度の違う複数ページが同じ学校に言及する
- 制御: 学校ページ＝年度別メンバー一覧/主要4大会サマリー、選手ページ＝個人成績、都道府県ページ＝一覧入口。内部リンクで階層化し意図を分離する
- 追記（2026-07-18）: 学校ページに「主な卒業生」セクションを追加し、「◯◯高校 ソフトテニス 出身/OB」系クエリも学校ページで受ける（詳細は [highschool.md](./highschool.md)）。卒業生の個人名クエリは従来どおり選手結果ページへリンクで集約
- 状態: **監視**（粒度が近いため、メンバー系クエリで学校ページに集約できているか要観察）。**Assumption**。**2026-08-15: M4検証第1回でカニバリ確認、気になる分散なし**（[raw/2026-08-15-m4-gsc-review.md](../raw/2026-08-15-m4-gsc-review.md)）

### 8. 展望（preview）記事 × 大会年度別ページ・大会ハブ

- URL: `/news/[articleId]`（preview のみ）× `/tournaments/.../[year]/.../[gender]`（年度別結果）× `/tournaments/[generation]/[tournamentId]`（ハブ）
- 重なり: 「{大会}{年} 展望・注目選手」（プレビュー記事 × ハブ）
- **決定（2026-06-27, ADR-010）**: **結果記事（result）は廃止**し、結果・優勝・歴代まとめは大会ハブ（高校全国大会は #3 のとおり高校歴代ページ）に一本化した。result はハブと同一実体の二重ページだったため、カニバリの主因を構造的に解消。`/news` は **preview（大会前の展望）専用**ツリーとする。
  - 公開済みだった result 5 件（`highschool-japan-cup-2022〜2025-result` → `/highschool/tournaments/japan-cup/`、`international-korea-cup-2026-result` → `/tournaments/international/international-korea-cup/`）は `public/_redirects` で 301。未公開の result ドラフトは削除。
  - 残る重なりは preview × ハブ（「{大会}{年} 展望」×「大会名 歴代まとめ」）のみ。インテント分割で棲み分ける: preview＝大会前の展望（前回王者・出場校・勢力図、選手名×文脈のロングテール）、ハブ＝年度なしの歴代まとめ。preview→ハブ/年度別/選手ページへ内部リンクで回遊。
- 方針: 汎用テンプレ SEO farm が押さえる「{大会}{年}結果速報」とは正面勝負しない。farm が構造的に持てない「DB 由来の文脈（歴代・通算・節目）」で差別化する。結果面はハブを強化（歴代横断統計）して受ける。
- 状態: **対策済（result 廃止・preview 専用化）／監視**。301 後の評価移行と、preview×ハブの棲み分けを GSC で確認する。
- 詳細: [news-context-blocks.md](./news-context-blocks.md)、[ADR-010](../adr/ADR-010-retire-result-articles-consolidate-to-hub.md)、[raw/2026-06-21-news-auto-draft-design.md](../raw/2026-06-21-news-auto-draft-design.md)

### 9. 選手ランキング × 選手結果ページ（2026-07-02 追加）

- URL: `/rankings/`（1 ページ・年度/種目/男女はクライアント切替）× `/players/[id]/results/`
- 重なり: 「{選手名}」系クエリ（ランキング表に選手名が大量に載る）と「ソフトテニス ランキング」系クエリ。
- 制御: **インテント分割＋内部リンク集約**。`/rankings/` は「ランキング・順位」インテント専用の 1 URL
  （年度×種目×男女で URL を切らない＝薄いページの量産と #2 型の枠競合を構造的に回避）。
  選手名インテントは表の選手名リンクで `/players/{id}/results/` へ集約する（結果ページを持つ選手のみリンク）。
- 補足: タブ裏の順位表はクライアント描画で不可視のため、全年度・全種目の上位 3 位を静的 HTML の
  「年度別 上位選手まとめ」として同ページ下部に掲載し、クロール可能な選手名・内部リンクを担保する。
  母数が年度で大きく異なるため scope 注記（掲載大会のみ）を必須表示。
- 状態: **対策済／GSC で「ソフトテニス ランキング」系クエリの獲得を事後確認**。

### 10. 高校強豪校ランキング × 学校ページ・都道府県ページ（2026-07-17 追加）

- URL: `/highschool/rankings/`（1 ページ・男女はクライアント切替）× `/highschool/[gender]/[prefectureId]/[teamId]`（学校）× `/highschool/[gender]/[prefectureId]`（都道府県）
- 重なり: 「高校 ソフトテニス 強豪/ランキング」系クエリと、「{学校名} ソフトテニス」「{県名} 高校 ソフトテニス」系クエリ。
- 制御: **インテント分割＋内部リンク集約**（#9 と同型）。`/highschool/rankings/` は「強豪・ランキング」インテント専用の 1 URL（男女で URL を切らない）。学校名インテントは表の学校名リンクで学校ページへ、県インテントは都道府県リンクで都道府県ページへ集約。タブ裏対策として男女の上位10校を静的 HTML「男女別 上位校まとめ」で担保。
- scope 注記: 独自集計・非公式であること、対象大会（収録済みの IH・ハイジャパ・選抜のみ、国体未収録）をページ上部と FAQ に明示。
- 決定（2026-07-18）: 「{県名} 高校 ソフトテニス 強豪」系クエリの受け皿は**都道府県ページ**とする。都道府県ページに「県内強豪校」セクション（全国ランキングの県内絞り込み上位5校、静的 HTML＋県別 FAQ）を追加し、ランキングページ＝全国軸・都道府県ページ＝県内軸でインテント分割。実装は `getPrefectureTopSchools`（`lib/highschoolRanking.ts`、モジュールスコープキャッシュ）。あわせてランキング⇔歴代記録ページの相互リンクを追加し、新設ページ種別の孤立を解消
- 状態: **対策済／監視**（GSC で「強豪」「ランキング」系クエリの獲得と #7 との分散を確認）。**2026-08-15: M4検証第1回で確認——「強豪・ランキング」「県別強豪」系クエリは維持〜向上、#7との分散なし**（[raw/2026-08-15-m4-gsc-review.md](../raw/2026-08-15-m4-gsc-review.md)）
- 詳細: [highschool.md](./highschool.md)、[raw/2026-07-17-idea-highschool-strong-school-ranking.md](../raw/2026-07-17-idea-highschool-strong-school-ranking.md)

### 11. 開催中の大会 × 年度別結果ページ（2026-08-01 追加）

- URL: `/tournaments/[generation]/[tournamentId]/[year]/.../[gender]`（既存。**新規URLは作らない**）
- 状況: 大会期間中が「{大会}{年} 結果」需要のピーク。年度別結果ページが本来の受け皿だが、
  従来は大会終了後にまとめて反映していたため、需要のピークを取りこぼしていた。
- **決定（2026-08-01）**: **#8 の「結果速報では farm と正面勝負しない」方針は反転しない**。
  速報クエリ（「{大会} 結果 速報」）は狙わず、**学校名・選手名 × 大会名のロングテール**
  （「{学校名} インターハイ 2026」「{選手名} インターハイ」）で拾う。年度別結果ページは
  全出場校・全選手名を持ち、さらに farm が構造的に持てない過去成績の文脈（大会インサイト）を
  添えられるため、ここは正面勝負にならない。ADR は起票しない（既存方針の範囲内）。
- 更新頻度: **1日1回**（その日の全種目が終わってから）。日次まとめのインサイト生成
  （`npm run story:generate -- --in-progress`）と同じタイミングに揃える。
- 薄さの開示: `ResultCoverageNotice`（ADR-007 / `lib/tournamentCoverage.ts`）が
  「現在◯回戦まで結果掲載中」を表示済み。未確定を確定のように見せない。
- **前提として直した不具合（2026-08-01）**: `next-sitemap.config.js` が大会の `endDate` を
  そのまま `lastmod` にしていたため、開催前・開催中の大会が**未来日**を出していた
  （インターハイ2026＝`2026-08-07`、全日本インドア2026＝`2027-02-07`。該当10大会）。
  未来の lastmod は無視されるうえ、途中経過を何度更新しても値が動かず**鮮度シグナルが
  一切効かない**状態だった。`clampToBuildDate()` でビルド日に頭打ちにし、開催中は
  ビルドのたびに前進、終了済みは従来どおり終了日のままになるよう修正。
  選手ページの lastmod（出場大会の最新日）も同じ理由でクランプ対象。
- **追記（2026-08-01・開催中の大会を「既存の指名済みページ」で受ける）**: 上記の決定は年度別結果
  ページ側の話だったが、**会期中に実際に順位が付いているのは大会ハブ（高校歴代ページ）1枚だけ**で、
  そのハブが開催中に「結果が確定し次第このページに追加します／最新情報は大会公式サイトを
  ご確認ください」と表示し、**検索から来た人を公式サイトへ逃がしていた**（2026-08-01 に本番HTMLで確認）。
  同時に title が「2026年大会の**開催予定**」のままで、2026年度別結果ページへの内部リンクが
  **ゼロ**、表示上の「最終更新」も未来日（2026-08-07）だった。
  - **決定**: 会期中は**新規URLを作らず**、既にインデックスされている3種のページを更新して受ける。
    残り会期が短いとき、新規URLはインデックスが間に合わないため効かない。
    - 大会ハブ（`/highschool/tournaments/[tournament]`）: 最上部に「開催中」ブロック（出場規模・
      種目別の進捗・現在の勝ち上がり・**年度別結果ページ4本への直リンク**）。title/description/h1 を
      「{通称}{年} 結果・途中経過」インテントへ切替。「開催予定」ブロックからは開催中の年を除外。
    - 都道府県ページ（47×男女＝**94枚**）: 「{県名}の高校{性別} {通称}{年} 出場校・途中経過」節＋FAQ。
      → 「{県名} インターハイ 2026」を面で取る。
    - 学校ページ（**243枚**が該当）: 「{学校名} {通称}{年} 出場・途中経過」節＋FAQ。
      → 「{学校名} インターハイ 2026」を取る。
  - 実装: `lib/highschoolInProgress.ts`（新規・都道府県別/学校別の索引）、
    `lib/highschoolNationalTournaments.ts`（`InProgressEdition`／`lastModified` のビルド日クランプ）、
    ハブ・都道府県・学校の各ページ。完了判定は既存の `computeResultCoverage`（ADR-007）を再利用。
  - 開示: 結果が1件も入っていない種目は「途中経過」と名乗らず「組み合わせ」と表記する。
    現在勝ち上がり中の名前は32件以下のときだけ列挙（序盤の羅列を避ける）。
  - **自動で元に戻る**: 優勝が確定すると `inProgress` が null になり、title・description は
    従来の「歴代」インテントへ戻る。会期後の巻き戻し作業は不要。
  - 検算（2026-08-01）: 都道府県ページ 94/94・学校ページ 243/633 に出ることを索引の全件走査で確認。
    ハブの「最終更新」表示が 2026年8月1日に是正。japan-cup / senbatsu は従来表示のまま（回帰なし）。
    **残: 実機での `npm run build`**（検証環境がメモリ不足で通せていない）。
  - 経緯: [raw/2026-08-01-in-progress-tournament-seo.md](../raw/2026-08-01-in-progress-tournament-seo.md)
- 状態: **対策済／監視**（GSC で大会期間中の表示回数と、学校名・選手名クエリの獲得を確認）
- 詳細: [ADR-007](../adr/ADR-007-in-progress-tournament-standing.md)、
  [docs/story-yaml/README.md](../story-yaml/README.md)

### 12. チームページ同士（薄いページのインデックス枠競合）（2026-08-05 追加）

- URL: `/teams/[teamId]/`（67枚）× `/teams/[teamId]/[year]/[gender]/`（約330枚）
- 重なり: #2 と**同型**。ナビ＋数行しか無い薄いページが多数あり、ドメインのインデックス枠を
  食い合う。2026-08-05 の実測では `/teams/**` 376枚のうち **274枚が可視テキスト700字未満**で、
  全て index かつ sitemap 掲載だった（#2 を選手ページにしか適用していなかった）
- 制御: 収録試合数が `TEAM_INDEX_MIN_MATCHES` 未満なら `noindex, follow`。
  試合数は「チーム所属選手が1人でも出ている試合」を1と数える（ダブルスで両者が同一チームでも
  二重に数えない）。ハブページは大会＋STリーグの全年度合算で判定する
- **閾値は 5 試合**（2026-08-05 決定）。選手ページの 15 より小さいのは、チーム×年度×性別という
  粒度では母数がそもそも小さく、15 だとほぼ全滅するため
- 効果（実データでの事前計測）: 年度別ページ **333枚中 92枚**が noindex（残り241）、
  ハブページ **67枚中 3枚**のみ noindex（残り64）。ハブが大きく残るのは STリーグの試合数が
  合算されるため。入口は保ったまま薄い年度ページだけを外せている
- sitemap は `scripts/filter-noindex-from-sitemap.mjs` が生成 HTML の robots meta を見て自動追従
  （判定を二重に持たない。#2 と同じ仕組み）
- 実装: `lib/teamIndexing.ts`、`src/pages/teams/[teamId]/index.tsx`、
  `src/pages/teams/[teamId]/[year]/[gender].tsx`
- 状態: **対策済／監視**（GSC の「クロール済み - インデックス未登録」が減るか、
  残した厚いチームページの表示回数が上がるかを確認）
- 経緯: [raw/2026-08-05-seo-audit.md](../raw/2026-08-05-seo-audit.md) B-1
- **追記（2026-08-11・STリーグ出場チームに「メンバー」節を追加）**: 薄いページのnoindex選別とは別軸で、
  index対象チームの内容を厚くする施策として、STリーグ出場チーム（実在の単一組織）に年度別登録メンバー
  節とFAQPageを追加し「{チーム名} メンバー」クエリを拾う。新規URLは作らず既存 `/teams/[teamId]/` を
  拡張（内部リンク集約と同型）。詳細は [st-league.md](./st-league.md)「『メンバー』クエリの受け皿」。
  なお高校以外のカテゴリ全般（成年・小学生等）の都道府県ページ化はスコープ外として見送り、
  まずSTリーグ出場チームのみに限定した（実データで成年カテゴリ全体は1,167チーム・都道府県データ
  カバー率99.6%と最有力候補と確認済みだが、新規URLツリーが要る規模のため別途検討）。

### 13. 中学カテゴリ × 既存ページ（2026-08-12 追加）

- URL: `/secondaryschool/`（1枚）／`/secondaryschool/pathways/`（1枚）／
  `/secondaryschool/[prefectureId]/`（47枚）／`/secondaryschool/[prefectureId]/[teamId]/`（**293枚**）。
  計**341枚**。仕様は [secondaryschool.md](./secondaryschool.md)
- **`/teams/[teamId]` との重複は0件**（2026-08-12 実測）。`/teams/` 側のページが生成されるのは
  `team-name-mappings.json` のキーか STリーグ出場チームだけで、中学の280チームは**1件も該当しない**。
  同じチームが2つのURLを持つ状態にはならない
- **`/highschool/**` とも競合しない**。中学と高校で学校名が同じでも（`昇陽` と `昇陽中学校` 等）、
  名寄せで別エンティティに分離済み（[ADR-013](../adr/ADR-013-scoped-team-name-aliases.md)）。
  検索意図も「{中学校名} ソフトテニス」と「{高校名} ソフトテニス」で分かれる
- **大会軸のページを作らない**ことで大会ハブとの重複も回避している。全中は
  `/tournaments/junior/secondaryschool-championship` に集約し、そこから `/secondaryschool/` へ導線を張る
  （ADR-010 の「ハブに集約」と同じ考え方）。高校のように `/secondaryschool/tournaments/` は作らない
- **薄いページの制御は掲載閾値**。出場延べ5件未満のチームは個別ページを作らない
  （#12 の `/teams/` の noindex 閾値と同じ値）。閾値なしだと990チームの7割が薄いページになる。
  noindex ではなく**そもそも生成しない**ので、#3 追記3 の「noindex ページへの内部リンクを数える」問題は起きない
- **順位づけをするページを持たない**（2026-08-12 決定）。当初あった県別ポイントは、
  大会ごとに県の出場枠が違い（全中は県により20倍差）比較が成立しないため廃止した。
  #9 #10 のようなランキング系カニバリは発生しない
- 内部リンク（2026-08-12 に相互リンクを追加）:

  | 経路 | 本数 | 備考 |
  |---|---|---|
  | サイドナビ「特集 > 中学」→ `/secondaryschool/` | 全ページ | |
  | **トップページ「属性別成績」→ `/secondaryschool/`** | 1 | 高校カテゴリと2カラムで並置 |
  | 全中の大会ハブ → `/secondaryschool/` | 1 | |
  | 高校の学校ページ「出身中学」節 → 中学チームページ | 88 | 男子44・女子44 |
  | **高校の県ページ → 中学の県ページ** | 94 | 47県×男女。中学ページの実在を確認してから出す |
  | **中学の県ページ → 高校の県ページ（男女）** | 94 | 高校の県ページは47県×男女が必ず存在する |
  | **中学チームページ「進路」→ 高校の学校ページ** | 346 | 進路レコード全件が解決 |
  | **`/secondaryschool/pathways/[gender]/` → 高校の学校ページ / 中学チーム** | 111 / 112 | 2枚（男女）で内部リンクのハブ |
  | **高校の学校ページ「出身中学」節 → `/secondaryschool/pathways/[gender]/`** | 111 | **同じ性別のページへ送る**（既存の強いページから新カテゴリへ返す） |

  中学→高校の順方向リンクは当初テキストのままで、**逆引き（高校→中学）だけがリンクになっていた**。
  解決は `getSchoolResolver()`（`summary.json` を唯一の正とする）に任せてデッドリンクを防いでいる。
  高校の県ページ側は中学ページが無い県を弾く（`teamCount > 0` を確認）
- 構造化データ: 全ページに `BreadcrumbList` を持たせた（高校と同水準）。
  県ページは `ItemList`、チームページは `SportsTeam` を併置している
- **`/secondaryschool/pathways/` は男女別URL**（2026-08-12 決定）。
  カテゴリの他のページは男女をまとめているが、このページだけ分けている。
  **同じ内容を薄く割るのではなく、もともと別の内容を正しく分ける**ため:
  - 高校の学校ページが男女別なので、掲載される高校が原理的に重ならない。
    中学112チームのうち男女両方に出るのは**22だけ**（45ずつが片側のみ）
  - title を「高校男子の出身中学一覧」と exact にでき、
    高校の学校ページ111枚からのリンクも**同じ性別**へ向けられる
  - サイトの既存規約が Link ベースの切り替え（`HighschoolGenderToggle`）。
    JS での画面内フィルタは規約から外れるうえ title が狙いを絞れない
  - 決定時点で**未公開だったため移行コストがゼロ**だった
  - 規模: 男子56校171名 / 女子55校175名。性別なしのURLは作らない
  - **入口ページからは男子へ1本だけ張る**（隣の全中カードとUIを揃えるため）。
    女子へは性別トグルで移動する。入口で男女2本に分けるとカードの見た目が隣と揃わない
- **`/secondaryschool/pathways/[gender]/` は高校起点**（2026-08-12 決定）。
  当初は中学起点（この中学からどこへ進学したか）で作ったが、**高校起点に作り替えた**。
  - 検索需要が高校名に偏っている。「{高校名} ソフトテニス」に対して「{中学校名} ソフトテニス」は桁が違う
  - **この向きでしか見えない事実がある**。東北（宮城）に埼玉の上青木中学校から2名、
    広島翔洋（広島）に愛知と埼玉から各2名、というような**強豪校の越境集約**は、
    中学起点だと1件ずつ別のチームページに散って見えない。実測で **346名中178名（51%）が県外**（[ADR-014](../adr/ADR-014-pathway-name-match.md) の緩和後）
  - 中学起点の見え方は各中学のチームページが担当する（役割分担）
- **高校の学校ページ「出身中学」節（88ページ）との重複について**。
  同じ内容が両方に出るが、**カニバリとは扱わない**。
  - 学校ページ側は**その高校の分だけ**（出身中学の中央値1）で、一覧は111グループ横断。
    どちらかが部分集合になる関係ではない
  - 検索意図が別。一覧は「ソフトテニス 高校 出身中学」のような一般語、
    学校ページは「{高校名} ソフトテニス」の固有名詞
  - 制御手段は**リンクの向き**。一覧→学校ページを111本張り、
    学校ページからは「他の高校の出身中学も見る」1本だけ返す。評価を個別ページ側へ寄せる
  - #10 の「歴代ページと年度ページ」で採った整理と同じ考え方（横断ページは入口、詳細は個別ページ）
  - **注意**: このページは `/secondaryschool/` 配下だが内容は高校軸。
    URLを `/highschool/` へ移すと `/highschool/**` の既存構成に割り込むため動かさない。
    中学カテゴリの成果物（進路データ）を見せるページという位置づけを維持する
- 状態: **実装済／未公開**。公開後に GSC でインデックス状況を確認する

## sitemap 生成の運用（2026-08-05 追加）

sitemap 側の制御は3つのスクリプト／設定に分かれている。順序と出力先を間違えると
**ページ側の対策が sitemap に反映されない**ので、触るときは3つまとめて確認すること。

1. `next-sitemap.config.js` — 列挙・`exclude`・`lastmod`・`additionalPaths`。
   **出力先は `outDir: 'out'` を明示**（既定の `public/` のままだと配信 sitemap が
   1ビルド古くなる。理由は [deployment.md](./deployment.md#sitemap-の出力先2026-08-05-修正)）
2. `scripts/sort-sitemaps.mjs` — `<url>` を loc 順にソートし、**同じ `<loc>` を1件にまとめる**。
   対象は `out/`
3. `scripts/filter-noindex-from-sitemap.mjs` — 生成 HTML を真実として sitemap を派生させる。
   除外条件は **(a) robots meta が noindex、(b) canonical が自 URL を指していない** の2つ。
   **判定はページ側に置き、ここは追従するだけ**

### 重複ページの除外は canonical で判定する（2026-08-05・A-2）

score ドメイン用の `/matches/<id>/` が softeni-pick 側のビルドにも出力され、掲載大会の試合
（siteLink あり）では canonical が `/tournaments/.../matches/<id>/` を指すのに sitemap には
両方載っていた（GSC「代替ページ（適切な canonical タグあり）」の発生源）。

`exclude: ['/matches/*']` で消す案は採らなかった。**野良試合（siteLink なし）にとっては
`/matches/<id>/` が正の URL**（`lib/siteConfig.ts` の `getPublicMatchDetailPath`）なので、
パスで一律に切ると「正なのに sitemap に無い」状態を作ってしまう。canonical で判定すれば
siteLink あり＝自動で除外／野良試合＝自動で残る、と両方正しくなり、将来3つ目の重複 URL
種別が増えても効く。

既存ビルドでの検証（2026-08-05）: canonical 不一致 42件を検出（`/matches/<id>` 21 ＋
`/beta/matches-results/<id>` 21）、sitemap からは 20件除去。野良試合1件
（`/matches/0a7e33bb-…/`、self-canonical）と一覧ページ `/matches/` は**残った**。

### `<loc>` の重複は出力段でまとめる（2026-08-05・A-3）

`additionalPaths` が明示追加している静的ページ（`/about/` `/contact/` `/faq/` `/privacy/`
`/st-league/about/` `/growth/` `/growth/<slug>`）が自動列挙とも重なり、`<loc>` が8件二重に
出ていた。`additionalPaths` 側を削ると、バージョン差で自動列挙から漏れたときに気づけない
（元のコメントは「純粋な静的ページは自動列挙されない」と書いていたが、実測では列挙されていた）。
そこで **明示追加は残したまま、`sort-sitemaps.mjs` で1件にまとめる**。残す1件は `<lastmod>`
を持つほうを優先する。

## 新規ページ追加時の運用

新しい公開ページ種別を追加するときは、既存ページ種別とのキーワード/検索意図の重なりを本ページの重複マップに追記し、制御手段（インテント分割 / canonical / noindex / 内部リンク集約）を1つ選んで明記すること。

**noindex を選んだときは、そのページへの内部リンクが何枚あるかを必ず数えること**（#3 追記3）。
「`noindex, follow` だから link equity は残る」は、そのページに内部リンクが集中している場合には
成り立たない。リンク元を index 側のページへ振り替えるところまでが対策の一部。
数え方は生成済み `out/` に対する `grep -rl 'href="<パス>"' out --include="*.html" | wc -l`。

## Open Questions

- **#3 / #7 / #10 の GSC 事後検証は [高校SEO M4検証ランブック](./highschool-seo-m4-verification.md) に手順化済み（2026年8月中旬に実行）**
- #3 集中先（高校歴代ページ）が対象クエリで実際に上位を取れているかの GSC 事後検証。取れていなければインテント分割の見直し、または集中先の再判断
- #3（2026-08-06 追記）内部リンク振り替え後、選手ページ→高校歴代ページのリンクが実際に
  クロール・評価されるか（GSC の参照元ページと歴代ページの表示回数）。および title 変更後の
  SERP タイトルが書き換えられずに出るか。計測は8月中旬の M4 検証と同じタイミング
- #3（2026-08-06 追記）内部リンクが直接入るようになった結果ほぼ孤立する汎用ハブ
  （被リンク25枚程度）に、`noindex` のまま残す意味があるか
- #7 高校メンバー系クエリの受け皿を学校ページに一本化すべきか
- #8 result 廃止・301 後の評価移行（集約先のハブ／高校歴代ページが対象クエリで受けているか）と、preview×ハブの棲み分けを GSC で確認
- #11 大会期間中の日次更新が実際にクロールされるか（lastmod 修正後の再クロール頻度）。
  更新してもクロールが来なければ鮮度シグナルは効かないため、まずインターハイ2026で観測する
- #11（2026-08-01 追記）会期中に更新した3種のページ（ハブ／都道府県94枚／学校243枚）が
  「{通称}{年}」系クエリで実際に表示を取れたか。取れていなければ title の出し方を見直す。
  計測は [高校SEO M4検証ランブック](./highschool-seo-m4-verification.md) と同じタイミング（8月中旬）
- #11 1日1回のビルド・デプロイの運用コスト。`prebuild` が全大会の player stats を再生成するため
  重い。大会期間中だけ差分ビルドにする余地があるかは未検討
