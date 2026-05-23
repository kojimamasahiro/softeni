# Score Analysis

## 概要

- `score` モードは試合結果と成長分析の閲覧公開面
- URL は `score.softeni-pick.com` 想定
- 実装の中心は `src/pages/matches/**` と `src/pages/beta/matches-results/**`
- 分析ロジックの主な実装は `lib/matchAnalysis.ts` と `lib/growthAnalysis.ts`

## 公開面

- `/matches`
- `/matches/[matchId]`
- `/matches/growth`

補足:

- `src/pages/matches/**` は `score` モード専用ラッパ
- 実データ表示ロジックは `src/pages/beta/matches-results/**` を再利用

## データソース

- `public/data/beta-matches/index.json`
- `public/data/beta-matches/matches/*.json`
- `public/data/beta-matches/growth/reports/*.json`
- `public/data/beta-matches/growth/targets.json`

## 分析ロジック

主なコード:

- `lib/growthAnalysis.ts`
- `lib/matchAnalysis.ts`
- `scripts/check-growth-analysis.mjs`

確認できた分析観点:

- サーブ系
- レシーブ系
- 重要局面系
- 流れ系
- ラリー系
- 決着内訳系

確認できた比較軸:

- `recent_period`
- `win_loss`
- `same_opponent`
- `same_tournament`
- `same_format`
- `same_pair`
- `opponent_level`

確認できた代表指標:

- サーブ時得点率
- 1stサービス成功率
- 1stサービス時得点率
- 2ndサービス時得点率
- ダブルフォルト率
- レシーブ時得点率
- 1ポイント目取得率
- 2-2後の次ポイント取得率
- デュースポイント取得率
- ゲームポイント取得率
- 連続得点/連続失点
- ラリー長ごとの得点率
- winner / error の内訳

## ルール依存

- 通常ゲーム先取点: 4
- ファイナルゲーム先取点: 7
- 2点差条件あり

根拠:

- `lib/matchRules.ts`

## 実装から確認できる集計単位

- 試合単位の比較
- チーム A / B の比較
- player / pair を target にした成長分析
- 比較条件ごとの current / previous 比較

確認根拠:

- `lib/matchAnalysis.ts`
- `lib/growthAnalysis.ts`

## サービス・重要局面・流れの整理

### サービス

- 1st サービス成功率
- 1st / 2nd サービス時得点率
- ダブルフォルト率

### 重要局面

- 1ポイント目
- 2-2 後の次ポイント
- デュースポイント
- ゲームポイント

### 流れ

- 最大連続得点
- 最大連続失点
- streak 区間

### ラリー傾向

- `1-2`
- `3-4`
- `5-8`
- `9+`
- `unknown`

### ポイント終了理由

- winner 数
- error 数
- `result_type` ごとの内訳

## 運用メモ

- 公開向けは静的 JSON 前提
- 入力・編集は `beta` 側と API 側に分離されている
- 動画レビュー候補の確定結果が `points` に落ち、分析対象データになる

## Assumption

- 成長分析は「試合中ポイント列が十分ある match」を前提にしている
- レポート JSON は定期または手動生成で、閲覧時オンデマンド計算ではない可能性が高い

## Open Questions

- 成長分析 JSON の正式な生成コマンドと更新タイミング
- `lib/matchAnalysis.ts` と `lib/growthAnalysis.ts` の責務境界
- 公開対象 match の抽出条件
- 指標採用の研究的根拠や現場根拠をどこまで持たせるか
