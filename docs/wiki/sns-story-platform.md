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

表の「状況・目的」は**状況と1行の目的・残りだけ**を書く（数値・経緯は raw へ。規則は [idea-backlog.md](./idea-backlog.md)「使い方」）。

| アイデア | 状況・目的（1行） | 詳細 |
|---|---|---|
| SNSストーリー生成基盤（構造化データ→LLM入力） | 発散フェーズ（2026-07-22起票）。要件定義済み。実装は新規が第一候補（既存milestone等との統合は重複コスト次第）、分類は既存へ無理にマッピングせず独立実装でよい方針 | [アイデア](../raw/2026-07-22-idea-sns-story-platform.md) / [要件定義](../raw/2026-07-22-sns-story-platform-requirements.md) |
| 展望記事: ドローの厳しさ（山の偏り）ストーリー | **発散フェーズ**（2026-07-31）。山の偏りを数値事実で語る。未来予測寄りで弱いため、主軸は大会インサイトへ移った | [アイデア](../raw/2026-07-31-idea-news-draw-difficulty-story.md) |
| 展望記事: 開催前のベスト8候補の絞り込み（事前予測＋答え合わせ） | **見送り**（2026-08-31）。「優勝予想はやらない」判断を維持。実測結果と副産物（データ密度指標など）は再開時の出発点として raw に保持 | [アイデア](../raw/2026-08-31-idea-pre-tournament-best8-forecast.md) |
| 大会インサイト: 過去の事実ベース5分類ストーリー（継続・逆転・成長・衰退・再会） | **実装済み・公開中**（設計 2026-08-01）。過去の事実だけで大会の読み物を作り、機械照合を通して年度別結果ページに出す。仕様は [tournament-insights.md](./tournament-insights.md)・[ADR-012](../adr/ADR-012-llm-authored-insights-with-machine-verification.md) | [アイデア](../raw/2026-08-01-idea-news-fact-based-story-categories.md) / [投稿案(全日本)](../raw/2026-08-01-sns-post-drafts-zennihon-championship-2025.md) / [投稿案(インターハイ)](../raw/2026-08-01-sns-post-drafts-highschool-championship-2025.md) / [機械照合](../raw/2026-08-01-story-text-verification.md) / [YAML](../story-yaml/README.md) |

## Open Questions

- 抽出ロジックを新規実装するか、既存（milestone/career-record/tournamentRecords等）と
  統合するか（判断材料は重複コストの実測）。
  → **5分類ストーリーについては既存統合で決着**（`lib/milestones.ts` に新kindを4つ足す形。
  2026-08-01）。基盤全体の方針としては未決。
- ストーリー分類の詳細語彙・粒度（要件定義は「例」止まり）。
  → **5分類ストーリーの範囲では決着**（`best8-streak`/`team-best8-streak`/`self-best`/
  `streak-stopped` の4kindを追加し、`KIND_IMPORTANCE` の既存優先度の下に挟む。2026-08-01）。
- 評価情報（希少性・季節性・話題性・保存価値）の算出方法。
  → **希少性は実測の出現頻度で代替できると判明**（kind別に0.09〜0.86件/組を実測）。閾値設計に
  使えば別立ての評価スコアは当面不要。季節性・話題性・保存価値は未決。
- JSON/YAMLの詳細スキーマ、根拠データ（対象データの型・ID体系）の参照方法。
  → **`related` フィールドの語彙とID採番規則は決着**（2026-08-01）。スキーマ全体は未確定。
- LLM入力後の実際の投稿本文への組み替え方法（プロンプト設計・媒体別テンプレ）は
  今回のスコープ外だが、将来的な接続イメージの整理は必要。
  → **出力先はSNS（X/Threads）でサイトには載せないと決定**（2026-08-01）。媒体別テンプレと
  投稿頻度は依然未検討。
- （新規）高校・中学カテゴリの供給不足。学校単位の継続で一部は埋まるが、高校14組中3組は
  依然0件になる。検出網の拡張が必要か、一般カテゴリに集中するかの判断が残る。

## 関連

- [ADR-005](../adr/ADR-005-news-context-block-architecture.md)
- [news-context-blocks.md](./news-context-blocks.md)
- [rare-events.md](./rare-events.md)
- [data-model.md](./data-model.md)（Knowledge Graphアイデアとのレイヤ関係）
- [score-general-availability.md](./score-general-availability.md)
