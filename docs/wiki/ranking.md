# ランキング仕様

年度ランキング（シーズンポイント制）の現行仕様のまとめ。2026-07-11 の較正・再分類決定を反映した最新版。
実装が正（wikiは二次成果物）。主な実装: `lib/playerStats/aggregators/rankingCompute.ts`・
`scripts/playerStats/generate-rankings.ts`・`data/ranking-config.json`。

## 一言でいうと

**「その年度、どの格の大会で、どこまで勝ち上がったか」を点数化し、上位3大会分を合算した実績ランキング**。
実力の推定（予測）ではなく実績の表彰であり、予測は将来のElo副指標に任せる役割分担を採る（2026-07-11決定）。

## 計算式

```
1大会の得点 = tier重み × 順位係数
シーズンポイント = その年度の上位3大会の得点合計（topNTournamentsPerSeason=3）
```

集計単位は **年度 × 種目（doubles）× 男女（boys / girls）**。混合の順位表は作らない
（競技慣行に合わないため、2026-07-02決定）。

**シングルスはポイントランキングから撤退（2026-07-11決定・実装済み）**: `config.ranking.disciplines`
を `["doubles"]` に変更。理由は、出場資格の非対称（学生は自カテゴリのシングルス大会＋オープンの
全日本シングルスの両方に出られるが、一般/社会人は実質1大会のみ）に topN合算が乗って不平等になり、
かつ一般シングルスは実質1大会で「ランキング」として意味が成立しないため。種目横断の実力は統合Elo、
シングルスの実績はタイトル記録（別導線・未設計）で扱う役割分担とする。singles は勝敗統計・H2H・勝率・
reachRate では引き続き有効カテゴリ（撤退はランキング集計のみ）。経緯:
[docs/raw/2026-07-11-idea-singles-ranking-retire.md](../raw/2026-07-11-idea-singles-ranking-retire.md)。

### tier重み（大会の格）

| tier | 重み | 判定 |
|---|---|---|
| major | 100 | `isMajorTitle`（4大全日本: 全日本選手権・全日本ミックス等） |
| national | 60 | `index.json` 掲載かつ国際・国際予選以外 |
| local | 20 | 上記以外（`local_index` 等） |

**tierOverrides（大会単位の上書き、2026-07-11導入）**: 機械判定のミスプライシングを config で個別修正する。
現在の上書き: 国際予選3つ（世界選手権予選・アジア選手権予選・アジア競技大会予選）と
ルーセント東京インドア → **major**、ヨネックス北海道 → **national**。
根拠はレート由来の大会強度監査（参加者の事前Elo平均で、これらが全日本インドア級と判明。
旧判定では国際系→localに落ちていた）。

### 順位係数（勝ち上がり）

| 最終順位 | 係数 |
|---|---|
| 優勝 | 1.0 |
| 準優勝 | 0.7 |
| ベスト4 | 0.5 |
| ベスト8 | 0.3 |
| 出場（ベスト8未満・予選リーグのみ等） | 0.1 |

例: 全日本選手権（major）優勝 = 100点、national大会ベスト4 = 30点。

## 除外・特殊ルール

- **国際大会の除外（2026-07-11決定）**: コリアカップ・平和カップひろしま（`generationId='international'`）は
  シーズンポイントに算入しない（`excludeTournaments`）。外国選手・ローマ字表記で名寄せと実力評価の
  信頼性が担保できないため。**ランキングのみの除外**で、勝敗統計・H2H等のfactsには残る。
  国際予選は全員国内選手のため除外しない。
- **retired（不戦勝/途中棄権）**: 順位（placement）には反映される（勝ち上がりは事実のため）。
  勝率系の統計から除外されるのとは扱いが異なる。
- **ポイント0以下は順位表に載せない**。
- **同点は同順位（1224方式）**: 同ポイントは同じ順位、次の選手は人数分飛ばす。

## 出力・表示

- 生成物: `data/rankings/{year}-{discipline}-{gender}.json`（例: `2025-doubles-boys.json`）。
  行 = `{rank, playerId, playerKey, playerName, team, points}`。`playerKey` は
  **その年度の所属**を刻む（現所属で過去年度を汚染しない）。
- 表示: `/rankings` ページ（上位100位・年度/男女切替。ダブルスのみ）と選手ページの「年度別ランキング推移」。
  データ駆動のため、`disciplines` から singles を外して再生成すればページ・選手ページ双方が自動で
  ダブルス限定になる（singles の順位表 JSON は generate-rankings の prune で削除）。
- **scope-limited 注記必須**: 集計は当サイト掲載大会分のみ。上位3大会合算は掲載偏りの補正
  （掲載大会数が年度・カテゴリで異なるため、出場数でなく上位実績で比較する）。

## パイプライン

```
data/tournaments/details/**（大会結果）
  → playerstats:facts（選手ごとの PlayerEntryFact = 1大会カテゴリ1件の最終順位）
  → playerstats:rankings（computeSeasonPoints → 全選手横断の順位表）
  → data/rankings/**.json → /rankings ページ・選手ページ
```

facts は不変のまま rankings 生成時に計算するため、config の tier・係数変更は
`playerstats:rankings --full` の再実行だけで反映される（facts 再生成・engineVersion 変更は不要）。

## 品質管理: バックテストによる較正（2026-07-11導入）

`scripts/ranking/backtest.mjs` が過去の全対戦（約27,000試合）で「上位認定側が実際に勝った率」を計測する。
係数調整は感覚でなくこの的中率で判断する運用。

- 現行設定の前年度スナップショット的中率: **68.1%**（両サイド前年度掲載の対戦のみ、カバレッジ約17%）。
- 順位係数のグリッドサーチでは flat係数＋topN=2 が+1pt だったが、実績表彰の性格を変えるため
  **現行維持を決定**（予測はElo副指標の領分）。
- `--rated-tier`（大会強度監査）を定期実行し、tier誤設定を検出したら `tierOverrides` に反映する運用ループ。

## Elo副指標（生成有効・内部利用のみ、2026-07-11〜）

`npm run ratings:generate`（`scripts/ranking/generate-ratings.mjs`）が統合Elo（選手1人に1本、
singles/doubles混合）を `data/ratings/current.json` に生成する。K は較正済み kByTier {80, 64, 48}、
scale 400。tierOverrides・国際大会除外はポイント式と同じ config をミラー。ダブルスはペア平均
レートで期待勝率を計算し両選手に同デルタ。retired は更新しない。10試合以上を `established` とし
1224方式で順位付与（それ未満は provisional 扱いで無順位掲載）。

**公開ページには未接続**（内部利用のみ）。用途はジャイアントキリング判定・大会強度監査・
スタイル分析のスキル統制。将来の公開に備え playerId join（established で100%解決）・
homonymRisk フラグを出力に持つ。表示設計の論点（負けると下がる数字の実名公開）は
[open-questions.md](./open-questions.md) 参照。予測的中率69.0%（ポイント式67.5%）・全選手カバー。

同じリプレイパスで **giant-killing 検知**も行う: 勝者の事前期待勝率が 0.15 以下の勝利を
`data/ratings/upsets.json` に出力（`rating.upset` で閾値設定。0.10以下は特大、両者 established 限定、
先読みなし）。さらに**敗者側（格上）が「その時点の established 上位5%以内」であること**を条件にする
（`minLoserTopPercentile`。単なるレート差でなく、破った相手がトップ層である保証。
上位境界は大会開始時点の分布から算出し、established 母数50人未満の時期は検知しない。
2026-07-11 ユーザー要望で追加、62→60件）。

**giant-killing の表示（2026-07-11 接続済み）**: milestone の `'giant-killing'` kind として
大会結果ページ（自動バッジ、タグ「金星」）と結果記事の素材（human-in-the-loop）に出す。
表現は数字なしの定性のみ（「◯◯ が格上の ◯◯ を破る金星」）で、レート・期待勝率は非公開。
scopeNote「『格上』は当サイト掲載大会分から算出した実力指標に基づく判定」を必ず添える。
champion-defeat（王者撃破）と同一試合の場合は金星を優先して重複抑制
（`suppressChampionDefeatIfDuplicate`）。実装: `lib/ratingsUpsets.ts` / `lib/milestones.ts`。
注意: 表示は `data/ratings/upsets.json` の鮮度に依存するため、大会データ追加後は
`npm run ratings:generate` を再実行してからビルドする。

## 決定の経緯（主要リンク）

- 集計ルールの確定: [players-pages.md](./players-pages.md)「確定した集計ルール」、
  [docs/raw/2026-07-01-player-statistics-engine.md](../raw/2026-07-01-player-statistics-engine.md)
- 較正・除外・再分類（2026-07-11）: [docs/raw/2026-07-11-ranking-calibration-harness-plan.md](../raw/2026-07-11-ranking-calibration-harness-plan.md)
  （バックテスト設計・K較正・グリッドサーチ・レーティング設計論点・tier監査）
- 残る Open Questions: [open-questions.md](./open-questions.md)「選手データベース拡張」節
  （Elo有効化の設計、ルーセント等の index.json 掲載可否）
