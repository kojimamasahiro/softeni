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
- **略称クエリの集約（2026-06）**: 「ハイジャパ」（ハイスクールジャパンカップの通称）など略称での検索を、専用タグページを作らず `/highschool/tournaments/japan-cup` ハブ1枚に集約する。競合（ソフトテニスマガジン）は記事タイトルへの literal「【ハイジャパ】」＋ `/tag/ハイジャパ/` で略称を取っているが、当サイトで別 URL を作ると #3 の集中方針に反し薄いページを増やすため採らない。代わりに略称を `HsNationalTournamentMeta.aliases` に持たせ、ハブ側の title・h1・meta description・FAQ（「『ハイジャパ』とは？」）に literal で1〜2回出して exact 一致を取る。差別化は「ハイジャパ 歴代 優勝」等のロングテール（DB由来の歴代記録）で行う。
  - 実装: `lib/highschoolNationalTournaments.ts`（`aliases`）、`src/pages/highschool/tournaments/[tournament]/index.tsx`（headingName・description・FAQ）、`src/pages/highschool/tournaments/index.tsx`（入口の通称表記）
- 状態: **対策済（先行集中・監視継続）**。GSC が取れ次第、集中先が正しいか（高校歴代ページが対象クエリ・略称クエリで上位を取れているか）を確認する
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
- 状態: **監視**（粒度が近いため、メンバー系クエリで学校ページに集約できているか要観察）。**Assumption**

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
- 未決: 都道府県ページ title に「強豪校」を含めた（2026-07-17）ため、「{県名} 高校 ソフトテニス 強豪」の受け皿が 2 URL になりうる。ランキングは全国軸・都道府県ページは県内一覧軸のインテント分割とするが、GSC で分散が見えたら見直し。**Assumption**
- 状態: **監視**（新設。GSC で「強豪」「ランキング」系クエリの獲得と #7 との分散を確認）
- 詳細: [highschool.md](./highschool.md)、[raw/2026-07-17-idea-highschool-strong-school-ranking.md](../raw/2026-07-17-idea-highschool-strong-school-ranking.md)

## 新規ページ追加時の運用

新しい公開ページ種別を追加するときは、既存ページ種別とのキーワード/検索意図の重なりを本ページの重複マップに追記し、制御手段（インテント分割 / canonical / noindex / 内部リンク集約）を1つ選んで明記すること。

## Open Questions

- #3 集中先（高校歴代ページ）が対象クエリで実際に上位を取れているかの GSC 事後検証。取れていなければインテント分割の見直し、または集中先の再判断
- #7 高校メンバー系クエリの受け皿を学校ページに一本化すべきか
- #8 result 廃止・301 後の評価移行（集約先のハブ／高校歴代ページが対象クエリで受けているか）と、preview×ハブの棲み分けを GSC で確認
