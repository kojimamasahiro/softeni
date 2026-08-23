# ADR 運用

## 目的

`docs/adr/` は、後から「なぜその判断をしたのか」を確認したくなる重要判断だけを残す場所です。

すべてを ADR 化しません。

## ADR 化する基準

- アーキテクチャやデータフローが変わる
- 公開 URL やドメイン分離の方針が決まる
- 共有方式や認可方式のように後戻りコストが高い
- 分析方法や monetization のように長期的な前提になる

## ADR 化しないもの

- 軽微な文言変更
- 局所的な UI 調整
- 一時的な運用メモ
- raw メモに残せば十分な調査途中案

## softeni-pick で ADR 候補になりやすい例

- score ドメイン分離
- points 中心のスコアデータモデル
- `public_slug` / `edit_token` による共有方式
- YouTube ポイント時刻連携
- 分析カードの見せ方

## テンプレート

- [ADR-000-template.md](./ADR-000-template.md)

## ADR 一覧

Status は各 ADR の `## Status` 節が正。この表は所在地インデックス。

| ADR | タイトル | Status |
|---|---|---|
| [ADR-001](./ADR-001-local-source-detection-store.md) | 地方大会候補検知ストアを公開データから分離する | Accepted |
| [ADR-002](./ADR-002-st-league-division-model.md) | STリーグの階層（division）データモデル | Accepted |
| [ADR-003](./ADR-003-score-media-tool-separation.md) | score の「閲覧公開（メディア）」と「ツール公開（UGC）」の分離方針 | Accepted（高レベル方針） |
| [ADR-004](./ADR-004-growth-analysis-visibility-consent.md) | 成長分析の公開境界と同意レベル（段階公開モデル） | Draft |
| [ADR-005](./ADR-005-news-context-block-architecture.md) | 速報・プレビュー機能を「文脈ブロック一次成果物 + イベント抽出」で作る | Accepted（LLM不使用部分は ADR-012 が一部 Superseded） |
| [ADR-006](./ADR-006-two-pane-navigation-layout.md) | 公開サイトのナビを左サイドバー型2ペインへ刷新する | Accepted（高レベル方針） |
| [ADR-007](./ADR-007-in-progress-tournament-standing.md) | 大会途中の成績を `results`（`rank.kind:'ongoing'`）として保持する | Accepted |
| [ADR-008](./ADR-008-st-league-match-detail-page.md) | STリーグ 対戦詳細ページ（個別対戦の独立URL化） | Accepted |
| [ADR-009](./ADR-009-st-league-team-pages.md) | STリーグ出場チームの `/teams/[teamId]` ページ生成と相互リンク | Accepted |
| [ADR-010](./ADR-010-retire-result-articles-consolidate-to-hub.md) | 結果記事（/news *-result）を廃止し大会ハブに集約する | Accepted |
| [ADR-011](./ADR-011-player-statistics-engine.md) | 選手集計を Player Statistics Engine へ一本化する | Accepted |
| [ADR-012](./ADR-012-llm-authored-insights-with-machine-verification.md) | サイト本文でのLLM利用を「機械照合を通ったものに限り可」とする | Accepted |
| [ADR-013](./ADR-013-scoped-team-name-aliases.md) | チーム名 alias に大会スコープ（scope）を導入する | Accepted |
| [ADR-014](./ADR-014-pathway-name-match.md) | 進路（中学→高校）の採用条件を「氏名一致＋年差5年以内」に緩和する | Accepted |
| [ADR-015](./ADR-015-knockout-draw-by-group.md) | 決勝トーナメントの席順は「予選リーグの組」に持たせる（`knockoutDraw`） | Accepted |
| [ADR-016](./ADR-016-manual-adsense-units-over-auto-ads.md) | 広告は自動広告のページ内挿入をやめ、手動枠（AdUnit）で位置と高さを固定する | Accepted |
