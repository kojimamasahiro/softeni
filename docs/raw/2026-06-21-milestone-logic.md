# Step2: milestone 生成ロジック 詳細設計

日付: 2026-06-21
状態: Draft（実装前の詳細設計。親仕様: `docs/raw/2026-06-21-news-auto-draft-design.md` / ADR-005）

## 位置づけ

文脈ブロック優先度A・実装順序 Step2。`milestone` は ADR-005 の「イベント抽出」レイヤの最初の具体例。historical-winners（Step1）と career-record（Step3 の元データ＝`analysis.json`）を入力に、**意味のある出来事を構造化イベントとして抽出**する。

イベントは記事だけでなく大会ページ・選手ページ・ランキングでも再利用するため、`milestone` は「整形済み文章」ではなく**イベント列（構造化データ）**を一次出力とし、文章化は描画側に委ねる。

## 入力

- Step1 `HistoricalWinnersBlock`（年度別優勝者・`repeatChampion`）。
- `data/players/<slug>/analysis.json`（`totalMatches` / `wins` / `byYear` / `latestMatch` 等。既存 `generate-player-analysis.mjs` 出力）。
- 対象大会・対象年・対象エントリ（速報/プレビューの主役）。

## 出力スキーマ

```ts
type MilestoneKind =
  | 'first-title'        // 初優勝（この大会で）
  | 'repeat-title'       // 連覇（2連覇以上）
  | 'first-appearance'   // 初出場（当サイト掲載範囲で）
  | 'champion-defeat'    // 王者撃破（前回王者/連覇中ペアを破った）
  | 'career-wins'        // 通算N勝の節目（50/100…）
  | 'best4-first';       // ベスト4初進出

type MilestoneEvent = {
  kind: MilestoneKind;
  // 主役（個人=playerIds、団体=teamキー）
  subject: { playerIds?: string[]; team?: string; display: string };
  tournamentId: string;
  categoryId: string;
  year: number;
  // 種類別の補足（連覇年数・通算勝数・撃破相手など）
  detail: Record<string, string | number>;
  // 確信度: 'confirmed'（決定的に算出）/ 'scope-limited'（当サイト掲載範囲に依存）
  confidence: 'confirmed' | 'scope-limited';
  // 描画用の素文（テンプレ。文章生成はしない）
  label: string;
};

type MilestoneBlock = {
  blockType: 'milestone';
  events: MilestoneEvent[];   // 重要度降順
};
```

## 判定条件（語彙の確定）

すべて決定的に算出する。`analysis.json` / details が「当サイト掲載範囲」である以上、生涯記録と誤認させない確信度ラベルを付ける。

- `first-title`: 対象大会×種目の `historical-winners` で、主役の優勝が**掲載範囲で初**。`confidence: scope-limited`。label 例「（当サイト掲載大会では）◯◯初優勝」。
- `repeat-title`: Step1 `repeatChampion.streak>=2`。`streak=2`→「連覇」、`>=3`→「N連覇」。`detail.streak` / `detail.since`。`confidence: confirmed`（同一大会内の連続年は掲載範囲でも確定的）。
- `first-appearance`: `analysis.json.byYear` または details 横断で、主役の出場が掲載範囲で初年。`confidence: scope-limited`。
- `champion-defeat`: 対象大会の `matches` で、前回王者（前年 `historical-winners` の優勝ペア）または連覇中ペアに勝った試合がある。`detail.beaten`＝相手 display。`confidence: confirmed`（その試合の勝敗は確定）だが「前回王者」認定は掲載範囲依存のため注記。
- `career-wins`: `analysis.json.wins` が節目（50/100/150/200…）に到達。`detail.wins`。`confidence: scope-limited`（"掲載分通算"と明示）。
- `best4-first`: `historical-winners` 由来の placements（Step1 で best4 まで取得可能）で、主役のベスト4以上が掲載範囲で初。`confidence: scope-limited`。

### 重要度（並び順）

`repeat-title`（特に3連覇以上）> `first-title` > `champion-defeat` > `career-wins`（大きい節目ほど上）> `best4-first` > `first-appearance`。記事/ページで上位 N 件だけ出す運用を想定。

## エッジケース

- **団体戦**: `subject.team`＋team キー比較。playerIds は使わない。
- **名寄せ依存**: `career-wins` / `first-appearance` は playerId 解決に依存。解決不能なら当該イベントを**出さない**（誤った「初優勝」表示は信頼を損なうため、未確定は黙る）。
- **scope-limited の明示**: 描画側は `confidence: scope-limited` のイベントに「当サイト掲載分」を必ず添える（career-record と同じ表記規約）。
- **重複**: `first-title` と `best4-first` が同時成立しうる（初優勝は当然ベスト4初進出を含む）。`first-title` があれば `best4-first` は抑制する。
- **王者撃破の誤認**: 「前回王者」は前年優勝の掲載データに依存。前年データ欠落時は `champion-defeat` を出さない。

## テスト観点

- `zennihon-championship` 2022-2025 で連覇/初優勝の判定が手計算と一致。
- 名寄せ不能ケースでイベントが抑制される（誤出力ゼロ）。
- `confidence` が正しく付与され、scope-limited に掲載範囲注記が回る。

## 次への接続

- 大会ページ（Step4）: その年の `milestone.events` を見出し的に表示（farm に無い"物語"）。
- 選手ページ（Step5）: `career-wins` / `repeat-title` を選手の実績として再利用。
- 記事（Step6-7）: 主役の `milestone` を記事リード文の素材に。

## Open Questions（Step2 固有）

- `career-wins` の節目刻み（50 刻みか、100 から開始か、ジュニア/シニアでの妥当値）。
- イベント抽出を Step2 で薄く汎用化（`extractEvents(tournamentId, year)` の共通関数）しておくか、milestone 専用で書いて後で一般化するか（ADR-005 Open Question と連動）。
- `champion-defeat` の「王者」定義（前回優勝のみか、複数年連覇中も含むか）。
