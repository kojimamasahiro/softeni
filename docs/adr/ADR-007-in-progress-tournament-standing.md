# ADR-007: 大会途中の成績を `results`（`rank.kind:'ongoing'`）として保持する

## Status

Accepted。決定日: 2026-06-26。現状仕様: `docs/tournament-data-structure.md` / `docs/wiki/news-context-blocks.md`。ADR-005（速報・プレビュー機能）を補完する。

## Context

`/news` のプレビュー記事は、ピックアップ選手（前回王者・前回入賞者・過去の優勝者）が「今大会でどこまで勝ち上がっているか／どこで敗退したか」を出したい。これは速報としての価値が高い。

しかし大会の最終結果は `data/tournaments/details/**` の `results[]`（エントリー単位の `rank`）に入れる一方、**途中（未確定）の大会では `results` 配列ごと省く運用**になっていた。原因は、結果を `matches` から算出する `tools/shared/normalize-core.js` の `deriveResultLabelForEntry` が、最深試合の `winnerEntryNo` が `null`（未実施）でも敗退とみなし、途中だと全エントリーが「1回戦敗退」等になる不具合があったため。結果として、プレビュー段階では途中経過を出す手段が無かった。

## Decision

**大会途中でも `results` を生成できるよう運用を変更する**。具体的には:

1. `normalize-core.js` の成績導出を純粋関数 `deriveEntryStanding(entryNo, matches)` に切り出し、最深試合が**未確定（`winnerEntryNo==null`）の間は敗退ではなく進行中（`state:'alive'`）**として扱う。確定した敗北のみを敗退（eliminated）とする。
2. `results[].tournament.rank.kind` に **`ongoing`** を追加（進行中＝その回戦に到達／勝ち上がり中）。完了大会では従来どおり winner/runnerup/best/round のみで、**既存の出力は不変**。
3. `/news` プレビュー（`lib/newsArticle.ts`）が当年・種目の `detail.results` を読み、ピックアップ選手を当年 `entryNo` に解決して途中経過/敗退バッジ（`EntryStanding`）を出す。`results` 未掲載なら非表示（graceful）。

「表示時に `matches` から都度算出する」案ではなく、**`results` に保持する案を採用**（データ取得＝手動入力という既存の一次データ運用に揃え、各消費面が `results` を一様に読めるようにするため）。

## Alternatives

- **表示時に matches から導出（results を変更しない）**: 王者撃破ロジック（`getChampionDefeat`）と同じ手法で実装可能。データ運用は不変だが、消費面ごとに導出ロジックが分散し、`results` が「最終結果のみ」という非対称が残る。今回は不採用。
- **途中は何も出さない（現状維持）**: プレビューの速報価値を取りこぼす。

## Consequences

- 利点: プレビューで途中経過/敗退を出せる。`results` がエントリー成績の一様な真実源になり、結果ページ等でも途中状態を扱える。完了大会の出力は不変（`deriveEntryStanding` の単体テストで parity 確認済み）。
- 注意: `rank.kind` を消費する箇所は `ongoing` を未対応の `kind` として無視しても壊れないが、優勝者集計（`historical-winners` は `kind==='winner'` のみ）に影響しないことを前提とする。
- 注意: 途中経過は **入力（再 normalize/export）時点のスナップショット**。鮮度は手動更新に依存する。

## Related Files

- `tools/shared/normalize-core.js`（`deriveEntryStanding` / `computeRankFromStanding`、`ongoing` 付与）
- `lib/newsArticle.ts`（`EntryStanding` / `buildFieldIndex` の entryNo マップ / `currentStandingOf` / `standingFromResult`）
- `src/pages/news/[articleId].tsx`（`StandingBadge`）
- `lib/tournamentCoverage.ts`（`computeResultCoverage` / `formatResultCoverageBodyText` / `formatResultCoverageMetaSuffix`）
- `src/components/Tournament/ResultCoverageNotice.tsx`
- `src/pages/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]/index.tsx`
- `docs/tournament-data-structure.md` / `docs/wiki/news-context-blocks.md`

## Implementation Status（2026-07-19 追記。検討経緯は [2026-07-19-result-coverage-notice-design.md](../raw/2026-07-19-result-coverage-notice-design.md)）

結果ページでの明示表示を実装した。**SEO/クリック上の狙いは「更新時刻」ではなく「どこまで結果が反映されているか」を伝えること**（更新時刻は手動運用ゆえ鮮度のムラがそのまま弱点に見えてしまう一方、反映範囲は `matches`/`results` から常に正確に導出できるため）。

- `lib/tournamentCoverage.ts`: `computeResultCoverage()`。決勝T（`stage:'knockout'`）の decided/total 件数と最深確定ラウンドを集計。完了/進行中の判定は **`results[].tournament.rank.kind === 'ongoing'` の有無を主軸**にする（`matches` の decided/total 比だけに頼ると、3位決定戦が未実施の大会や欠番のある古い完了済みデータを誤って「進行中」と判定してしまうため。`highschool-championship/2025` や `asian-games-qualifier/2025` の実データで確認済み）。
- `src/components/Tournament/ResultCoverageNotice.tsx`: 結果ページ H1 直下に1行表示。`completed` / `unsupported` では非表示。
- `src/pages/tournaments/.../[gender]/index.tsx`: 本文バナーに加え、`MetaHead` の `description` にも同内容を追記（Googleは指定した meta description をそのまま使うとは限らず、本文中に同趣旨の文言があった方が検索結果に反映されやすいため、本文とメタの両方に出す設計にした）。
- スコープ: 個人戦 + 団体戦の**決勝トーナメントのみ**。予選リーグ（`stage:'roundrobin'`）は進捗の測り方が別物（ラウンド深度でなくグループ内消化数・順位確定）になるため対象外（下記 Open Questions へ）。

## Open Questions

- 結果ページでの途中経過表示 → **上記の通り実装済み（2026-07-19）**。
- 予選リーグ（`roundrobin`）の反映状況表示 → 今回は対象外。グループ内消化試合数・順位確定を別ロジックで測る必要があり、対応するかは反響次第。
- 途中経過の鮮度を上げる運用（再 export の頻度・自動化の可否）→ 未着手。今回のUIは鮮度でなく反映範囲を主役にする方針にしたため優先度は下げている。
