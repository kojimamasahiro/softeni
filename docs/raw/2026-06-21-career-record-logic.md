# Step3: career-record 生成ロジック 詳細設計

日付: 2026-06-21
状態: Draft（実装前の詳細設計。親仕様: `docs/raw/2026-06-21-news-auto-draft-design.md` / ADR-005）

## 位置づけ

文脈ブロック優先度A・実装順序 Step3。対象ペア/選手の「当サイト掲載大会分の通算成績」を出す。**ほぼ既存資産の再利用**で組める。

## 既存資産（確認済み）

`data/players/<slug>/analysis.json`（`generate-player-analysis.mjs` が `details/**`＋`information` から生成）に、必要な通算データが揃っている:

- `totalMatches` / `wins` / `losses` / `totalWinRate`
- `games`（total / won / lost / gameRate）
- `byPartner`（パートナー id ごとの成績）
- `byYear`（年度ごとの成績）
- `latestMatch`（直近大会・結果）

不足は**主要タイトル（優勝歴）**のみ。これは Step1 `lib/tournamentRecords.ts` の placements（優勝抽出）を選手 id で横断すれば得られる。

## 出力スキーマ

```ts
type CareerRecordBlock = {
  blockType: 'career-record';
  // 主役（個人 or ペア）
  subject: { playerIds: string[]; display: string };
  // 当サイト掲載範囲であることを必ず示すフラグ
  scope: 'site-covered'; // 描画側で「当サイト掲載大会分」と明示
  totals: {
    matches: number;
    wins: number;
    losses: number;
    winRate: number;
    games?: { total: number; won: number; lost: number; gameRate: number };
  };
  // 主要タイトル（優勝歴）。Step1 placements の winner を横断抽出
  titles: Array<{
    tournamentId: string;
    tournamentLabel: string;
    year: number;
    categoryLabel: string;
  }>;
  // 直近成績（analysis.latestMatch 由来）
  latest?: { tournament: string; date: string; result: string };
  // ペア成績（任意。byPartner から対象パートナーぶん）
  withPartner?: {
    partnerDisplay: string;
    matches: number;
    wins: number;
    winRate: number;
  };
};
```

## アルゴリズム

1. 主役 player id（速報/プレビューの主役ペア）を確定。
2. 各 id の slug を `data/players/index.json`／slug 規約で解決し `analysis.json` を読む。
   - ペアの「2人合算」ではなく、**各選手の通算**＋**そのペアでの成績**（`byPartner[partnerId]`）を出す（ペア=合算は意味が薄いため）。
3. `titles`: Step1 の placements 横断（全 tournamentId × year × category の winner）から、主役 id を含む優勝を抽出。`isMajorTitle`（`index.json`）で主要大会を優先表示。
4. `latest`: `analysis.latestMatch` をそのまま。
5. `scope: 'site-covered'` を必ず付け、描画側で「当サイト掲載大会分の通算」と明示（既存選手ページ文言「収録試合は通算◯試合…」と表現を統一）。

## 表記ルール（必須）

- 見出し/本文で**必ず「当サイト掲載大会分」を明示**し、生涯成績との誤認を防ぐ（ADR-005 / 親仕様の確定事項）。
- 既存 `src/pages/players/[id]/results.tsx` の文言（「収録試合は通算${total}試合${wins}勝${losses}敗」）と語を揃える。

## エッジケース

- `analysis.json` が無い選手（試合数が少なく未生成）: `totals` は details 横断のフォールバック集計、または「掲載試合が少ないため省略」。誤った 0 勝表示はしない。
- 名寄せ不能 id: その選手ぶんは省略（誤集計より欠落を選ぶ）。
- ペア変更が多い選手: `withPartner` は対象ペアのみに限定（全パートナー羅列はしない）。
- `titles` 重複（同一大会同一年に複数種目）: tournamentId+year+categoryId で一意化。

## テスト観点

- `analysis.json` がある選手（例: yano-soto, totalMatches=144）で `totals` が analysis.json と一致。
- `titles` が Step1 placements の winner と整合（優勝歴の取りこぼし・誤混入なし）。
- 名寄せ不能・analysis 欠落で例外を出さず、欠落として扱う。

## 次への接続

- 選手ページ（Step5）: career-record をプロフィール強化に再利用（analysis.json は既出だが titles 付きで密度向上）。
- milestone（Step2）: `totals.wins` を `career-wins` 判定の入力に供給。
- 記事（Step6-7）: 主役ペアの career-record を文脈ブロックとして差し込み。

## Open Questions（Step3 固有）

- ペア表示で「2人それぞれの通算」と「ペアでの通算」をどう併記するか（情報過多にしない見せ方）。
- `analysis.json` 未生成選手のフォールバック集計を Step3 で持つか、`generate-player-analysis.mjs` の生成対象を広げるか。
- `titles` の「主要タイトル」絞り込み基準（`isMajorTitle` のみか、全国大会も含むか）。
