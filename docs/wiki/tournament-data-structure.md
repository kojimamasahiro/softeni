# 大会データ JSON の構造（リファレンス）

> **適用範囲: 混在**。ファイルの役割分担と命名規約の考え方は汎用。種目名・世代区分はソフトテニス固有。
> **2026-09-19 に docs 直下から移し、現在の仕様だけへ圧縮した。** JSON の実例・使用箇所・データフローは
> [raw/2026-09-19-wiki-archive-tournament-data-structure.md](../raw/2026-09-19-wiki-archive-tournament-data-structure.md)。

`data/tournaments/**` の JSON のフィールドと語彙のリファレンス。
**最新の型は必ず [`src/types/tournament.ts`](../../src/types/tournament.ts) を見ること**（このページは規約と語彙が主）。
どのファイルが何の正かという上位の整理は [data-model.md](./data-model.md)。

```
data/tournaments/
├── index.json            # 大会マスタ
├── local_index.json      # 地方大会マスタ（federationId 必須）
├── federations.json      # 連盟マスタ
├── generations.json      # 世代区分マスタ
├── information/{tournamentId}.json          # 年度別の開催情報
└── details/{tournamentId}/{year}/{category}.json  # 結果本体
```

## マスタ

| ファイル | 主なフィールド |
|---|---|
| `index.json` | `tournamentId` / `generationId` / `label` / `isMajorTitle` / `officialUrl`（＋ `featurePath` / `searchLabel` / `searchAliases` / `searchNote`。[seo.md](./seo.md)） |
| `local_index.json` | 上に加えて **`federationId` が必須**（`data/prefectures.json` の ID と一致）。`areaId` で大会規模を手で指定できる |
| `federations.json` | `federationId` / `region` / `label` / `officialUrl` |
| `generations.json` | `generationId` / `label` |

**世代区分（`generationId`）**: `international` / `international-qualifier` / `all` / `corporate` /
`university` / `highschool` / `junior` / `masters`。
**`junior` には中学・小学・U20 が同居している**ので、学齢の粒度が要る用途では使えない（[players-pages.md](./players-pages.md)）。

## `information/{tournamentId}.json`（年度別の開催情報）

必須は `year` / `location` / `startDate` / `endDate` / `source` / `sourceUrl` / `categories[]`。
`categories[]` は `categoryId` / `label` / `category`（`doubles`・`singles`・`team`）/ `gender` / `age`。
任意フィールド（`venues` / `guidelineUrl` / `note` / `resultPath` / `status` / `scheduleSource` /
`categories[].schedule` など）の意味は [data-model.md](./data-model.md) が正。

### 実施されなかった回の語彙（粒度と意味が違う）

| フィールド | 値 | 意味 |
|---|---|---|
| `TournamentInformationEntry.status` | `'cancelled'` | その年が**中止**（1試合も行われていない）。`details/` は作らず `categories` は空配列。`location` / `startDate` / `endDate` は**開催予定**であって実績ではない |
| `TournamentCategoryInfo.status` | `'abandoned'` | その種目が**途中で打ち切られた**（そこまでの成績は有効）。`abandonedAfterRound` に最後に完了したラウンド名を入れる |

- 中止は `lib/tournamentCancellation.ts`（`isCancelledEntry`）。**成績系（連覇・playerStats・歴代優勝者の JSON-LD）には入れない。**
- 打ち切りは `lib/tournamentAbandonment.ts`。**開催年として数え**、到達成績は集計に入る。
- **どちらも理由は持たない**（断定できないため。入力メモは公開しない `note` へ）。

## `details/{tournamentId}/{year}/{category}.json`（結果本体）

ファイル名は `{gameCategory}-{ageCategory}-{gender}.json`（例 `doubles-none-boys.json`）。
中身は `participants[]` / `entries[]` / `matches[]` / `results[]` の4本。

| 配列 | 主なフィールド |
|---|---|
| `participants[]` | `id` / `lastName` / `firstName` / `team` / `prefecture` / `playerId?`（動的付与） |
| `entries[]` | `entryNo` / `playerIds[]`（ダブルス2人・シングルス1人）/ `type?` |
| `matches[]` | `entries[]` / `scores` / `round` / `winnerEntryNo` / `retired` / `stage` / `group` / `matchId` / `nextMatchId` / `prevMatchIds[]`（団体戦は対戦ごとの記録 `matches[]` も持てる。[ADR-020](../adr/ADR-020-team-match-rubber-details.md)） |
| `results[]` | `entryNo` / `tournament?.{label, rank}` / `roundrobin?.{group, rank}` |

**団体戦では `participants[]` が選手ではなくチームを指し**、`lastName` / `firstName` が空になる
（判定は `isTeamFormatPlayers()`。`lastName === null` で判定してはいけない。[data-model.md](./data-model.md)）。

### 命名規約

- **カテゴリID**: `{gameCategory}-{ageCategory}-{gender}`。`gameCategory` は `doubles` / `singles` / `team`、
  `ageCategory` は `none` / `u16` / `over50` など、`gender` は `boys` / `girls` / `mixed`。
  段階分割された大会では `ageCategory` に `final` / `semifinal` / `qualifying` 等の**段階**が入る（[data-model.md](./data-model.md)）。
- **参加者ID**: 個人戦は `{姓}_{名}_{チーム名}_{都道府県}`、団体戦は `{チーム名}_{都道府県}`。
  **団体戦でも `prefecture` を null のままにしない**（[pdf-import.md](./pdf-import.md)）。
  空の項目でアンダースコアが余分に付く不具合の調査は [raw/2026-07-09](../raw/2026-07-09-team-id-underscore-bug.md)。

### `stage` と `rank.kind`

`stage` は `knockout`（トーナメント）と `roundrobin`（総当たり）の2つ。

`results[].tournament.rank.kind` は `matches` から `tools/shared/normalize-core.js` が決定的に算出する。

| kind | 意味 |
|---|---|
| `winner` / `runnerup` | 優勝 / 準優勝（決勝＝`nextMatchId` 無しの試合の勝敗） |
| `best`（`bestLevel`） | ベスト4・8 等で敗退（確定） |
| `round`（`round`） | N回戦で敗退（確定） |
| `ongoing` | **進行中**。その回戦に到達／勝ち上がり中で最終結果は未確定 |

**大会途中でも `results` を生成できる。** 鍵は、最深試合の `winnerEntryNo` が `null`（未実施）の間は
**敗退ではなく `ongoing`** として扱うこと（[ADR-007](../adr/ADR-007-in-progress-tournament-standing.md)）。
完了した大会では `ongoing` は出ない。これを `/news` のプレビューが「今大会の途中経過」バッジに使う
（[news-context-blocks.md](./news-context-blocks.md)）。

### `entries[].type`（ドローの席）

| 値 | 意味 |
|---|---|
| `seed` | シード。1回戦が不戦勝で2回戦から登場 |
| `packing` | 一般エントリー。1回戦から戦う |
| `extra` | 通称「足長」。1回戦は不戦勝だが、2回戦の相手も不戦勝上がり（＝シードの下ではない） |
| `preliminary` | 本戦の1回戦より前の「予選」で敗れ、**本戦のドローに席を持たない**組。**席順を数えるときに数えない**（数えると以降の席が1つずつずれる） |
| `null` | 指定なし（予選リーグ参加者・判定不能） |

**「予選リーグ（`stage: "roundrobin"`）」と「本戦前の予選（`round: "予選"` の1試合）」は別物。**
前者の参加者は `null` で、決勝Tの席は `knockoutDraw` が持つ（[ADR-015](../adr/ADR-015-knockout-draw-by-group.md)）。

判定は2箇所にあり、**同じ規約である必要がある**。

| どこ | いつ | 判定方法 |
|---|---|---|
| `tools/tournament3` の `buildEntriesMeta()` | 入力ツールで出力するとき | **1回戦の枠組みだけ**から決める。第 i 試合が実対戦なら両者 `packing`、bye なら隣の第 `i^1` 試合が実対戦かで `seed` / `extra` |
| `tools/shared/normalize-core.js` の `calculateEntryType()` | `entriesMeta` が無いとき（既存データ・外部取り込み） | **実対戦の初出ラウンド**から決める。`round: "予選"` は本戦の外なので除外し、それしか無ければ `preliminary` |

- **開催前は前者しか使えない**（2回戦の枠が未確定なので、後者だとシードの `type` が `null` に落ちる）。
  `entriesMeta` があればそちらを優先する。
- **`buildEntriesMeta()` は `preliminary` を出せない**（1回戦の枠組みしか見ないため）。この形式を新規に入力するなら手当てが要る
  （[open-questions.md](./open-questions.md)）。

## 関連

- [data-model.md](./data-model.md) — どのファイルが何の正か、`venues` / `delegations` / `schedule` の形
- [data-import.md](./data-import.md) / [pdf-import.md](./pdf-import.md) — 取り込みと検査
- [public-pages.md](./public-pages.md) — 大会一覧・大会ハブ・年度別結果ページの仕様（`level` の推定やフィルタもこちら）
- [tournament-bracket-logic.md](./tournament-bracket-logic.md) — トーナメント表の組み立て
- [team-player-identity.md](./team-player-identity.md) — 参加者 ID の正準化
