# Highschool Pages（高校カテゴリ）

高校カテゴリの公開ページ方針と、全国大会の歴代記録ページの現状仕様。
高校カテゴリの URL 一覧と公開面全体の構成は [public-pages.md](./public-pages.md)「ルーティング」を参照。
SEO カニバリ集中（高校歴代へ寄せる方針）は [seo.md](./seo.md) #3。
実装のページ別処理解説は `docs/highschool-pages.md`（ルート直下）にある。

## 高校カテゴリの公開ページ方針

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

## 高校 全国大会の歴代記録ページ（2026-06 追加）

対象 URL: `/highschool/tournaments`（入口）、`/highschool/tournaments/[tournament]`（大会別）。

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
