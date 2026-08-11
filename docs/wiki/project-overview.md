# Project Overview

> 現行仕様。2026-08-12 に `src/pages/**` の構成と突き合わせ済み。
> 各領域の詳細は本ページではなく個別ページが正。ここは全体の地図に徹する。

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

- 大会: `src/pages/tournaments/**` → [tournaments-local.md](./tournaments-local.md)
- 選手: `src/pages/players/**` → [players-pages.md](./players-pages.md)
- チーム: `src/pages/teams/**` → [team-player-identity.md](./team-player-identity.md)
- 高校カテゴリ: `src/pages/highschool/**` → [highschool.md](./highschool.md)
- ランキング: `src/pages/rankings/**` → [ranking.md](./ranking.md)
- STリーグ: `src/pages/st-league/**` → [st-league.md](./st-league.md)
- ニュース（速報・プレビュー）: `src/pages/news/**` → [news-context-blocks.md](./news-context-blocks.md)
- 成長記録ショーケース: `src/pages/growth/**` → [score-feature.md](./score-feature.md)
- 案内ページ: `src/pages/about.tsx`, `src/pages/faq.tsx`, `src/pages/privacy.tsx`, `src/pages/contact.tsx`

ページ全体の構成と SEO 上の役割分担は [public-pages.md](./public-pages.md) と [seo.md](./seo.md)。

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

## 前提

- Softeni Pick は masahiro の個人運営によるデータベース型メディア
- 本番はサーバーレスの完全な静的サイト（Cloudflare Pages）。データ更新はローカルからの
  ビルドを通してのみ反映される → [backend.md](./backend.md)「実行モデル」
- score 系は本体機能の一部として始まり、後から公開面を分ける方向で整理されている

## Open Questions

- score 機能を本体サイトからどこまで分離するのが正式方針か。
  高レベル方針は [ADR-003](../adr/ADR-003-score-media-tool-separation.md)（閲覧公開＝メディア／
  ツール公開＝UGC の分離）で決着済みだが、ツール公開側の具体は未着手。
  一般公開・ピボットの検討は [score-general-availability.md](./score-general-availability.md)
