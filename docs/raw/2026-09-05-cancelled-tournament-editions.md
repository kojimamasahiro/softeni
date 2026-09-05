# 中止（開催されなかった回）を大会一覧・年表に出す

実施日: 2026-09-05
種別: データモデル追加＋UI＋データ投入
対象: `data/tournaments/information/*.json`（`status: 'cancelled'`）、`/tournaments/`、
大会ハブ（`/tournaments/[generation]/[tournamentId]`）、高校全国大会の歴代記録ページ
発端: ユーザー発言「大会一覧で中止の場合を考慮できるようにしたい。2020年や2021年は
ナンバリングは進んで中止の大会がいくつかある」

---

## 1. 何が問題だったか

コロナ禍（2020・2021年度）に中止になった全国大会は、**回次（第N回）だけが進んでいる**。
当サイトは結果（`details/`）がある年しかページに出さないため、年表がこうなっていた。

| 大会 | サイト上の並び | 実際 |
|---|---|---|
| 天皇賜杯・皇后賜杯 全日本選手権 | 2019（第74回）→ 2022（第77回） | 第75回・第76回は中止 |
| 全日本シングルス | 2019（第26回）→ 2022（第29回） | 第27回・第28回は中止 |
| 全国中学校大会 | 2019（第50回）→ 2021（第52回） | 第51回は中止 |
| 全日本ミックスダブルス | 2021（**第2回**）から始まる | 第1回（2020）は中止 |

**回次の飛びと年の飛びが、読者から見て「未収録」と区別できない**のが問題。
とくに全日本ミックスは「なぜ第1回が無いのか」がどこにも書かれていない状態だった。

## 2. 決定（ユーザー確認済み）

3点を聞いて合意した。

1. **出す場所**: 大会一覧（`/tournaments/`）、大会ハブの「年度別結果」、歴代優勝者の表。
2. **連覇判定は現状維持**。中止年をまたぐ連続優勝（2019優勝→2022優勝）は連覇にしない。
   → **成績系のコードは一切触らない**という制約になった（下記 3 の設計に直結）。
3. **データは確認できる全国大会すべて**。既存データの前後から確実に特定できるものを入れる。

## 3. 設計

### データの持ち方: `information` の年エントリに `status: 'cancelled'`

```jsonc
{
  "year": 2020,
  "location": "愛知県",          // 中止時点の開催「予定」地。実績ではない
  "startDate": "2020-10-23",     // 同上
  "endDate": "2020-10-25",
  "source": "公益財団法人 日本ソフトテニス連盟",
  "sourceUrl": "https://www.jsta.or.jp/result/result2020",
  "label": "第75回 天皇賜杯・皇后賜杯 全日本選手権大会",
  "categories": [],              // 1種目も実施されていない
  "status": "cancelled",
  "note": "…（公開しないメモ。理由と、日程・会場が予定である旨、出典）"
}
```

`details/` 側には**何も作らない**。中止は「試合結果」ではなく大会運営上の事実なので、
[打ち切り（`abandoned`）](./2026-07-26-abandoned-tournament-ui-design.md) と同じ理由で
`information` が置き場所として正しい。

**打ち切り（`abandoned`）との違いを明確に分ける**:

| | 打ち切り `abandoned` | 中止 `cancelled` |
|---|---|---|
| 粒度 | カテゴリ（`categories[].status`） | 年（エントリ自体の `status`） |
| 実施 | 途中まで実施され成績が残る | 1試合も行われていない |
| 成績への影響 | ベスト8等として集計に入る | 一切入らない（`details` が無い） |
| 連覇 | 開催年として数え、優勝者なしで連覇が切れる | 年表にだけ存在（判定に入らない） |

理由フィールドは**持たない**（打ち切りと同じ判断。`note` に入力メモとして残すが公開しない）。

### 「成績側に入れない」を構造で担保する

決定2（連覇は現状維持）を守る最も確実な方法は、**中止年を成績系のデータ構造に一切混ぜない**こと。
`champions` / `yearGroups` / `championRows` は従来どおり `details/` 由来のままにして、
中止年は**別の配列**（`cancelledYears` / `cancelled`）で渡し、**描画時にだけ年で合流**させた。

これにより:

- `lib/tournamentRecords.ts` の `computeRepeatChampion`（開催年間隔チェックを含む）は無変更。
- `lib/milestones.ts`（`○年ぶりN回目` / `N連覇`）も無変更。2019→2022 は従来どおり「3年ぶり2回目」。
- `lib/playerStats` は `details` を起点に読むので、そもそも中止年に触れない。
- 歴代優勝者の JSON-LD（`ItemList`）は `championRows` から作るので、中止年は構造化データに出ない。

### 「開催予定」と誤認させない（この変更で一番危なかった所）

中止エントリは**過去日付だが `endDate` を持つ**ので、「会期が終わっていない＝開催予定」という
既存判定に素通しで入ると「開催予定」として出る。実際に危なかったのは3経路。

| 経路 | 放置した場合 |
|---|---|
| `/tournaments/` の「これから開催」 | 中止の回が候補に混ざる（過去日付なので描画側で落ちるが、判定の前提が崩れる） |
| 大会ハブの「開催前」ブロック | 同左 |
| **高校全国大会の歴代記録ページ `upcoming`** | **日付を見ていない**ため 2020 が「開催予定」として並び、さらに `SportsEvent` の JSON-LD が `eventStatus: EventScheduled` で出る＝**構造化データに嘘が入る** |

3経路すべてで `isCancelledEntry()` を通して除外した。3つ目は日付条件が無いので実害が確実だった。

判定は `lib/tournamentCancellation.ts`（`isCancelledEntry` / `CANCELLED_LABEL`）に集約した。
述語を各所に手書きコピーすると片方だけ直って矛盾する（[連覇の不具合](./2026-09-05-repeat-title-team-change.md)
の学び）ため、1関数に寄せている。

### 表記

- バッジ・セルは「中止」の一語。理由は書かない。絵文字なし（AGENTS.md）。
- 日程・会場は**実績と同じ書き方をしない**。実績は「開催地: / 日程:」、中止は「開催予定: 〜 / 県名」。
- 年表の本文は「第75回 … は中止となり、開催されませんでした。」＝回次を明示する
  （回次の飛びを説明するのがこの変更の目的なので、ここで label を出す）。

## 4. 投入したデータ（14件）

出典は日本ソフトテニス連盟の年度別大会結果一覧（結果欄が「中止」と明記されている）。
日程・会場は**中止時点の開催予定**。

| 大会 | 年 | 回次 | 開催予定 |
|---|---|---|---|
| zennihon-championship | 2020 / 2021 | 第75回 / 第76回 | 愛知県一宮市 / 和歌山県和歌山市 |
| zennihon-singles | 2020 / 2021 | 第27回 / 第28回 | 石川県金沢市 / 福島県棚倉町 |
| zennihon-mixed | 2020 | 第1回 | 大分県大分市 |
| zennihon-indoor | 2020 / 2021 | 第66回 / 第67回 | 大阪府大阪市（2021-02-07 / 2022-01-23） |
| zennihon-workers | 2020 / 2021 | 第48回 / 第49回 | 滋賀県長浜市 / 広島県広島市他 |
| zennihon-primaryschool | 2020 / 2021 | 第37回 / 第38回 | 福岡県福岡市他 / 千葉県白子町 |
| secondaryschool-championship | 2020 | 第51回 | 静岡県浜松市 |
| highschool-championship | 2020 | 令和2年度 | 京都府福知山市 |
| highschool-japan-cup | 2020 | 第49回 | 北海道札幌市 |

出典: <https://www.jsta.or.jp/result/result2020> / <https://www.jsta.or.jp/result/result2021>

### 入れなかったもの（意図的）

**選定規約: 中止年が既存の収録範囲と地続きの大会だけ入れる。**
JSTA の一覧には他にも中止の全国大会があるが（東日本・西日本・全日本実業団・全日本学生・
全日本ジュニア・全日本シニア・全日本クラブ・都道府県対抗全日本中学生・アジア選手権予選会 など）、
これらは収録が2022年度以降・2025年度以降からで、間の年も収録していない。
そこに2020年度だけ「中止」の行を挿すと、**未収録の年と中止の年が混在**して
かえって「2021年は開催されたのか？」が読めなくなる。収録範囲が伸びた時点で足す。

`asian-games-qualifier` の 2023・2024 の欠けは中止ではない（4年周期の予選会なので回次も
2022=第19回 → 2025=第20回 と1つしか進んでいない）。**年の飛び＝中止ではない**ことの実例。

## 5. 変更ファイル

| ファイル | 内容 |
|---|---|
| `lib/tournamentCancellation.ts` | 新規。`isCancelledEntry` / `CANCELLED_LABEL` |
| `src/types/tournament.ts` | `TournamentInformationEntry.status?: 'cancelled'` |
| `data/tournaments/information/*.json` | 9大会14件の中止エントリ（上表） |
| `src/pages/tournaments/index.tsx` | `TournamentInstance.cancelled`。中止は結果導線を作らない |
| `src/components/tournaments/TournamentSearchTable.tsx` | 「中止」バッジ（日付判定より優先）・結果列の「中止」・「これから開催」から除外 |
| `src/pages/tournaments/[generation]/[tournamentId]/index.tsx` | `cancelledYears` prop。年度別結果へ合流、歴代優勝者表の列、開催前ブロックから除外 |
| `lib/highschoolNationalTournaments.ts` | `TournamentRecords.cancelled`。`upcoming` から除外（JSON-LD の誤りを防ぐ） |
| `src/pages/highschool/tournaments/[tournament]/index.tsx` | 歴代優勝者表の列・年度別の記録に「中止」 |
| `src/pages/index.tsx` | トップの「これから開催」から除外 |
| `scripts/check-upcoming-tournaments.mjs` | 中止年を「未来レコードあり」と数えない |

## 6. 検証（dev サーバ実機）

- `/tournaments/?year=2020` → 10件中9件が「中止」バッジ＋結果列「中止」。
  `?year=2021` → 中止5件。結果ページへのリンクは1本も張られない。
- `/tournaments/all/zennihon-championship/` → 歴代優勝者表に 2021・2020 の列が出て
  男女とも「中止」。年度別結果は 2022 → **2021（中止）→ 2020（中止）** → 2019 の順に並ぶ。
- `/tournaments/all/zennihon-mixed/` → 2020（第1回・中止）が最古の行として出る
  （収録範囲より古い年が中止で足される唯一のケース）。
- `/highschool/tournaments/championship/` → 表に2020列「中止」、`y2020` セクションに
  「令和2年度 全国高等学校総合体育大会は中止となり、開催されませんでした。開催予定: 2020年8月5日〜8月12日 / 京都府」。
- `/highschool/tournaments/japan-cup/` → `upcoming` が空のまま（＝2020が開催予定に化けていない）、
  `SportsEvent` の JSON-LD は0件。
- `npx tsc --noEmit` / `npx eslint`（絵文字ルール含む）クリーン。
- `node scripts/check-tournament-entries.mjs` / `check-tournament-insights.mjs` / `check-upcoming-tournaments.mjs` 問題なし。

### 既知の失敗（この変更とは無関係）

`scripts/verify-abandonment.ts` が1件 FAIL する。
`highschool-championship/2026/doubles-none-girls` の coverage を `not_recorded` と期待しているが、
**その後インターハイ2026の結果が投入されて `completed` になった**ため。
2026-07-19 の検証表をそのまま固定値で持っている箇所で、期待値が古い。
中止対応の前後で挙動は変わらない（`information` に `status` を足しただけでは coverage 判定は動かない）。

## 6.5 追記（同日）: 年度切り替えが未開催年の 404 を指していた

ユーザー報告「まだ未開催の大会が404になった
（`/tournaments/all/zennihon-championship/2026/doubles/none/boys/`）」「大会結果ページに
2026の切り替えボタンが表示され、リンクが残っている」。

**中止対応とは別の既存バグ**だった。年度別結果ページの「年度を切り替え」「カテゴリを切り替え」の
候補（`linkCategories`）が **`information` だけ**から作られていた一方、このルートの
`getStaticPaths` は **`details/` を走査して `fallback: false`** なので、
「information にあるが結果が無い年・種目」のボタンが 404 を指していた。

中止の回は `categories: []` なので**この経路に新しい 404 は増やしていない**（結果的に、
中止年を「年エントリだけ・種目は空」で持つ設計がここでも効いた）。

修正: `linkCategories` を **`details/<tid>/<year>/<categoryId>.json` が実在する種目だけ**に絞った
（`[gender]/index.tsx` の `getStaticProps`）。フォールバック（完全一致→同カテゴリ同性別→…→先頭）
の遷移先も実在する種目からしか選ばれなくなる。

実測で該当していたのは7件（大会/年）:

| 大会/年 | 種目 | 何だったか |
|---|---|---|
| zennihon-championship/2026 | 男女ダブルス | 開催前（会期2026-11） |
| asian-games/2026 | 5種目 | 開催前 |
| st-league/2023〜2025 | 男女団体 | 結果が `/st-league/` 側にある（`resultPath`） |
| zennihon-primaryschool/2025 | 男女 versus | 結果未投入 |
| qualifying-miyazaki-indoor/2025 | 男子ダブルス | 結果未投入 |

**データ側の誤記も1件見つけて直した**: `primaryschool-championship/2024` の
`categoryId: "doubles-5thgrade4-boy"`（末尾の `s` 落ち）。`details` 側は
`doubles-5thgrade4-boys.json` なので、**カテゴリ切り替えの「男子4年生以下5位トーナメント」が
404 を指し、逆にその結果ページはラベルを引けていなかった**。修正後は 200 でラベルも出る。

**未開催年に年度別URLを作るかは変えていない**。`/tournaments/[…]/[year]/…` は結果がある年だけの面で、
開催前の日程・会場はハブの「開催前」ブロックが受ける（2026-08-25 の「新規URLは増やしていない」
決定どおり）。切り替えボタンが消えるだけで、未開催の情報はハブから辿れる。

## 6.6 追記（2026-09-06）: 選手ページの「主要タイトル」に中止が出ていなかった

ユーザー指摘「選手結果ページの『主要タイトル』のコンテンツには中止と表示されないのか？」。

**出ていなかった。しかも中止年の列が `ー` で増えていた**（＝この変更が入れた副作用）。
`lib/majorTitles.ts` は「details に無くても information にある年は列に入れる」作りで
（開催前の年に開催日「11/6」を出すための既存仕様）、中止年もそのまま列になり、
主要4大会×全選手が `ー`（出場なし・記録なし）になっていた。船水颯人の実例:

| | 2022 | 2021 | 2020 | 2019 |
|---|---|---|---|---|
| 修正前 | 優勝 | **ー** | **ー** | 優勝 |
| 修正後 | 優勝 | **中止** | **中止** | 優勝 |

修正: `isCancelledEntry(infoForYear)` なら `CANCELLED_LABEL` を入れる
（既存の「開催前なら開催日」分岐の手前）。`ー` と区別できるようになり、
2019優勝→2022優勝の間が空いている理由がこの表だけで読める。

**同じ理由で `lib/newsArticle/contextBlocks.ts` の `readTournamentEditions()` からも中止年を外した。**
「直近の他大会」（プレビュー日の3ヶ月前窓・最大2件）の候補になれてしまい、1試合も
行われていない回が枠を潰す可能性があった（現データでは窓が2026年なので到達しないが、同じ穴）。

**確認して問題が無かった経路**（いずれも `details/` を起点に年を列挙しているため中止年に触れない）:
`lib/highschoolInProgress.ts` / `lib/tournamentRecords.ts` / `lib/priorMeetings.ts` /
`lib/playerStats/**` / `src/utils/team-data-aggregator.ts` /
`src/pages/highschool/[gender]/[prefectureId]/index.tsx`（直近1年の主要大会判定＝2020/2021は窓外）。

## 7. 学び / 今後

- **「年が飛んでいる」は中止の証拠にならない**。未収録・隔年開催・4年周期のどれでもありうる。
  今回も回次の算術（2019=74、2022=77）だけでは「2021が開催されて未収録」と区別できず、
  一次資料（JSTA の年度別結果一覧に「中止」の記載）で1件ずつ確認した。
- **過去日付のエントリを足すと「未来判定」が壊れる**のが盲点だった。`endDate >= today` で
  未来を判定している経路は日付で自然に落ちるが、**日付を見ずに「結果が無い年＝開催予定」と
  みなしている経路**（高校歴代ページ）は構造化データに嘘を出すところまで行っていた。
  「結果が無い」の意味が3つ（未収録／開催前／中止）に増えたので、今後
  `!resultYears.has(year)` を書くときは3つ目を思い出すこと。
- 収録範囲と地続きでない中止年を足すかは**データの読みやすさの問題**で、正しさの問題ではない。
  収録が伸びたら足す、というだけの保留。
- **`information` を「ページがある年の一覧」「開催された年の一覧」として使ってはいけない**
  （6.5・6.6 の追記）。`information` は開催前・中止・結果未投入の年も持つ。
  ページの実在は `details/`（＋`resultPath`）が決めるので内部リンクの候補はファイルの実在で絞り、
  「開催された年」が要るところでは `isCancelledEntry()` で外す。
  **中止対応で一番手間が掛かったのはこの棚卸しで、機能追加そのものではなかった。**

---

## Compile Log

- docs/wiki/data-model.md に反映: `information` の `status: 'cancelled'` 語彙、
  `location`/`startDate`/`endDate` が予定値であること、`categories: []`、
  打ち切り（`abandoned`）との対比表、選定規約（収録範囲と地続き）。
- docs/wiki/public-pages.md に反映: 大会一覧・大会ハブ・高校歴代ページでの中止の出し方と文言、
  「結果が無い年」の3意味（未収録／開催前／中止）と未来判定を書くときの注意。
- docs/wiki/upcoming-tournaments-runbook.md に反映: `check:upcoming` が中止年を
  未来レコードとして数えないこと。
- docs/wiki/public-pages.md に反映（追記6.5）: 年度・カテゴリ切り替えの候補は
  `details/` の実在で絞る＝`information` をページ一覧として使わない、というリンク規約。
- 除外: 該当7件の内訳表と `doubles-5thgrade4-boy` の誤記 → wiki には規約だけを載せる
  （個別のデータ誤りは直せば消えるもので、現在の仕様ではない）。
- docs/wiki/public-pages.md に反映（追記6.6）: 中止を出す面に「選手ページの主要タイトル表」を追加。
- docs/wiki/players-pages.md に反映: 主要タイトル表が information 由来の年も列に入れる仕様と、
  中止年は `中止`・開催前の年は開催日を出すこと。
- 除外: 船水颯人の修正前後の表 → wiki には載せない（検証の記録であって仕様ではない）。
- 除外: 投入14件の一覧表 → wiki には載せない（データそのものが source of truth で、
  wiki に写すと二重管理になる。規約と出典だけを載せる）。
- 除外: 入れなかった大会の個別列挙 → wiki には選定規約だけを載せる（対象は収録範囲が
  伸びるたびに変わるので、列挙は本ノートの当時の記録として残す）。
- 除外: `verify-abandonment.ts` の既知 FAIL → wiki ではなく本ノートに留め、別タスク扱い
  （中止対応の仕様ではない）。
- 新規 ADR は作らない: 打ち切り（2026-07-26）で決めた「大会運営上の事実は `information` に持つ」
  という既存方針に沿った語彙追加であり、決定を変更していない。
