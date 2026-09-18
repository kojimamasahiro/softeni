# 開催前の大会・国際大会の露出 実行ランブック

> **適用範囲: 混在**。「新規URLを作らず既存ページで受ける」「開催前の大会を出す」の考え方は汎用。
> アジア競技大会2026の運用はソフトテニス固有。
> **2026-09-18 に現在の仕様と残作業だけへ圧縮した。** 完了項目の実施内容・実測値・検算は
> [raw/2026-09-18-wiki-archive-upcoming-tournaments-runbook.md](../raw/2026-09-18-wiki-archive-upcoming-tournaments-runbook.md)。

## これは何か

「開催前の大会を出す」（[public-pages.md](./public-pages.md)）の**残作業を順番つきで実行するための一覧**。
出発点は「アジア大会が選手にとって大舞台なのにファンに伝わっていない」という外部の声で、
第1弾で作ったのは pull（探しに来た人が見つけられる）まで。元の問題は awareness なので push を足していく。
背景と実測は [raw/2026-07-26](../raw/2026-07-26-idea-tournament-metadata-platform.md) 追記6〜9。

**新規 URL は作らない。** 既存ページの更新で取る（[seo.md](./seo.md) #11 と同じ考え方）。
検索需要のピークは会期直前〜会期中なので、会期の1週間前までに出ていないと間に合わない。

## いま動いているもの: アジア競技大会2026（9/18〜23・名古屋）

### S11 会期中の結果取り込み（方式A）

**取り込む範囲**（ユーザー判断）: **日本選手が出た試合だけ**。相手は名前と国だけ持つ。
ただし**日本が入っている予選リーグの組は、日本が出ない試合も含めて全試合持つ**
（組の星取表と順位を試合から出すため）。日本がいない組は持たない。
全試合を取り込み外国選手も選手として持つ案（方式B）は、選手ページ・ランキングへの影響が大きいので会期後に判断する。

**表記**:

- **日本選手は国内大会と同じ id**（例: `上松_俊貴_NTT西日本_広島県`）。既存の選手ページに直接つながる。
  対応表は `tools/asian-games-2026/build_details.py` の `JAPANESE_PLAYERS`
- **外国選手**は公式のローマ字（姓は大文字のまま）、`team` に**国名（日本語）**、`prefecture: null`
  （例: `DOEUM_Samsocheaphearun_カンボジア`）。コリアカップのような国コードは使わない
- **団体戦のチーム名は国名（日本語）**。チームマスタにも国名のチームとして載る
- **ランキングから除外**: `data/ranking-config.json` の `excludeTournaments` に `asian-games` を追加済み
  （[ranking.md](./ranking.md)「国際大会の除外」と同じ理由）

**手順**: 公式リザルトサイト（results.asiangames2026.org。PDF ではなく SPA）→ `tools/asian-games-2026/draw.json` に転記
→ `build_details.py` → `data/tournaments/details/asian-games/2026/*.json`。
スクリプトは「組が総当たりとして完全か」「各組に日本がいるか」を検査して、食い違えば止まる。
結果が入る前の成績は `rank.kind: ongoing`（ADR-007）。

**注意**: `details/` に大会フォルダが増えると高校データパイプラインの鮮度チェック（prebuild）が落ちる。
`npm run highschool:pipeline` を流して解消する（コリアカップと同じ）。

**状態**: 組み合わせは取り込み済み（2026-09-18。日本がいる組は全試合）。結果は会期中に入れる。
**決勝トーナメントはまだ持っていない**（席順 `knockoutDraw`（ADR-015）が公式に出ていない）。

**会期中にやること**:

- 公式サイトの日程を見直し、変わっていれば `information/asian-games.json` の `categories[].schedule` と
  `scheduleCheckedOn` を更新する
- 決勝トーナメントの持ち方（日本が出る試合だけか、席順ごと持つか）を決める
  → [open-questions.md](./open-questions.md)
- 結果の入れ方（`draw.json` を日ごとに更新して組み直すか、別の入力手順を作るか）を決める

### 種目別の日程（S10・実装済み）

会期だけでは「いつ見ればいいか」が分からないため、種目ごとの日程（決勝の開始時刻まで）を出している。

- データ: `information/asian-games.json` の `categories[].schedule` ＋ `scheduleSource` /
  `scheduleSourceUrl` / `scheduleCheckedOn`（形は [data-model.md](./data-model.md)）。`categories` の並びも日程順
- 表示: 大会ハブの開催前ブロックに「種目別の日程（予定）」表（`SportsEvent.subEvent` に日付）と、
  代表選手の選手ページ（出場種目だけ）。整形は `lib/categorySchedule.ts`
- **出典に無い日は書かない**（予定であって実績ではない）。実際 9/19 は公式に日付タブ自体が無く、
  団体B〜D組の日程は不明なので書いていない

## 残作業

| # | 何を | なぜ |
|---|---|---|
| S5 | 前回大会（杭州2022）の結果を入れる | 「前回はほぼ全種目で金」は stakes の材料になる。**「過去の国際大会は遡らない」方針の、前回1件だけの例外**として検討 |
| S6 | `information` の未来レコードを補充（31件中9件しかない） | インターハイ・全中を含む主要大会の次回開催が未入力で「これから開催」に出ない |
| S7 | 未来大会の `venues` を補充（未来9件中2件しかない） | 開催前ブロックの会場欄が空になる |
| S8 | `world-championship` / `asian-championship` の本大会を登録 | 予選会だけある状態。登録すれば**命名規約により自動で相互リンク**される（コード変更不要） |

- 状態の確認は `npm run check:upcoming`（[1] 本大会の欠落 / [2] 未来レコード / [3] venues / [4] 代表名簿の氏名解決 / [5] 日程）。
- S6 の入れ方は `tournament-venue-data` スキルの手順。一次ソースは `t_records/{年度}/{年度}_taikai_alle.pdf`、
  作業用の断片は [venue-input-worksheet.md](../venue-input-worksheet.md)。
- **中止（`status: 'cancelled'`）の年は未来レコードとして数えない**。数えると次回の行を足し忘れても [2] に出なくなるため。

## やらないと決めたこと

| 項目 | 理由 |
|---|---|
| `isMajorTitle` の変更 | `resolveTier()` / 主要タイトル数 / **Elo の K値** / ニュースの注目選手ピック / 実績の並び順に効き、全選手のランキングが静かに動く。国際大会を「主要」扱いしたいなら**別フラグ**を立てる（ADR 相当の判断） |
| 過去の国際大会の全面的な遡り | S5（前回1件）だけを例外として検討する |
| 「これから開催」の独立ページ化 | まず既存面で効果を見る |
| 予選会2025を1カテゴリへ統合する | スキーマに「フェーズ」の概念が無く、統合すると `group` が衝突する。既存6ページの URL も消える |

**日本代表名簿を当サイトが名乗ること**は 2026-09-08 に解除した（S9）。当サイトのデータから代表を導出しない
方針は変えず、**JOC の発表の転記として**持ち込む形にした。出典・発表日をデータに必須で持たせ、描画側で必ず併記する。
名簿に無いこと（混合ダブルスのペア構成）は足さない。データの形は
[data-model.md](./data-model.md)「代表名簿（`delegations`）」、表示は [public-pages.md](./public-pages.md)。

## 実装済みのもの（要点だけ）

| # | 内容 |
|---|---|
| 第1弾 | アジア大会の登録・開催前ブロック・関連する大会・「これから開催」・`SportsEvent` JSON-LD・`check:upcoming`（2026-08-25） |
| M1 | 予選会2025の順位データ投入。規約「段階分割された大会では、**最終成績は決着したカテゴリだけが持つ**」（[data-model.md](./data-model.md)）に沿う。進出者の判定は順位ではなく**次のカテゴリの entries に居るか**で行う。検査 `npm run check:placements` |
| M2 | 進出率の分母から `placement: unknown` を除外（`lib/playerStats/aggregators/reachRates.ts`、`ENGINE_VERSION` 1.7.0）。**未開催の大会の出場者の進出率が不当に下がっていた**ため。仕様は元から正しく実装だけが漏れていた |
| S1 | 選手結果ページに「これから開催される国際大会」ブロック（`lib/upcomingInternational.ts` / `PlayerUpcomingInternational.tsx`）。**`/players/[id]` プロフィール側には未適用** |
| S2 | 大会ハブに予選会上位者を通算成績つきで表示（`lib/qualifierFinishers.ts`）→ S9 で代表名簿に差し替え |
| S3 | トップページに「これから開催」5件（共有コンポーネント `UpcomingTournaments.tsx`） |
| S4 | `/tournaments/major/` に開催前の大会を含める。**STリーグは結果があるのに一覧から抜けていた**のを解消 |
| S9 | 公式の代表名簿で S1・S2 を置き換え（`data/tournaments/delegations/asian-games-2026.json` / `lib/delegation.ts` / `DelegationSection.tsx`）。検査 `check:upcoming [4]` |
| S10 | 種目別の日程（上記）。検査 `check:upcoming [5]` |

テストは `npm run upcoming:test`（21件）。

## 関連

- [public-pages.md](./public-pages.md) — 「開催前の大会を出す」の仕様・表示条件
- [data-model.md](./data-model.md) — `venues` / `delegations` / `schedule` の形
- [seo.md](./seo.md) — 新規 URL を増やさず既存ページで受ける方針
- [ranking.md](./ranking.md) — 国際大会の除外
- [ADR-016](../adr/ADR-016-manual-adsense-units-over-auto-ads.md) — 広告枠と「これから開催」の上下関係
- [raw/2026-07-26](../raw/2026-07-26-idea-tournament-metadata-platform.md) — 経緯・実測データ（追記6〜12）
