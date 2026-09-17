# Wiki Index

この Wiki は、Softeni Pick の現在の仕様・設計・運用を Markdown で整理するための入口です。
ページ数が増えたため、カテゴリ別に整理しています（2026-08-01 再編成）。

## 適用範囲の印（2026-09-18 追加）

各ページ名の後ろの印は、**他競技へ仕組みを持ち出すときにそのまま使えるか**を表す。
`汎用`＝どの競技でも使える / `学校`＝日本の学校スポーツ（インターハイ・全中等）なら共通 /
`固有`＝ソフトテニス固有 / `混在`＝節によって違う。

**初回の印はページ冒頭だけを見て付けた（Assumption）**。ページを圧縮するときに本文を読んで、
ページ冒頭の「適用範囲」で確定させる（手順は [slim-wiki-page.md](../prompts/slim-wiki-page.md)）。
確定済みは `seo.md` のみ。背景は [raw/2026-09-18-idea-multi-sport-expansion.md](../raw/2026-09-18-idea-multi-sport-expansion.md)。

## 全体像・基盤

- [Project Overview](./project-overview.md) `固有`
- [Architecture](./architecture.md) `汎用`
- [Data Model](./data-model.md) `混在`
- [Data Import](./data-import.md) `混在`
- [Deployment](./deployment.md) `汎用`

## Score機能（score.softeni-pick / 動画レビュー）

- [Score Feature](./score-feature.md) `固有`
- [Score Site Link](./score-site-link.md) `混在`
- [Score Analysis](./score-analysis.md) `固有`
- [Score 一般公開・新機能ピボット検討](./score-general-availability.md) `固有`

## 公開ページ（softeni-pick）

- [Public Pages](./public-pages.md) `混在`
- [UX Writing（UI文言ルール）](./ux-writing.md) `汎用`
- [Players Pages（選手ページ）](./players-pages.md) `混在`
- [ランキング仕様](./ranking.md) `混在`
- [Highschool Pages（高校カテゴリ）](./highschool.md) `学校`
- [Primary School Pages（小学生カテゴリ）](./primaryschool.md) `学校`
- [Secondary School Pages（中学カテゴリ）](./secondaryschool.md) `学校`
- [University Pages（大学カテゴリ・高校→大学の進路）](./university.md) `学校`
- [Tournaments Local](./tournaments-local.md) `混在`
- [STリーグ](./st-league.md) `固有`
- [SEO（カニバリ/重複制御）](./seo.md) `混在`
- [高校SEO M4検証ランブック（GSC事後検証・2026年8月中旬に実行）](./highschool-seo-m4-verification.md) `学校`
- [回遊検証ランブック（GA4 / AdSense）](./circulation-verification.md) `汎用`
- [開催前の大会・国際大会の露出 実行ランブック](./upcoming-tournaments-runbook.md) `混在`

## コンテンツ生成・ストーリー

- [大会インサイト（結果ページの「注目ポイント」）](./tournament-insights.md) `混在`
- [文脈ブロック / 速報・プレビュー機能](./news-context-blocks.md) `混在`
- [希少イベント検知（この試合の名場面）](./rare-events.md) `固有`
- [SNSストーリー生成基盤](./sns-story-platform.md) `汎用`
- [SNS 1日目投稿画像](./sns-day1-images.md) `混在`

## データ運用

- [チーム・選手の名寄せと識別](./team-player-identity.md) `混在`

## 運用・その他

- [Open Questions](./open-questions.md) `汎用`
- [Idea Backlog 索引](./idea-backlog.md) `汎用`
- [backend.md](./backend.md) `汎用`
- [database.md](./database.md) `固有`
- [android.md](./android.md) `汎用`
- [monetization.md](./monetization.md) `汎用`

## 運用補助

- [docs/README.md](../README.md)
- [raw/README.md](../raw/README.md)
- [ADR README](../adr/README.md)
- [ADR Template](../adr/ADR-000-template.md)
- [Prompt README](../prompts/README.md)
