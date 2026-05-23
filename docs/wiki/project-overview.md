# Project Overview

## 概要

Softeni Pick は、ソフトテニスの大会結果、選手情報、チーム情報、試合スコアを整理して公開する Web サイトです。

確認根拠:

- `README.md`
- `src/pages/index.tsx`
- `src/pages/players/**`
- `src/pages/teams/**`
- `src/pages/tournaments/**`

## 現在の主要領域

### 1. 本体サイト

主な導線:

- 大会: `src/pages/tournaments/**`
- 選手: `src/pages/players/**`
- チーム: `src/pages/teams/**`
- 高校カテゴリ: `src/pages/highschool/**`
- 案内ページ: `src/pages/about.tsx`, `src/pages/faq.tsx`, `src/pages/privacy.tsx`

### 2. score 系機能

score 系は、試合単位の記録・公開・分析を扱う領域です。

主な導線:

- 記録管理: `src/pages/beta/matches/**`
- 公開一覧/詳細/分析: `src/pages/beta/matches-results/**`
- score 公開ラッパ: `src/pages/matches/**`
- API: `src/pages/api/matches/**`

## softeni-pick 本体と score 系機能の関係

実装上は別リポジトリではなく、同一コードベース内で `SITE_MODE` / `NEXT_PUBLIC_SITE_MODE` により公開面を切り替えています。

確認根拠:

- `lib/siteConfig.ts`
- `src/pages/matches/index.tsx`
- `src/pages/matches/[matchId]/index.tsx`
- `src/pages/matches/growth/index.tsx`
- `src/pages/beta/matches-results/**`

整理すると以下です。

- `softeni-pick` mode:
  本体サイトと beta 導線を持つ
- `score` mode:
  `/matches*` の閲覧用公開面を持つ

## 実装済み

- 大会・選手・チーム・高校カテゴリの静的ページ群
- 試合作成、ポイント入力、動画レビュー、公開用 JSON 生成
- `score.softeni-pick.com` 想定の公開 URL 切り替え

## Assumption

- Softeni Pick は個人運営または小規模運営のデータベース型メディアである
- score 系は本体機能の一部として始まり、後から公開面を分ける方向で整理されている

## Open Questions

- score 機能を本体サイトからどこまで分離するのが正式方針か
- `softeni-pick` mode と `score` mode の運用責務を将来どう切るか
