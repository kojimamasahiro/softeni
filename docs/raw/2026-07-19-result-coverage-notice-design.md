# 詳細検討・実装記録: 大会結果ページの「反映状況」表示

日付: 2026-07-19
状態: 実装済み（本セッション内で検討→実装まで完了）
位置づけ: [ADR-007](../adr/ADR-007-in-progress-tournament-standing.md) の Open Question
「結果ページでも途中経過(ongoing)を明示表示するか」への回答。

## きっかけ

ユーザー発言（要旨）: 「大会結果ページにどこまで反映されているかをSEO的に、というかクリック的に表示させたい。
更新時間は早くても遅くてもどこまで反映されているかが重要だと感じているので、更新時刻表示はあまり要らないと思う」。

## 検討したこと

### なぜ「更新時刻」より「反映範囲」を主役にするか

- 更新時刻（例:「3時間前に更新」）は単体だと逆に古く見えがちで、実際は大会が動いていないだけでも
  不安・不信を与えうる。
- このプロジェクトのデータ運用は手動更新（ADR-007 に明記の通り「鮮度は手動更新に依存する」）。
  更新頻度を強調すると運用のムラがそのまま弱点として見える。
- 一方「どこまで反映されているか」（＝何回戦まで結果が出ているか）は `matches`/`results` から
  機械的に導出できる事実であり、更新頻度に関係なく常に正確。ユーザーが本当に知りたいのも
  「今の状態を追えているか」であって「いつ触ったか」ではない。
- 結論: 更新時刻表示は見送り、反映範囲（進捗）を主役にする。

### 表示場所: 本文1行 + meta description 両方

- meta description だけだと、Google が指定文言をそのまま使わず本文から別の一文を自動抜粋する
  ことがあり、検索結果への反映が保証されない。
- 本文（H1直下）にも同じ趣旨の一文を出しておけば、実際に検索結果へ反映される確率が上がる。
  実装コストはほぼ変わらないため、両方に出す方針にした（ユーザー確認済み）。

### スコープ: 個人戦 + 団体戦の決勝トーナメントのみ（予選リーグは対象外）

- 団体戦は「予選リーグ→決勝トーナメント」の2段構成。予選リーグの進捗は「ラウンド深度」でなく
  「グループ内の消化試合数・順位確定」という別の物差しが必要で、決勝Tの計算とは別ロジックになる。
- 今回は決勝トーナメント（`stage:'knockout'`）のみを対象にスコープを絞った（ユーザー確認済み）。
  予選リーグ対応は反響次第の Open Question として残す。

### 完了/進行中の判定は `matches` の件数比だけに頼らない（実データで確認した落とし穴）

`matches` の decided/total 件数比だけで「完了 or 進行中」を判定すると、**完了済みの過去大会を
誤って「進行中」と判定してしまうケースがある**ことを実データで確認した:

- `highschool-championship/2025/doubles-none-girls.json`: 決勝T 319試合中 318試合が決定済み、
  1試合が未決定（`winnerEntryNo: null`）のまま残っている。中身を見ると `entries: [48, None]` という
  対戦相手が欠けたダミー枠のような試合で、恐らく3位決定戦が実施されなかった/データが不完全な枠。
  この1試合のせいで単純な decided/total 比は永遠に 99.7% にしかならない。
- `asian-games-qualifier/2025/doubles-tournament-boys.json`: 47試合中43試合決定、4試合未決定。
  これも同様に大会自体はとっくに終わっている（2025年開催、現在2026年7月）。

対策として、完了/進行中の判定は **`results[].tournament.rank.kind === 'ongoing'` が1件でも
残っているか**を主軸にした。`ongoing` は `tools/shared/normalize-core.js` の
`deriveEntryStanding`/`computeRankFromStanding` が「まだ勝ち上がり中で最終結果未確定」と
判定したエントリーにのみ付与される値で、上記のような欠番・ダミー試合の影響を受けない
（既に決定済みの完了大会では `ongoing` は一切出力されない仕様。ADR-007 参照）。
`matches` の decided/total 件数・最深確定ラウンドは、進行中の場合の表示文言
（「現在◯回戦まで結果掲載中」等）を組み立てるための補助情報としてのみ使う。

4パターンの実データで検証済み（`lib/tournamentCoverage.ts` の設計根拠）:

| ファイル | 決勝T decided/total | `ongoing` 件数 | 判定結果 |
|---|---|---|---|
| `highschool-championship/2026/doubles-none-girls.json`（組み合わせのみ・未開催） | 0/157 | 314 | `not_recorded`（正） |
| `highschool-championship/2025/doubles-none-girls.json`（完了済み・欠番あり） | 318/319 | 0 | `completed`（正・誤判定を回避） |
| `asian-games-qualifier/2025/doubles-tournament-boys.json`（完了済み・欠番あり） | 43/47 | 0 | `completed`（正・誤判定を回避） |
| `zennihon-senbatsu/2026/doubles-none-girls.json`（予選リーグ+決勝T混在・完了済み） | 7/7 | 0 | `completed`（正） |

## 実装

- `lib/tournamentCoverage.ts`: `computeResultCoverage()` / `formatResultCoverageBodyText()` /
  `formatResultCoverageMetaSuffix()`。
- `src/components/Tournament/ResultCoverageNotice.tsx`: H1直下の1行通知。`completed` / `unsupported`
  （決勝T試合データが無い＝予選リーグのみ等）では非表示。
- `src/pages/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]/index.tsx`:
  本文バナー設置 + `MetaHead` description への一文追記。
- 検証: `tsc --noEmit` 通過、`eslint` 通過（環境依存の native binding 警告のみ、コード起因のエラーなし）。

## Open Questions（未対応のまま残すもの）

- 予選リーグ（`roundrobin`）の反映状況表示。グループ内消化試合数・順位確定という別ロジックが必要。
- 途中経過の鮮度を上げる運用（再 export の頻度・自動化の可否）。今回のUIは鮮度でなく反映範囲を
  主役にする方針にしたため、優先度を下げたままにしている。
- 表示文言（「現在◯回戦まで結果掲載中」等）のABテスト・実際のクリック率への効果測定は未実施。

## Compile Log

- ADR-007 の Implementation Status / Open Questions / Related Files に反映済み（2026-07-19）。
- docs/wiki への追加ページ化は見送り。ADR-007 が本機能の唯一の関連ドキュメントであり、
  wiki の別ページを新設するほどの独立性は無いと判断（除外理由）。
