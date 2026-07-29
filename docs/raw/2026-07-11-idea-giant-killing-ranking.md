# アイデア: 勝敗・大会単位の希少性検知（ランキング機能と連動）

## 状況

Idea Backlog。発散フェーズ、未着手（2026-07-11時点）。詳細設計はしていない。

## 目的

「[希少ポイント/ゲームイベント検知](./2026-07-11-idea-rare-point-event-sns.md)」の姉妹案。
あちらはポイント単位（score機能での新規手動記録が前提）だったが、こちらは
**既存の大会結果データだけで完結する**別ルート。新しい記録労力を必要とせずに、
「珍しい・語れる出来事」を見つけて発信することを目指す。

## ユーザーが興味を持った点

ユーザー（masahiro）が明示的に「おもしろい」と反応した案。原文:
「ランキング機能と組み合わせることでジャイアントキリングの評価ができそう。おもしろい。
まずはランキング機能の精度向上を行う必要がありそう。それができれば希少性への付加価値になりそう。
それ以外もランキングにかかわらずmilestoneに使えそう。」
ランキング機能と組み合わせる部分そのものへの興味に加え、「ランキングに関わらない部分も
milestoneにそのまま使えそう」という汎用性の高さも評価されていた点として記録しておく。

## なぜこの案が有力か

- サイトはすでに`data/tournaments/details/**`という大会結果データを多数の大会・年度分持っている。
  新規記録が不要なので、point単位版が抱える「記録労力に対する歩留まりの低さ」という課題を避けられる。
- `historical-winners` / `milestone` / `career-record`パイプライン（ADR-005）はすでに
  勝敗・順位ベースの希少性検知の一部を持っている。`champion-defeat`（前回王者を破った）は
  すでに一種のジャイアントキリング検知になっており、この案はその自然な拡張として位置づけられる。

## 2つの系統

### A. ランキング機能に依存する部分（ジャイアントキリング検知）

「格下が格上を破った」を判定するには、選手の実力を表す指標が要る。現状検討中の
`data/ranking-config.json`（tier・順位係数、上位3大会合算方式）と接続できれば実現できそうだが、
このランキング機能自体がまだ運用開始前で、tier・順位係数・各種閾値は
「運用開始後に実データで微調整する」段階（`docs/wiki/open-questions.md`「選手データベース拡張」節）。

**→ ランキング機能の精度向上が、この系統の前提条件になる。**

### B. ランキング機能に依存しない部分

以下はランキングの精度に関係なく、milestoneエンジンにそのまま追加できそう。

- 無敗優勝（1ゲームも落とさず優勝）
- 記録的な連勝・連敗
- 大会史上初の出来事（例: 初めて他地域勢が優勝した）
- 何年ぶりかの記録更新

## 目指したい方向性

- まずBの「ランキングに依存しない部分」から着手できそう。milestoneエンジンの`MilestoneKind`を
  拡張する形で、既存の設計（`docs/raw/2026-06-21-milestone-logic.md`）を壊さずに足せるはず。
- Aの「ジャイアントキリング検知」は、ランキング機能の精度向上（tier係数調整、K値等の議論を含む）と
  並走する形になりそう。ランキング機能側の成熟が先行条件。
- 将来的には、姉妹案「[希少ポイント/ゲームイベント検知](./2026-07-11-idea-rare-point-event-sns.md)」と
  合流し、「大会の記録的な結果」と「その試合の中で起きた劇的な瞬間」を両方カバーする発信の仕組みに
  育てられるかもしれない。

## 課題・未解決

- ジャイアントキリング判定の具体的な数式・閾値（ランキング差がどれだけあれば「番狂わせ」と言えるか）。
- Bの各カテゴリも、実際の出現頻度を確認していない（point版のパイロットチェックのように、
  「無敗優勝」や「大会史上初」が本当に珍しいかどうかは未検証）。
- milestoneエンジンへの新カテゴリ追加が記事生成（ADR-005）の他の部分にどう影響するかは未検討。

## 関連

- [docs/raw/2026-07-11-idea-rare-point-event-sns.md](./2026-07-11-idea-rare-point-event-sns.md)（姉妹案: ポイント単位版）
- [docs/raw/2026-07-11-score-general-availability-research.md](./2026-07-11-score-general-availability-research.md)（検討の経緯）
- [docs/raw/2026-06-21-milestone-logic.md](./2026-06-21-milestone-logic.md)（既存milestoneエンジンの設計）
- [docs/wiki/score-general-availability.md](../wiki/score-general-availability.md)（Idea Backlog索引）
- [docs/wiki/open-questions.md](../wiki/open-questions.md)「選手データベース拡張」節（ランキング機能の精度に関するOpen Questions）
- [docs/adr/ADR-005-news-context-block-architecture.md](../adr/ADR-005-news-context-block-architecture.md)

## 詳細検討（2026-07-11 追記）

企画（ターゲット分析）＋実装構成（MilestoneKind追加案・頻度検証・A系統閾値較正・P0〜P4フェーズ）を
[2026-07-11-giant-killing-milestone-plan.md](./2026-07-11-giant-killing-milestone-plan.md) に作成した。
要点: 主対象は既存読者（結果に「意味」を足すSEO差別化資産）、B系統3種を先行しP0で全既存データへの
頻度検証を必須化、giant-killing はランキング較正後に判定関数分離（`lib/upsetDetection.ts`）で投入。

## P0 頻度検証 完了（2026-07-30 追記）

B系統3カテゴリの出現頻度を全大会データ（307エディション）で検証した。`perfect-title`（無敗優勝、
3.3%）・`title-streak-gap`（◯年ぶりN回目、2.9%）は希少性の体感と合い採用。`first-region`（地域初優勝）
は収録年数が薄いため実質「連覇でない優勝」とほぼ同義になり不採用（詳細・データは plan ファイル
「P0 頻度検証結果」参照）。次はP1（perfect-title / title-streak-gap の milestone エンジン実装）。

## P1 実装 完了（2026-07-30 追記）

`lib/milestones.ts` に `perfect-title`（無敗優勝）を新規kindとして追加。`title-streak-gap`は
既存の`nth-title`が同じ条件で既に発火していたため、別kind新設ではなく `nth-title` のラベルに
「◯年ぶり」の年数ギャップを追加する形で統合した。大会結果ページ・選手ページ・記事生成は既存の
汎用イベント消費経路（kind文字列でフィルタしない設計）のため無改修で新イベントを拾う。
実データ5ケースで動作確認済み・tsc/eslintエラー0件。詳細は
[giant-killing-milestone-plan.md](./2026-07-11-giant-killing-milestone-plan.md)「P1 実装結果」。
残る作業はP2（win-streak、analysis.json時系列拡張が前提）とP4（発信キュー合流）。
