# 2026-09-24 開催前ブロックが会期終了後も「開催中」のまま残るバグ

## 経緯

アジア競技大会2026（ソフトテニス会期 2026-09-18〜09-23）のハブページ
（`/tournaments/international/asian-games/`）で、会期が終わった翌日（2026-09-24）に
「開催前」ブロックがまだ「開催中」バッジのまま出ていた、とユーザー報告。

## 原因

`src/pages/tournaments/[generation]/[tournamentId]/index.tsx` の `getStaticProps` が
`todayIso = new Date().toISOString().slice(0, 10)`（**ビルド時刻**）で `upcomingEntry`
（`endDate >= todayIso`）と `hasStarted`（`startDate <= todayIso`）を判定し、その結果を
静的 props としてページに焼き込んでいた。

このサイトは `output: 'export'` の静的書き出しで、Cloudflare Pages は **push 契機でしか
ビルドし直さない**（[deployment.md](../wiki/deployment.md)）。日次の再ビルドは無いため、
コミット 7fc7fc81（2026-09-23。会期中に作成）以降 push が無ければ、会期終了後もその時点の
判定がそのまま配信され続ける。

`docs/wiki/public-pages.md` は元々「開催前ブロックの『今日』は描画時に評価する
（`getTodayInTokyo()`）」と書いていた（`UpcomingTournaments.tsx`側の「これから開催」
リストが実際にそうしている）。ハブページの開催前ブロック側は仕様どおりに実装されておらず、
ビルド時刻に固定されたままだった＝**wiki の記述が正しく、実装がずれていた**ケース。

## 修正

- `index.tsx`: `getTodayInTokyo()`（`UpcomingTournaments.tsx` からimport）を**描画時**に呼び、
  `upcomingActive = !!upcoming && (!upcoming.endDate || upcoming.endDate >= today)` を計算。
  「開催前」ブロックの表示・`latestResults`（最新年度チップ）との重複回避判定の両方をこれに揃えた。
- `UpcomingTournamentSection.tsx`: 「開催中」/「開催予定」ラベルも渡された `hasStarted` を鵜呑みにせず、
  `data.startDate` と描画時の `getTodayInTokyo()` を比較して出し直す。

これにより、次のデプロイを待たずに**ブラウザでの再描画（ハイドレーション）時点で自己修復**する
（`UpcomingTournaments.tsx` の「これから開催」リストと同じパターン）。

## Compile Log

- wiki 側は記述を直していない。元の記述（「今日は描画時に評価する」）がそもそも正しかったため、
  今回の修正は実装をその仕様に合わせただけ。
