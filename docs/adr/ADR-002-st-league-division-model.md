# ADR-002: STリーグの階層（division）データモデル

## Status

Accepted

## Context

STリーグは男女それぞれが **STリーグⅠ・Ⅱ・Ⅲ** の階層に分かれ、プレーオフ（入替戦）で
昇格・降格が行われる。当初の実装は2025年のⅠ部のみを `boys`/`girls` のフラットな
チーム/試合一覧として保持しており、複数リーグ・入替戦・年度間の昇降格を表現できなかった。
実際のSTリーグの構成を記録でき、SEO/UXも向上する構造に拡張する必要があった。

## Decision

- 参加チーム（participants.json）と各試合（matches.json）に `division`（`"1"`/`"2"`/`"3"`）
  フィールドを追加する。`"1"` が最上位。未設定は `"1"` とみなす。
- 開催回ごとのメタ情報を `data/st-league/{year}/league.json` に集約（開催回・会場・
  division構成・プレーオフ・成績）。
- 全体概要と年度間の昇降格履歴を `data/st-league/editions.json` に保持。
- 型定義・ローダー・順位計算を `src/utils/st-league.ts` に集約し、各ページから利用。
- `[year]` ページは `getStLeagueYears()` でパスを動的生成。

## Alternatives

- **リーグごとに別ディレクトリ**（league1/ league2/ …）：リーグが完全独立するが、
  年度横断の集計や共通選手の扱いが煩雑。1ファイルに `division` を持たせる方が
  既存構造との互換性が高く移行が容易と判断。
- **division を持たず別大会として年度を分ける**：入替戦・昇降格の関係を表現できず却下。

## Consequences

- 1つの participants/matches ファイルで全リーグを管理でき、ページはクライアント側の
  リーグ切替タブで表示を出し分けられる。
- `data/st-league/{year}/` を追加するだけでページが自動増加する。
- 既存2025データは全件 `division: "1"` に移行済み（Ⅰ部）。
- Ⅱ・Ⅲ部の対戦データは未入力。`league.json` の `hasMatchData: false` と
  ページ上の「準備中」表示でカバー。

## Related Files

- `data/st-league/2025/league.json`, `data/st-league/editions.json`
- `data/st-league/2025/participants.json`, `data/st-league/2025/matches.json`
- `src/utils/st-league.ts`
- `src/pages/st-league/index.tsx`, `about.tsx`, `[year]/matches.tsx`, `teams.tsx`, `analysis.tsx`
- `docs/wiki/st-league.md`

## Open Questions

- STリーグⅡ・Ⅲ の出場チーム・対戦データの入力（公式PDFからの手入力）。
- 年度間の昇降格確定情報（editions.json は一部 Assumption）。
