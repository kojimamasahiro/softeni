# アイデア: シングルスのポイントランキング廃止（種目区別の整理）

## 状況

**実装済み（2026-07-11、B案）**。`config.ranking.disciplines` を `["doubles"]` に変更し、
シングルスのポイントランキングを撤退。順位表 JSON を doubles 限定で再生成、singles の JSON は削除済み。
`/rankings` ページ・選手ページの「年度別ランキング推移」はデータ駆動のため自動でダブルス限定に。
残タスク: シングルスのタイトル記録の導線（未設計）と統合Elo公開の判断（別スレッド）。
既存の [ranking.md](../wiki/ranking.md) 仕様（年度×種目×男女）の見直し。

## 目的

シングルスの年度ポイントランキングが構造的に不平等かつ「ランキングとして無意味」になっている
問題を解消する。ダブルスのランキングと統合Eloの役割を汚さずに、各表示面を1役割に整理する。

## 何が問題か（データで確認済み）

- **出場資格の非対称**: 学生は「自カテゴリのシングルス大会（学生選手権・ハイスクールJC＝national）」と
  「オープンの全日本シングルス（major）」の**両方**に出られるが、一般/社会人は事実上
  全日本シングルスの1大会だけ。そこに `topN=3 合算` が乗るため、出場機会の多い属性ほど加点が積める。
- **実例（2025 男子シングルス）**:
  - 上松俊貴（NTT西日本＝社会人）: 全日本シングルス **優勝**（major 100点）→ **4位**
  - 橋場柊一郎（法政大学）: 全日本シングルス **準優勝**（70点）＋ 全日本学生 **優勝**（national 60点）
    → 合計 130点 → **1位**
  - 唯一のオープン最高峰タイトルの優勝者が、同大会の準優勝者（学生）より下に来る逆転が発生。
- **単一大会ランキングの無意味さ**: 季節ポイントランキングの価値は複数大会の集約で単発のブレを
  均すこと。カテゴリ別に分割すると一般シングルスは1大会になり、それは「その大会の順位表」そのもので
  ランキングとしての付加価値がゼロ。→ カテゴリ分割（旧案3）はこの理由で退化する。
- **レートは既に統合済み**: `scripts/ranking/generate-ratings.mjs` は選手1人1本
  （singles/doubles 混合）。しかもその統合Eloでは 上松=1位・橋場=2位 と逆転が起きていない。
  「実力推定では種目を分けない」判断は既に下しており、ポイント式だけが分割を引きずっている状態。

## 決定: B案（シングルスだけ廃止）

検討した2択:

- **A案（種目区別を無くす＝singles/doubles統合の1本ポイントランキング）** — 却下。
  - ポイント式を「横断的な総合順位」に変えるが、それは統合Eloが既に担っており役割が重複する。
  - ソフトテニスの主戦場ダブルスの「今年一番のペア」がポイントで言えなくなる。
  - 種目をまたぐと出場機会の非対称（学生が両種目のタイトルをスタック）が**看板の総合ランキングに
    入り込む** → 問題を消すどころか一番目立つ所に持ち込む。
  - Aが正解になるのは「種目関係なく選手1人の総合順位を1本だけ見せたい」という product 判断をした
    場合のみ。ただしその1本は統合Eloが既に持っているため、ポイントで作り直す実益は薄い。
- **B案（シングルスのポイントランキング廃止・ダブルスは維持）** — 採用。各面が1役割に整理される:
  - ダブルスのポイントランキング → 多数大会で集約が効く、意味の成立した実績ランキング
  - 統合Elo → 種目横断の実力（上松＞橋場の逆転も起きない、検証済み）
  - シングルス → 全日本シングルスの**タイトル記録**（優勝・入賞者）として提示。“ランキング”とは呼ばない
  - 不平等の元（薄いシングルスランキング）を看板から外に出せて、ダブルスとEloは汚れない。

## ユーザーが興味を持った点

- 「レーティングに関しては混ぜた気がする。1大会のランキングに意味はあるのか？」
  → 統合Elo既存の事実と「単一大会ランキングの無意味さ」を自ら結び付け、廃止方向を主導。
- 2択（種目区別を無くす / シングルスだけ無くす）を明示的に問い、B案を選択。

## 目指したい方向性

- ポイントランキング生成（`generate-rankings.ts` / `rankingCompute.ts`）を **doubles 限定**にする。
  `data/ranking-config.json` の `ranking.disciplines` から `singles` を外すのが最小変更の候補。
- `/rankings` ページと選手ページの「年度別ランキング推移」からシングルス切替を撤去。
- シングルスは全日本シングルスの**優勝・入賞者記録**として別導線で提示（既存の historical-winners /
  title 系パイプラインに寄せられるか要検討）。
- 横断実力の見せ方は統合Eloの公開判断（open-questions.md）に委ねる。本件では変更しない。

## 課題・未解決

- 既存 `data/rankings/*-singles-*.json` の扱い（生成停止のみか、削除するか、Deprecated 明記か）。
- シングルスのタイトル記録を「どの導線・どのページ」で見せるかは未設計。
- 過去に `/rankings` のシングルスへ張られた内部リンク・SEO の後始末。
- backtest ハーネスの singles 関連メトリクスの位置づけ（ポイント式からは外れるが Elo 側では残る）。

## 関連

- [docs/wiki/ranking.md](../wiki/ranking.md)（現行のランキング／統合Elo仕様。集計単位＝年度×種目×男女）
- [docs/raw/2026-07-11-idea-ranking-calibration-harness.md](./2026-07-11-idea-ranking-calibration-harness.md)（較正ハーネス。的中率で係数を判断する基盤）
- [docs/raw/2026-07-11-idea-giant-killing-ranking.md](./2026-07-11-idea-giant-killing-ranking.md)（統合Eloの受益者）
- [docs/wiki/open-questions.md](../wiki/open-questions.md)「選手データベース拡張」節（統合Elo公開の判断）
- `data/ranking-config.json`（`ranking.disciplines`）

## 実装メモ（2026-07-11）

変更ファイル:

- `data/ranking-config.json`: `ranking.disciplines` → `["doubles"]`（`_disciplines_note` 追記）。
- `lib/playerStats/config.ts`: `DEFAULT_CONFIG.ranking.disciplines` → `['doubles']`。
- `lib/playerStats/__tests__/config.test.ts`: 既定値 assertion を `['doubles']` に更新。
- `lib/playerStats/aggregators/rankingCompute.ts`: 対象 discipline のコメントを doubles 限定に。
- `src/pages/rankings/index.tsx`: `TAB_ORDER`/`DISCIPLINE_LABEL`/ファイル正規表現/コピーからシングルス除去。
- `src/components/PlayerStatisticsSections.tsx`: 「年度別ランキング推移」の注記をダブルス基準に
  （`DISCIPLINE_LABEL` の singles は勝敗内訳表示で使うため残置）。
- `data/rankings/*-singles-*.json`: 削除（10ファイル）。doubles 14ファイルを `--full` で再生成。

検証: `playerstats:test` 全 pass、`tsc --noEmit` で編集ファイルにエラー無し、`data/rankings` に
singles の残留なし、2025-doubles-boys は 5946行・首位 矢野颯人 270点で不変。

## 追記: 同点をシングルス best-1 で並び替え（2026-07-11、実装済み）

撤退後に別の課題が浮上: ダブルス採点は成績がペアに等分されるため、同じペアは同点になり区別できない。
さらに点数が離散的で取りうる値が少なく、同点の塊が多い（2025男子ダブルス上位50人で異なる点数は22種のみ）。

ユーザー提案（原文）:「シングルスの結果を並び順に反映するのはどう？ ダブルスというカテゴリではなく
男子、女子だけにして、基本はダブルスでの採点だが、並びの中にシングルスの好成績がわかってその順にする」。

→ **A案（シングルス合算）の復活ではなく、同点時の並び替えキーにのみシングルスを使う中間案**として採用。
採点はダブルスのまま、表示は男女1本の板、同点順はシングルス best-1 で決める。

決定した機構:

- シングルス評価値 = **best-1**（その年の最高シングルス成績1大会の entryScore・合算しない）。
  ユーザー選択（AskUserQuestion）で best-1 を採用。合算だと出場機会の多い層が有利になり、撤退させた
  不平等が並び順に再流入するため（橋場は best-1=70 で 130 にならず、上松100 の下）。
- 順位（1224）のタイは `(points, singlesBest)` 完全一致時のみ。両者ノーシングルスの同点は同順位のまま。
- 表示は好成績（優勝〜ベスト8）のみバッジ化。単なる出場（best-1=10 等）は数値順位には効くが表示しない。

検証（2025）: 男子ダブルス200点タイ → 上松〈全日本S優勝100〉5位・橋場〈全日本S準優勝70〉6位・
菊山〈10〉7位に分離。230点タイ（丸山=上岡, ともに10）は同順位のまま。女子240点タイ → 岩倉〈S ベスト4=50〉が
高橋〈10〉の上。撤退時の 上松＞橋場 の直感とも一致。

変更ファイル（追加分）:

- `lib/playerStats/aggregators/rankingCompute.ts`: `singlesBestBySeason` と `SinglesBest` 型・
  `notablePlacementLabel` を追加。
- `lib/playerStats/aggregators/ranking.ts`: `RankingFile` の entry に `singlesBest?`・`singlesTitle?` 追加。
- `scripts/playerStats/generate-rankings.ts`: Row に singles フィールド、同点を singlesBest 降順で並び替え、
  1224 順位を `(points, singlesBest)` 複合キー化、diff 署名に singles を含め、entries に出力。
- `src/pages/rankings/index.tsx`: 種目タブ廃止（tabLabel は男女のみ）、シングルス列/バッジ追加、
  同点順の説明コピー、getStaticProps で singlesTitle 読み込み。

## Compile Log（2026-07-11）

- wiki（ranking.md）へ反映: 集計単位を doubles 限定に更新、撤退の理由と役割分担、prune 挙動を追記。
- 索引（score-general-availability.md）: Idea Backlog 行の状況を「実装済み」に更新。
- 意図的に wiki へ載せなかった: 個別の変更ファイル一覧・検証コマンド（この raw の実装メモに保持。
  wiki は現状仕様のみを持つ方針のため）。
- 未対応（別スレッド）: シングルスのタイトル記録導線の設計、統合Elo の公開判断（open-questions.md）。
