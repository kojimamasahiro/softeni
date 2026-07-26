# 検討: 打ち切り（中止）大会の扱いと UI 制御

日付: 2026-07-26
状態: **実装済み**（設計→実装まで同日中に完了）
位置づけ: [ADR-007](../adr/ADR-007-in-progress-tournament-standing.md) / [2026-07-19-result-coverage-notice-design.md](./2026-07-19-result-coverage-notice-design.md) の続き。
`rank.kind:'ongoing'` が「進行中」と「打ち切りで終了」を区別できない問題への対応。

## きっかけ

`data/tournaments/details/highschool-tokai-block/2026`（第73回東海高等学校総合体育大会、2026-06-20〜21、愛知県）が
**ベスト8までで打ち切り**になった。ユーザー発言（要旨）:「結果がベスト8までしかないが、大会が打ち切りであった。
この場合どのように UI 側は制御させるのがいいか検討したい」。

## 実データの状態（男女とも同一）

| 項目 | doubles-none-boys | doubles-none-girls |
|---|---|---|
| 決勝T 総試合数 | 60 | 60 |
| 勝者確定 | 56（1回戦32 / 2回戦16 / 3回戦8） | 56（同left） |
| 未実施 | 準々決勝 4試合（`winnerEntryNo: null`、`entries` は確定済み） | 準々決勝 4試合（同left） |
| `rank.kind` 内訳 | `round` 56 / `ongoing` 8 | `round` 56 / `ongoing` 8 |
| `ongoing` の label | 全て「ベスト8進出」 | 全て「ベスト8進出」 |

準々決勝の対戦カード自体は組まれている（例: boys `match-57` = entries `[1, 13]`）。つまり
**「誰と誰が当たるはずだったか」は既知で、試合が行われなかっただけ**。

## 打ち切りの事実確認（2026-07-26）

- **打ち切り理由は特定できていない。** 天候・時間進行など運営上の事由と推測されるが、典拠が無い。
- 傍証: 大会進行表 <https://aichikoutairensofttennis.web.fc2.com/pdf/2026/73toukaisenbatsu-sinkouhyou2.pdf>
  に「可能な限り進める」旨の記載があり、**そもそも全日程完了を保証しない運営前提**だったことが読める。
  結果PDF（`73-toukaisoutai-kekka.pdf`）もベスト8までで終わっている。
- したがって「無効試合・成績なし」ではなく、**そこまでの結果が有効な成績として残った**と解釈する。
  → 方針1（ベスト8確定）を維持する。
- **理由はデータにもUIにも記載しない**（ユーザー判断: 断定できず、ややこしくなるため）。
  記録するのは「どのラウンドまでで打ち切られたか」だけにする。

## 何が壊れるか（放置した場合）

`ongoing` は本来「まだ試合が残っている＝いずれ確定する」を意味する値なので、永久に確定しない
この大会に付いたままだと以下が全て誤動作する。**表示層だけ直しても下4件は直らない**のが要点。

| 箇所 | 現状の出力 | 問題 |
|---|---|---|
| `lib/tournamentCoverage.ts` | `status:'in_progress'` →「現在の反映状況: 3回戦まで結果掲載中(全60試合中56試合終了・93%)」 | 永久に「これから更新される」と誤解させる。SEO/クリック目的で入れた文言が逆効果になる |
| `src/components/Tournament/TournamentBracket.tsx` | 準々決勝の4枠が空欄 | 「データ未入力」なのか「中止」なのか区別不能 |
| `lib/playerStats/placement.ts` `resolvePlacement()` | `ongoing` は分岐が無く `{kind:'unknown'}` に落ちる | **ベスト8の8ペア＝16選手が戦績に載らない**。`facts.ts` の notable 判定からも漏れる |
| `lib/highschoolAlumni.ts` | `rank.kind==='best' && bestLevel===8` で判定 → 該当せず weight 3 が付かない | 学校ページの実績から欠落 |
| `src/pages/tournaments/[generation]/[tournamentId]/index.tsx:302` | `kind==='winner'` を探して見つからず優勝者欄が空 | 年次一覧で「データ未整備」に見える |
| `lib/newsArticle.ts:431` | `case 'ongoing'` → `state:'alive'`（緑）「ベスト8進出」 | 進行中バッジが残り続ける |

`lib/tournamentRecords.ts`（`historical-winners`、`kind==='winner'` のみ集計）は優勝者0件が事実として
正しいので影響なし。連覇判定については下記「連覇・連続入賞の扱い」参照（追加実装不要）。

## 連覇・連続入賞の扱い（2026-07-26 決定）

**方針: 打ち切り年も「開催された年」としてカウントし、打ち切り後の結果をそのまま利用する。**
中止（不開催）ではないため、年をスキップしたり特別扱いしたりしない。

**追加実装は不要**。既存コードが既にこの通りに動くことをコードで確認した:

- `lib/tournamentRecords.ts` `extractWinner()`（行 209-238）: 優勝者を特定できない年も
  `display: null` の `ChampionEntry` を返し、コメント通り「年の存在は示す（捏造しない）」。
  → 2026 は**開催年として年表に載り、優勝者欄だけ空**になる。
- `championKey()`（行 280）: `display` が null なら `null` を返す。
- `computeRepeatChampion()`（行 286-304）: `targetKey` が null なら即 `return null`、
  遡行ループも `championKey(asc[i]) !== targetKey` で break する。
  → 2025→2026→2027 の連覇は **2026 で自然に切れる**。開催年間隔チェック
  （`asc[i+1].year - asc[i].year !== 1`）にも引っかからない（2026 は配列に存在するため）。

つまり「開催はされた、優勝者は出なかった、よって連覇は途切れた」という
意味的に正しい結果に既存ロジックのままなる。**回帰テストで固定するのみ**とする。

## 決定した方針

3点をユーザーに確認して合意した。

### 1. 成績は「ベスト8」として確定させる

`ongoing` を `{kind:'best', bestLevel:8}` に解決する。理由:

- 打ち切り時点の到達成績は、主催側でも公式記録として扱われる（要典拠確認 → Assumption）。
- **既存の消費側（`placement.ts` / `highschoolAlumni.ts` / `majorResults.ts` / `newsArticle.ts`）が
  `best`/`bestLevel:8` を既に理解している**ため、分岐追加ゼロで全て正しく動く。
- 却下案:
  - 「成績なし（大会を無効扱い）」… 実際に3回戦を勝ち上がった事実を消してしまう。
  - 新 `kind:'abandoned'` 追加 … 意味は最も正確だが、`rank.kind` を読む全箇所に分岐追加が必要で
    コストが釣り合わない。`best` + 大会レベルの打ち切りフラグで同じ情報は再構成できる。

### 2. 「打ち切り」の事実は information JSON の `categories[]` に持たせる

`data/tournaments/information/highschool-tokai-block.json` の該当年・該当カテゴリに記録する。

```jsonc
{
  "categoryId": "doubles-none-boys",
  "label": "男子ダブルス",
  "category": "doubles",
  "gender": "boys",
  "age": "none",
  // 追加
  "status": "abandoned",
  "abandonedAfterRound": "3回戦"   // 最後に完了したラウンド
}
```

**理由フィールド（`abandonedReason`）は持たない**（2026-07-26 決定）。理由:

- 実際の打ち切り理由が典拠から確定できない（下記「打ち切りの事実確認」参照）。
- 断定できない理由を UI に出すと不正確な情報になり、かつ表示文言が理由の有無で分岐して複雑になる。
- 「ベスト8までで終了した」という**事実だけ**を出せば読者の疑問には答えられる。

理由:

- **粒度が正しい**。「個人戦は打ち切り／団体戦は完了」というケースが実際に起こりうるため、
  年レベルではなくカテゴリレベルに持たせる。今回は男女とも打ち切りなので2箇所に付く。
- detail JSON（`details/**`）は **matches の忠実な記録**のままに保てる。打ち切りは
  「試合結果」ではなく「大会運営上の事実」なので、information 側が置き場所として正しい。
- export パイプライン（`tools/shared/normalize-core.js`）を触らずに済む。手集計の PDF から
  detail を再 export しても打ち切りフラグが消えない。
- **`lib/playerStats/manifest.ts` が既に `info:{tid}` をハッシュ対象にしている**ため、
  information を編集すれば playerStats の増分ビルドが正しく無効化される。追加対応不要。

### 3. 準々決勝の未実施4試合はカードを残し「中止」と明示する

対戦組み合わせは事実として価値がある（「誰と当たるはずだったか」）ので表示は残し、
勝敗欄に「中止」を出す。ブラケットを ベスト8 で切り落とす案は却下。

## 実装方針（未着手）

### 新規: `lib/tournamentAbandonment.ts`

打ち切り解決を1箇所に集約する。coverage 計算と placement 解決の両方から使う。

```ts
export interface AbandonmentInfo {
  abandonedAfterRound: string;   // "3回戦"
  reason: string | null;
}

/** information の categories[] から打ち切り情報を取り出す（未設定なら null）。 */
export function getAbandonment(categoryInfo): AbandonmentInfo | null;

/**
 * 打ち切り時点で ongoing だったエントリー数から確定 rank を導く。
 * aliveEntries=8 → { kind:'best', bestLevel:8 }
 * aliveEntries=4 → { kind:'best', bestLevel:4 }
 * それ以外（16等）→ { kind:'round', round: N }（best は 4/8 しか消費側が扱えないため）
 */
export function resolveAbandonedRank(aliveEntries: number, lastRound: string): Rank;

/** detailData.results の ongoing を確定 rank に置換した新しい detailData を返す（純粋関数）。 */
export function applyAbandonment(detailData, abandonment): TournamentDetailData;
```

**注意**: `best` の `bestLevel` は消費側（`highschoolAlumni.ts` / `majorResults.ts`）が **4 と 8 しか
判定していない**。ベスト16打ち切り等が将来出た場合は `round` にフォールバックさせる必要がある。
今回はベスト8なのでそのまま `best/8` で通る。

**4/8 以外は未検証のまま残す（2026-07-26 決定）。ただし「気づけるようにする」ことを実装要件にする**:

1. `resolveAbandonedRank()` の実装コメントに、4/8 以外が未検証である旨と本ノートへのパスを明記する。
2. 4/8 以外の `aliveEntries` を受け取った場合、`round` フォールバックを返すと同時に
   **ビルド時に警告を出す**（`scripts/**` の CLI 出力または dev 時の `console.warn`。
   公開UIには出さない）。文言例:
   `[abandonment] 未検証パターン: aliveEntries=16 (${tournamentId}/${year}/${categoryId}). docs/raw/2026-07-26-abandoned-tournament-ui-design.md を参照`
3. `docs/wiki` への write-back 時にも「4/8 以外は未検証」を明記し、該当大会が出たら本ノートを
   読み返す導線を残す。

### 適用ポイント（3経路あるので漏らさない）

1. `src/utils/tournament-data-loader.ts` … `loadTournamentData()` は information を知らないため、
   information と組み合わせる呼び出し側（`loadAllTournamentData()` / 大会結果ページの
   `getStaticProps`）で `applyAbandonment()` を通す。
2. `lib/playerStats/sourceAdapter.ts` … playerStats は独自に details を読む別経路。
   既に information も読んでいる（`sourceAdapter.ts:162`）ので、detail 読み出し時に同じ関数を通す。
3. `lib/tournamentRecords.ts` / `lib/majorTitles.ts` … `kind==='winner'` のみ参照なので
   打ち切り大会では影響なし。ただし通す方が一貫性がある（要検討）。

理想は「detail を読む全経路が必ず打ち切り解決を通る」構造にすること。読み出しヘルパを1本化できないなら、
最低限テストで3経路の一致を担保する。

### `lib/tournamentCoverage.ts` の変更

`ResultCoverageStatus` に `'abandoned'` を追加する。判定順序が重要:

```
information に status:'abandoned' があるか
  → YES: 'abandoned'（ongoing の有無に関わらず最優先）
  → NO : 従来ロジック（ongoing の有無で not_recorded / in_progress / completed）
```

`computeResultCoverage()` は現在 detailData のみを引数に取るので、**打ち切り情報を第2引数で受ける**
シグネチャ変更が要る。`applyAbandonment()` 後の detailData を渡すと ongoing が消えて `completed` に
なってしまい「打ち切り」であることが表現できないため、フラグは別途明示的に渡す。

文言案（`formatResultCoverageBodyText`）:

> この大会は準々決勝以降が中止となり、ベスト8までで終了しました。

meta description 追記案（`formatResultCoverageMetaSuffix`）:

> 準々決勝以降中止・ベスト8までの結果。

**理由には一切言及しない**（「荒天のため」等を書かない）。文言は `abandonedAfterRound` から機械的に
組み立てられる範囲に限定する。

### `ResultCoverageNotice.tsx`

`abandoned` を描画対象に追加する。ただし色は `in_progress` と同じ info 系ではなく、
**中立/警告系**（`warning-bg` 等、既存トークンを確認して合わせる）にして「更新待ち」と視覚的に区別する。
`completed` / `unsupported` を非表示にする現在の挙動は維持。

### `TournamentBracket.tsx`

`winnerEntryNo === null` かつ打ち切り済み大会の場合、勝敗欄に「中止」を表示する。
絵文字は使わない（AGENTS.md の UI 表記ルール）。テキストまたは CSS/inline SVG で表現する。

### 大会年次一覧（`[tournamentId]/index.tsx`）

優勝者欄が空になる問題。`winResult` が null かつ打ち切り済みなら「打ち切り（ベスト8まで）」等を
表示する。空欄のままだと「データ未整備」に見えるため。

### 型定義

`src/types/tournament.ts` の `TournamentCategoryInfo` に `status` / `abandonedAfterRound` を
オプショナルで追加（理由フィールドは持たない）。

## 検証項目

- 東海ブロック2026 男女: coverage が `abandoned`、8ペア16選手に ベスト8 が付く、
  ブラケット準々決勝に「中止」、年次一覧に打ち切り表記。
- **連覇の回帰**: 東海ブロック の `historical-winners` で 2026 が「開催年・優勝者なし」として並び、
  2025→2026→2027 をまたぐ連覇が 2026 で切れること。既存ロジックのままで成立する想定なので、
  実装ではなく**テストで固定する**のが目的。
- **回帰**: `status` 未設定の既存大会（`highschool-championship/2025`、`asian-games-qualifier/2025`、
  `highschool-championship/2026` の組み合わせのみ）で coverage 判定と placement が**一切変わらない**こと。
  2026-07-19 の検証表（`2026-07-19-result-coverage-notice-design.md`）をそのまま再実行する。
- `lib/playerStats` の増分ビルドが information 編集で正しく無効化されるか（`manifest.ts` の
  `info:{tid}` ハッシュ経路）。
- `tsc --noEmit` / `eslint`（絵文字ルール含む）。

## Open Questions

解消済み（2026-07-26）:

- ~~打ち切りの事実確認~~ → 進行表に「可能な限り進める」旨があり、無効試合ではなく有効成績と解釈。
  ただし**理由自体は特定できていない**（記載しない方針で確定）。
- ~~連覇・連続入賞の扱い~~ → 開催年としてカウントし結果をそのまま利用。既存実装で成立、追加実装不要。

継続（2026-07-19 から引き継ぎ）:

- 予選リーグ（`roundrobin`）段階での打ち切り。今回は決勝T のみのケースなので未対応。
  coverage の roundrobin 未対応と同根なので、**継続 Open Question のまま据え置く**（ユーザー確認済み）。
- `bestLevel` が 4/8 以外（ベスト16打ち切り等）のケース。`round` フォールバックの妥当性は**未検証のまま
  残す**（ユーザー確認済み）。ただし該当大会が出た時に本ノートへ辿り着けるよう、
  `resolveAbandonedRank()` のコメントとビルド時警告で導線を張ることを実装要件とする（上記参照）。
- 全国大会（インターハイ）出場枠が実際どう配分されたか。当サイトは出場枠を扱っていないため
  表示には影響しないが、将来 出場枠情報を扱う場合に再検討が要る。

---

## 実装結果（2026-07-26）

### 設計からの変更点

**detail の読み出し経路は 3 本ではなく 4 本だった。** 設計時に挙げた 2 本
（`tournament-data-loader.ts` / `playerStats/sourceAdapter.ts`）に加え、**大会結果ページ本体が
`fs.readFileSync` で detail を直接読んでいた**（`[gender]/index.tsx` の `getStaticProps`、
`loadTournamentData` を経由しない）。実装中に発見して同じ解決を通した。
設計ノートで「適用漏れが起きやすい」と警戒していた箇所が実際に 1 本増えていた形。

**`ResultCoverageNotice` の props を `detailData` から `coverage` に変更した。** 打ち切り情報は
detail から導出できない（読み出し時点で ongoing が解決済みのため）ので、`computeResultCoverage()`
の呼び出しを information を持つページ側に寄せ、コンポーネントは算出済み coverage を受け取る形にした。

**歴代優勝者の JSON-LD にプレースホルダを混ぜない。** 当初 `winner` に
「優勝者なし（3回戦までで打ち切り）」という文字列を入れかけたが、`championRows` は
`ItemList` の JSON-LD（`performer` / `description`）にも使われているため、
構造化データに嘘が入る。`winner: null` + `abandonedAfterRound` の 2 フィールドに分け、
JSON-LD 側は `performer` を出さず description を打ち切り文言にした。

### 変更ファイル

| ファイル | 内容 |
|---|---|
| `lib/tournamentAbandonment.ts` | 新規。`getAbandonment` / `resolveAbandonedRank` / `applyAbandonment` / `countAliveEntries` / `emitAbandonmentWarning` |
| `src/types/tournament.ts` | `TournamentCategoryInfo` に `status?: 'abandoned'` / `abandonedAfterRound?: string` |
| `data/tournaments/information/highschool-tokai-block.json` | 2026 の男女 2 カテゴリに `status` / `abandonedAfterRound: "3回戦"` |
| `src/utils/tournament-data-loader.ts` | `loadTournamentData` で解決を適用（`parseDetailPath` でパスから tid/year/cat を復元）。`getTournamentAbandonment` を公開。information の**プロセス内キャッシュ**を追加（解決判定で大会ファイル数ぶん読むため） |
| `lib/playerStats/sourceAdapter.ts` | `readStandardDetail` で解決を適用。`InformationEntry.categories` 追加、`getAbandonmentFor` 追加 |
| `lib/tournamentCoverage.ts` | `'abandoned'` ステータス追加。`computeResultCoverage(detail, abandonment?)` の第2引数。`firstUndecidedRoundLabel` 追加。本文・meta 文言 |
| `src/components/Tournament/ResultCoverageNotice.tsx` | props 変更（`coverage`）。打ち切りは warning 系トークンで info 系と区別 |
| `src/components/Tournament/TournamentBracket.tsx` | `abandonedAfterRound` prop。未実施試合に「中止」、表の上にキャプション |
| `src/pages/.../[gender]/index.tsx` | fs 直読み経路への解決適用、coverage 算出、bracket への prop 受け渡し |
| `src/pages/.../[tournamentId]/index.tsx` | 歴代優勝者に打ち切り年を残す（優勝者欄に「◯までで打ち切り（優勝者なし）」）、JSON-LD 出し分け |
| `scripts/verify-abandonment.ts` | 新規。本ノートの検証項目を自動化 |

### 検証結果

`npx ts-node --project scripts/playerStats/tsconfig.json scripts/verify-abandonment.ts` → **ALL PASS**。

1. **東海ブロック2026 男女**: `ongoing` 0 件 / `best`(bestLevel:8) 8 件 / `round` 56 件。
   解決後の形が完了大会と完全一致（`{label:"ベスト8", rank:{kind:"best",bestLevel:8}}`）。
   `resolvePlacement` が 8 ペアを `{kind:'best',bestLevel:8}` に解決。coverage は `abandoned`。
   **SourceAdapter 経路でも同じ 8 件**（経路間の一致を確認）。
   - 本文: 「この大会は3回戦までで打ち切りとなり、準々決勝以降は実施されませんでした。掲載している結果が最終結果です。」
   - meta: 「3回戦までで打ち切り・これが最終結果。」
2. **回帰**（2026-07-19 の検証表を再実行）: `highschool-championship/2026` → `not_recorded`、
   `highschool-championship/2025` → `completed`、`asian-games-qualifier/2025` → `completed`。
   いずれも打ち切り情報なしで `applyAbandonment` が**同一参照を返す**（素通し）ことも確認。
3. **連覇**: 2026 が開催年として年表に存在し、`display` は null、`repeatChampion` は null。
   **設計どおり追加実装なしで成立**。
4. **未検証パターン**: `aliveEntries=16` で `round`(round:4) へフォールバックし、警告が出ることを確認。

その他: `tsc --noEmit` 通過。`eslint` 0 errors（環境依存の native binding 警告のみ、
2026-07-19 時点と同じ）。`npm run playerstats:test` 全スイート通過（12/15/21/25/32 passed, 0 failed）。

## 次のステップ

- `docs/wiki` と ADR-007 への write-back。打ち切りは ADR-007 の `ongoing` 語彙に対する仕様追加なので、
  **新規 ADR ではなく ADR-007 への追記**が適切か、独立 ADR にするかを判断する。
- `docs/tournament-data-structure.md` に `status:'abandoned'` / `abandonedAfterRound` の語彙を追記。
- 未実施（意図的）: 本番ビルドでの目視確認（バナー・ブラケットの「中止」・歴代優勝者の表記）。
