# 2026-08-06 「歴代」クエリの順位差調査（インターハイ #7 vs 全日本シングルス #3）

## きっかけ

インターハイ開催中に「歴代」ワードでの検索順位を確認したところ、
全日本シングルスが3位前後なのに対しインターハイは7位前後だった。
「開催中だから順位が落ちているのでは」という仮説の検証から入った。

結論から言うと**開催中モードの影響はあるが主因ではない**。主因は内部リンクの流れ方。

## 計測（すべてビルド済み `out/` の実測。2026-08-06 時点のビルド）

### 1. 内部リンク: 汎用ハブ（noindex）に9割が吸われていた

`href="..."` の完全一致で数えた被リンクページ数:

| リンク先 | 被リンク数 | robots |
|---|---|---|
| `/tournaments/highschool/highschool-championship/`（汎用ハブ） | **1,111** | **noindex, follow** |
| `/highschool/tournaments/championship/`（歴代記録・集中先） | **194** | index |
| `/tournaments/all/zennihon-singles/`（全日本シングルス） | **1,929** | index |

1,111 の内訳は `players/` 1,084・`tournaments/` 25・`news/` 1・トップ 1。

seo.md #3 は「汎用ハブは `noindex, follow` にするので link equity は残り、
誘導バナー経由で高校歴代ページへ流れる」という前提で設計されていた。
しかし実際には**サイト全体の内部リンクの大半が noindex ページを1ホップ挟む**構造で、
`follow` でも長期 noindex のページはクロール頻度が落ちるため前提が崩れていた。

全日本シングルスは同じ役割のページが index なので、1,929枚の内部リンクが
順位の付くページに直接入っている。**この差が両者の最大の構造差**。

### 2. title: 「歴代」が SERP の表示範囲外

日本語 SERP のタイトル表示は概ね30字。「歴代」の開始位置:

| ページ | 全長 | 「歴代」開始位置 |
|---|---|---|
| IH（開催中モード・当時の本番） | 58字 | **40字目** |
| IH（通常モード） | 62字 | 28字目 |
| 全日本シングルス | 41字 | 17字目 |

開催中モード（seo.md #11）は意図的に「{通称}{年} 結果・途中経過」を先頭に立てる設計で、
これ自体は会期中の判断として正しい。問題は**そのあとに正式名称 `label`（12字）を挟んでいた**
ことで、これが「歴代」を40字目まで押し出していた。通常モードの28字目も余裕がない。

### 3. 「歴代」の実体が6年分しかない

`data/tournaments/details/highschool-championship/` は 2021〜2026 の6大会のみ。
zennihon-singles は 2022〜2026 の5大会。**年度カバレッジはほぼ同じ**。

にもかかわらず順位が違うのは競合の厚みの差:

- インターハイ「歴代」の競合: [埼玉県高体連の全国大会記録](http://www.saitama-hs-softtennis.com/old/kiroku/zenkoku.htm)（全年度）、
  [YouTube「団体戦 歴代優勝校 2019-1989」](https://www.youtube.com/watch?v=iLHlP6S6U9g)（31年分）、
  [shindeme.com の都道府県別 歴代出場校](https://www.shindeme.com/sports/t0092/tokyo/)、ソフトテニスマガジン
- 全日本シングルス「歴代」の競合: Wikipedia と個人ブログ程度

つまり**全日本シングルスの3位はページの出来ではなく競合の薄さ**で、
「シングルスと同じ作りにすれば7位が3位になる」という読み方は誤り。
インターハイ側で6年しか無いことは、競合が30年以上を持っている以上、
「歴代」インテントに対する構造的な不足として残る。

- 可視テキスト量は IH 3,797字 / シングルス 1,012字 で **IH のほうが厚い**。
  コンテンツ量の問題ではない。

## 実施した対策（2026-08-06）

### A. 内部リンクを歴代記録ページへ振り替え（#1 への対策）

`lib/highschoolNationalTournamentMeta.ts` を新設し、`getTournamentHubHref(generationId, tournamentId)`
を唯一の入口にした。高校全国大会（3大会）のみ `/highschool/tournaments/{slug}/` を返す。

メタ定義（型・`HS_NATIONAL_TOURNAMENTS`・`getHsNationalSlugByTournamentId`）を
`lib/highschoolNationalTournaments.ts` から切り出したのは、あちらが冒頭で `import fs` していて
サーバー専用のため、クライアントにも載る `TournamentCard` から import できないから。
サーバー側モジュールは新モジュールを **re-export** しており、定義は二重管理していない。

振り替えた箇所（ハブ URL のベタ書きを全廃）:

- `src/components/PlayerStatisticsSections.tsx`（選手ページ1,084枚の主犯）
- `lib/majorTitles.ts`
- `src/components/tournaments/TournamentCard.tsx`
- `src/pages/index.tsx`（トップの最新大会カード）
- `src/pages/players/[id]/index.tsx`（curated 選手プロフィールの主要タイトル）
- `lib/newsArticle/index.ts`（preview 記事のハブ導線）

**振り替えなかった箇所**と理由:

- `src/pages/tournaments/[generation]/[tournamentId]/index.tsx:87` の `pageUrl` — ハブ自身の
  canonical。変えると self-canonical が壊れる
- 同 `:172` のパンくず — ハブ自身のパンくず
- 年度別結果ページ（`.../[gender]/index.tsx:157`）のパンくず — URL 階層上の親を指すのが
  パンくずの意味で、BreadcrumbList 構造化データにも出る。該当は25枚と量も小さいため
  リスク対効果が合わない。効果が欲しくなったら別途判断する

### B. title で「歴代」を先頭30字以内に入れる（#2 への対策）

title の頭を正式名称（`headingName`）から短い通称（`shortLabel`）に変更し、
正式名称は後半へ。収録年度（`（2021〜2026年度）`）と次回開催予定は title から外し、
description・FAQ に置いた（どちらも30字より後ろにあり SERP に出ていなかった）。
収録年度は歴代クエリの利用者に「6年分しか無い」と SERP 上で先に伝える面もある。

略称の併記（ハイジャパ）は**通常モードのみ**。開催中モードは先頭に
「{通称}{年} 結果・途中経過」が入るため、併記すると「歴代」が40字目に戻ってしまう。
開催中でも略称は h1・description・FAQ に literal で出ているので取りこぼさない。

検算結果（3大会 × 2モード）:

| 大会 | モード | 全長 | 「歴代」位置 | 判定 |
|---|---|---|---|---|
| championship | 通常 | 48 | 14 | OK |
| championship | 開催中 | 44 | 26 | OK |
| japan-cup | 通常 | 49 | 28 | OK |
| japan-cup | 開催中 | 51 | 33 | **NG（許容）** |
| senbatsu | 通常 | 51 | 12 | OK |
| senbatsu | 開催中 | 42 | 24 | OK |

japan-cup の開催中モードだけ33字目になる。正式名称が13字あり、
「{通称}{年} 結果・途中経過」と「歴代」を30字に両立できない。
ハイジャパの会期は6月で歴代クエリの需要ピークとずれること、
会期中は結果インテントを優先するのが #11 の判断であることから**許容**とした。

### 検算

- `npx tsc --noEmit` — エラーなし
- `npx eslint`（変更9ファイル） — 0 errors（warning はサンドボックスの
  native binding 解決失敗で、コード起因ではない）
- 全29大会に `getTournamentHubHref` を適用し、**3大会が歴代ページへ振替・26大会は従来どおり**、
  かつ**リンク先の生成済み HTML が全て存在**することを確認（デッドリンク0）

## 未実施（効果の天井は一番高い）

**歴代優勝校の年度拡張**。対戦表データなしの champions-only レイヤー
（年 / 優勝 / 準優勝）を足せば「歴代」の実体を作れる。先例は
`src/pages/st-league/champions.tsx`。出典の確保（高体連の記録ページ等）と
検算が必要なため別セッション扱い。

A・B は「取りこぼしを塞ぐ」対策で、競合が30年持っているのに対して
6年しか出せない構造そのものは解消していない。順位が上がりきらない場合の
次の一手はこれになる。

## Open Questions

- A の振り替え後、選手ページ→歴代ページの内部リンクが実際にクロール・評価されるか。
  GSC の「参照元ページ」と歴代ページの表示回数で確認する（[高校SEO M4検証ランブック](../wiki/highschool-seo-m4-verification.md) と同じ8月中旬のタイミング）
- B の title 変更後、「インターハイ 歴代」の SERP タイトルが書き換えられずに出るか
- 汎用ハブの `noindex` 自体を見直すべきか。A で内部リンクが歴代ページへ直接入るようになったため、
  汎用ハブへの被リンクは25枚程度まで落ちる。noindex を維持する前提（カニバリ回避）は変わらないが、
  「ほぼ孤立した noindex ページ」を残す意味があるかは要検討

## Compile Log（2026-08-06）

docs/wiki/seo.md #3 に追記3（内部リンク）・追記4（title）・未実施施策（年度拡張）として compile 済み。
あわせて「新規ページ追加時の運用」に、noindex を選ぶときは被リンク数を数える、という
再発防止ルールを追加した。

**意図的に wiki へ載せなかったもの**:

- 個別ファイルの行番号（`PlayerStatisticsSections.tsx:205` 等） — コード変更で陳腐化する。
  wiki には関数名（`getTournamentHubHref`）とモジュール名のみ残した
- 競合サイトの個別 URL 一覧 — 本 raw に残す。wiki には「30年以上を持つ競合がいる」という
  判断の根拠だけを1行で要約
- 可視テキスト量の計測手順（HTML から script/style を除去して字数を数える python） — 一度きりの
  計測で、再現手順として wiki に載せるほどの汎用性がない。数値だけ wiki に転記
- `tsc` / `eslint` の実行結果 — 通常の検算で、恒久的な情報ではない
- 「開催中だから順位が落ちているのでは」という当初仮説の検証過程 — 結論（影響はあるが主因ではない）
  のみ wiki に反映。仮説の経緯は本 raw に残す
