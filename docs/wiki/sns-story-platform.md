# SNSストーリー生成基盤

## ステータス

Draft（2026-07-22 起票）。まだ意思決定していない発散フェーズ。要求・要件定義は完了、
設計フェーズは未着手。一次ソース:
[docs/raw/2026-07-22-sns-story-platform-requirements.md](../raw/2026-07-22-sns-story-platform-requirements.md)。

## 概要

大会・学校・選手・試合データから発信価値のあるストーリーを抽出し、JSON/YAML形式の
構造化データとして出力する共通基盤。出力はLLMへそのまま入力できる形式にし、
X・Threads・SEO記事・プッシュ通知・ホーム画面・メール等への横展開を狙う。
年内Xフォロワー1,000人がゴールの一つ。

要件の要点（詳細は一次ソース参照）:

- ストーリー抽出結果はJSON/YAML、機械可読な構造化データ（自然文ではない）
- 推測・主観・評価表現を含めず、DBから導出可能な事実のみを保持
- 分類情報（例: Ranking / Record / Comparison / Milestone / Player / School / Trivia）を持ち、将来拡張可能
- 生成の根拠となる対象データ（大会/試合/学校/選手/ランキング）を保持
- 発信優先度判断のための評価情報（希少性/季節性/話題性/保存価値）を保持。算出方法は実装非依存
- 実装方式・LLM・大会種別に依存しないインターフェース

## 既存の近縁の取り組み

同種の「データ→イベント抽出→再利用」構造を持つ先行実装・検討が複数ある。
新規実装するか統合するかの判断材料として整理する。

- **ADR-005 / [news-context-blocks.md](./news-context-blocks.md)**: 大会データ→
  イベント抽出→文脈ブロック（一次成果物）→大会/選手/ランキング/記事への再利用という
  骨格がほぼ同型。ただし「本文はテンプレートのみ・LLM不使用」を明示決定しており、
  本アイデアはそこからのLLM方針転換にあたる（LLMに本文自動生成させるのではなく、
  LLM入力可能な構造化データを用意するところまでがスコープ）。
- **[rare-events.md](./rare-events.md)**: score機能のポイントデータ限定で、分類・根拠・
  評価・再利用をすでに持つ先行実装（試合詳細ページ表示＋X投稿テンプレ生成）。
  対象は大会・学校単位のデータには及ばない。
- **抽出ロジックの分散**: `lib/milestones.ts` / `lib/careerRecord.ts` /
  `lib/tournamentRecords.ts` / `lib/majorTitles.ts` 等、大会データからイベント・関係を
  再構築するロジックが機能ごとに個別実装されている
  （[data-model.mdのKnowledge Graphアイデア](./data-model.md)で重複実態を確認済み）。

## 発展候補アイデア一覧（Idea Backlog）

まだ発散フェーズ。

| アイデア | 状況・目的（1行） | 詳細 |
|---|---|---|
| SNSストーリー生成基盤（構造化データ→LLM入力） | 発散フェーズ（2026-07-22起票）。要件定義済み。実装は新規が第一候補（既存milestone等との統合は重複コスト次第）、分類は既存へ無理にマッピングせず独立実装でよい方針 | [アイデア](../raw/2026-07-22-idea-sns-story-platform.md) / [要件定義](../raw/2026-07-22-sns-story-platform-requirements.md) |

## Open Questions

- 抽出ロジックを新規実装するか、既存（milestone/career-record/tournamentRecords等）と
  統合するか（判断材料は重複コストの実測）。
- ストーリー分類の詳細語彙・粒度（要件定義は「例」止まり）。
- 評価情報（希少性・季節性・話題性・保存価値）の算出方法。
- JSON/YAMLの詳細スキーマ、根拠データ（対象データの型・ID体系）の参照方法。
- LLM入力後の実際の投稿本文への組み替え方法（プロンプト設計・媒体別テンプレ）は
  今回のスコープ外だが、将来的な接続イメージの整理は必要。

## 関連

- [ADR-005](../adr/ADR-005-news-context-block-architecture.md)
- [news-context-blocks.md](./news-context-blocks.md)
- [rare-events.md](./rare-events.md)
- [data-model.md](./data-model.md)（Knowledge Graphアイデアとのレイヤ関係）
- [score-general-availability.md](./score-general-availability.md)
