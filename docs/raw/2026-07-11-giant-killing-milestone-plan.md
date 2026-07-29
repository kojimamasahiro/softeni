# 詳細検討: 勝敗・大会単位の希少性検知（milestone拡張＋ジャイアントキリング）

日付: 2026-07-11
状態: Draft（詳細検討。親: [2026-07-11-idea-giant-killing-ranking.md](./2026-07-11-idea-giant-killing-ranking.md)）
位置づけ: 既存の大会結果データだけで完結する（新規記録労力ゼロ）。ユーザーが「おもしろい」と反応した案。

## 1. 誰に刺さるか（ターゲット分析）

姉妹案（ポイント単位版）と違い、素材が「勝敗・順位」なので刺さり方は**物語**寄り。

| 層 | 刺さる理由 | 期待する行動 |
|---|---|---|
| **既存読者**（大会結果を検索・閲覧する層） | 結果表に「初優勝」「◯年ぶり」「王者撃破」の一行が付くだけで、farm 的な結果貼り付けサイトと決定的に差が付く。読者は結果でなく**意味**を求めている | 滞在時間・回遊・リピート。SEO 差別化（ADR-005 の設計意図そのもの） |
| **当事者圏**（該当選手・学校・地域の関係者） | 「番狂わせ」「史上初」は当事者にとって一生モノの記録。公式が記録として言語化してくれるサイトは他に無い | シェア・被リンク |
| **ライトなスポーツファン** | ジャイアントキリングはスポーツ報道で最も広く通用する型（競技知識不要で面白さが伝わる） | SNS経由の新規流入 |

主対象は**既存読者**。本案はまず「サイトの情報密度を上げる資産」であり、SNS発信は姉妹案の発信キューへの相乗りで良い（単独でSNS運用を立てない）。

## 2. 多くのユーザーに刺さるための設計

- **意外性の言語化を定量で裏付ける**: 「格上を破った」を主観でなくランキング差で機械判定できるのが本サイトだけの強み。ただし精度が出るまで出さない（誤った「番狂わせ」認定は当事者に失礼で信頼を毀損。milestone 設計の「未確定は黙る」原則を踏襲）。
- **ランキング非依存のB系統を先行**させ、露出面（大会ページ・記事・選手ページ）を先に育てる。A系統（ジャイアントキリング）は器が育った後の「目玉カテゴリ追加」として投入する。
- **scope-limited 規約の徹底**: 「大会史上初」「◯年ぶり」は当サイト掲載範囲でしか言えない。既存の `confidence: 'scope-limited'`＋「当サイト掲載分」注記の規約をそのまま使う。

## 3. 実装構成

### 3.1 B系統: milestone エンジン拡張（ランキング非依存・先行）

既存 `MilestoneKind`（[2026-06-21-milestone-logic.md](./2026-06-21-milestone-logic.md)）への追加として実装する。新パイプラインは作らない。

```ts
type MilestoneKind =
  | ... // 既存6種
  | 'perfect-title'    // 無敗優勝（1ゲームも落とさず優勝）
  | 'title-streak-gap' // ◯年ぶりN回目の優勝
  | 'first-region'     // 大会史上初（他地域勢初優勝など）※判定軸は要検討
  | 'win-streak';      // 記録的な連勝（大会横断）
```

- 判定入力は既存と同じ（`data/tournaments/details/**`・`historical-winners`・`analysis.json`）。
- `perfect-title`: 優勝者の全試合スコアからゲーム失数0を判定。`confidence: 'confirmed'`（その大会内で閉じる）。
- `title-streak-gap`: `historical-winners` の年度列から算出。`confidence: 'scope-limited'`。
- `first-region`: 所属（学校・都道府県）軸の「掲載範囲で初」。学校名表記揺れ問題（team-name-aliases）に依存するため、名寄せ不能なら出さない。
- `win-streak`: `analysis.json` 拡張が必要（試合の時系列順序が要る）。優先度は最後尾。
- 重要度順序への挿入案: `perfect-title` は `repeat-title` と `first-title` の間、`title-streak-gap` は `first-title` 直後、他は `best4-first` 前後。

### 3.2 P0: 出現頻度の事前検証（実装前に必ずやる）

ポイント版パイロットチェックと同じ規律で、**実装前に既存全データへ判定ロジックの試作を走らせ、各カテゴリの出現頻度を確認**する。

- スクリプト: `scripts/pilot/count-result-rarities.mjs`（使い捨てで可）。全 `details/**` を横断し、無敗優勝・◯年ぶり優勝・地域初の件数を数える。
- 判断基準: 出現しすぎるカテゴリ（例: 出場者が少ない種目の無敗優勝が毎回成立するなら）は閾値を締めるか落とす。1件も出ないカテゴリは後回し。

### 3.3 A系統: ジャイアントキリング検知（ランキング依存・後発）

```ts
| 'giant-killing'  // 番狂わせ（ランキング下位が上位を破る）
```

- 前提: `data/ranking-config.json` ベースのランキング（上位3大会合算方式）が運用開始し、tier・係数が実データで較正済みであること（open-questions「選手データベース拡張」節）。
- 判定案（初期はシンプルに）: 対戦時点の**ランキング順位比**または**tier差**で判定。例: 「勝者が敗者よりランキングで50位以上下」かつ「敗者が上位16位以内」。Elo 系レーティング導入（将来Open Question）後はレート差ベースへ置換可能な形で、判定関数を `lib/upsetDetection.ts` に分離しておく。
- 閾値の較正方法: 過去データ全体に判定を走らせ、「年間の番狂わせ認定件数が種目あたり数件」に収まるよう閾値を選ぶ（希少性の担保を件数から逆算する。P0 と同じ規律)。
- `champion-defeat`（既存）との関係: champion-defeat は「肩書きベースの番狂わせ」、giant-killing は「実力指標ベース」。両立時は giant-killing を優先表示し重複抑制。

### 3.4 フェーズ分けまとめ

| Phase | 内容 | 依存 |
|---|---|---|
| **P0** | 頻度検証スクリプトを既存全データに実行、カテゴリ取捨選択 | **完了（2026-07-30）**。詳細は下記「P0 頻度検証結果」。結論: perfect-title・title-streak-gapは採用、first-regionは現状の定義では不採用（頻度過多＋prefectureフィールドの非都道府県値混入） |
| **P1** | B系統のうち perfect-title / title-streak-gap を milestone エンジンに追加。大会ページ・選手ページ・記事に既存経路で自動露出（first-region は見送り、下記参照） | **完了（2026-07-30）**。詳細は下記「P1 実装結果」 |
| **P2** | `win-streak`（analysis.json の時系列拡張と同時） | P1 |
| **P3** | A系統 giant-killing 投入 | **完了（2026-07-11、表示接続まで）**。判定基盤=`data/ratings/upsets.json`（期待勝率0.15以下・established両者限定・62件）。ユーザー決定: 露出面は champion-defeat と同等（大会結果ページ自動バッジ＋結果記事素材）、ラベルは数字なし定性表現（タグ「金星」、「◯◯ が格上の ◯◯ を破る金星」+scopeNote）。実装: `lib/ratingsUpsets.ts`・`lib/milestones.ts`（`getGiantKillings` / `suppressChampionDefeatIfDuplicate`）・大会結果ページ・`lib/newsArticle.ts`（result記事）・kindタグ。詳細: [ranking-calibration-harness-plan §10 P4](./2026-07-11-ranking-calibration-harness-plan.md) |
| **P4** | 姉妹案の発信キューに milestone イベントを合流（「大会の記録的結果」＋「試合内の劇的瞬間」を同一キューでレビュー・投稿） | 姉妹案P2 |

### 3.5 KPI

- P1: milestone イベント付き大会ページの直帰率・滞在時間の変化（付かないページ比）。
- P3: giant-killing 認定件数/年（希少性の維持）、該当記事・投稿の反応。

## P0 頻度検証結果（2026-07-30 追記）

使い捨てスクリプト `scripts/pilot/count-result-rarities.mjs` を作成し、`data/tournaments/details/*/*/*.json`
全333ファイル（`temp/`配下の作業中データは除外）を横断して B系統3カテゴリの出現頻度を検証した。
優勝者が判明している大会×年×種目（＝「エディション」）は307件。

### 結果サマリー

| カテゴリ | 件数 / 母数 | 頻度 | 判定 |
|---|---|---|---|
| `perfect-title`（無敗優勝） | 10 / 307 | 約3.3% | **採用**。個人戦（ゲーム0失点）・団体戦（相手チームの個人戦勝利0）の両方で `matches[].scores` を同じロジックで判定でき、頻度も「たまに起きる」程度で希少性の体感と合う |
| `title-streak-gap`（◯年ぶりN回目） | 9 / 307 | 約2.9% | **採用**。gap は8/9件が2年（前回大会からの間隔）、1件が3年。個人戦は選手個人単位（ダブルスは両選手で各1件、例: 2024年 zennihon-championship 男子ダブルス連覇明けの船水颯人・上松俊貴が各1件）で design（`docs/raw/2026-06-21-milestone-logic.md`）と整合 |
| `first-region`（地域初優勝候補、prefecture軸） | 76 / 307 | 約24.8% | **不採用（現状の定義では）**。理由は下記 |

判定不能（`matches`が0件で突合できない等）は0件。全て決定的に判定できた。

### perfect-title の検証詳細

`matches[].scores` は個人戦ではゲーム数、団体戦では「その団体戦ラウンドで勝った個人戦試合数」を表す同一形式であることを実データで確認（例: `highschool-championship/2024/team-none-boys.json` 決勝 `{"1":0,"48":2}` は団体戦2-0のことで、個人戦のゲームスコアと同じ「相手の獲得数」の意味で扱える）。そのためP0で想定した「優勝者が絡んだ全試合で相手の獲得数が0」という単一ロジックが個人戦・団体戦を区別せず機能する。棄権（`retired:true`）が絡んだ無敗優勝は0件（該当があれば注記が必要になる想定だったが今回は該当なし）。

### title-streak-gap の検証詳細

構造上の懸念（連続開催でない大会でのエディション間隔ずれ）は、開催年ではなく「実際にdetailsがある年（エディション）のインデックス差」で連続判定したため問題なし。9件全て gapEditions と gapYears が一致しており、隔年開催大会での誤判定は無かった（母数の大会がほぼ毎年開催のため今回は未検証だが、ロジック自体はエディション基準）。

### first-region が不採用となった理由

1. **頻度が高すぎる**: 収録範囲が大会あたり2〜5年程度と薄いため、「初優勝でない（＝連覇でない）優勝者」のほぼ全て（74/76）が「掲載範囲で見たことのない都道府県」に該当してしまう。実質「連覇でない優勝」とほぼ同義になっており、「地域初」としての意外性・語れる価値を持たない。
2. **`prefecture` フィールドの値が都道府県に限らない**: 大学・実業団・連盟所属の選手は `prefecture` に「日本学連」「日本連盟」等の組織コードが入っており（例: `zennihon-championship 2025 doubles-none-boys` 橋場柊一郎・菊山太陽「日本学連」）、これが「新規都道府県」として誤検出される。地域軸の希少性検知には向かない値。
3. **対応方針**: 「大会史上初の出来事」自体は筋が良い着想だが、軸を都道府県から「学校（team名）」に変えるとほぼ `first-title`（既存実装）と重複してしまい差別化にならない。掲載年数が蓄積してから（例: 1大会10年分以上）「地域初」の意外性が意味を持つと考えられるため、**今は実装せず後回し**とし、データ蓄積後に再検討する。

### 結論・次アクション

- P1 は `perfect-title` / `title-streak-gap` の2種類のみで着手する（`first-region` は範囲外）。
- 実装は `lib/milestones.ts` の `MilestoneKind` 拡張として、既存の `first-title` / `repeat-title` と同じ場所（`getChampionMilestones` 内）に追加する。判定入力は `readYearDetail` の `matches` で完結し、新規データ取得は不要。
- pilotスクリプトは `scripts/pilot/count-result-rarities.mjs` としてリポジトリに残置（使い捨て前提だが、再検証や閾値調整時にそのまま再利用できるため）。

## P1 実装結果（2026-07-30 追記）

`lib/milestones.ts` に実装した。既存の `getChampionMilestones`（個人戦=`buildIndividualMilestones` / 団体戦分岐）にそのまま追加し、新パイプラインは作らない方針どおり。

### perfect-title（無敗優勝）

新規 `MilestoneKind` として追加。判定関数 `isPerfectTitle()` は `readYearDetail` で当年 `matches` を読み、優勝エントリが絡んだ全試合で相手の獲得数（`scores[相手entryNo]`）が0かを見る。個人戦・団体戦は `matches[].scores` が同じ意味（相手の獲得数）を持つため同一ロジックで判定できることを実データで確認済み（`highschool-championship/2024/team-none-boys.json` 決勝 `{"1":0,"48":2}` 等）。`confidence: 'confirmed'`（当年データのみで完結、掲載範囲に依存しない）。

重要度は `repeat-title` の直後（既存プランどおり）。repeat-title / first-title / nth-title のどの分岐が成立したかに関わらず独立に評価するため、例えば「2連覇かつ無敗優勝」のように**同時成立するイベントとして両方出る**（実データで確認: `highschool-championship/team-none-girls/2025` は東北が2連覇＋無敗優勝の両方を表示）。

### title-streak-gap → nth-title への統合

当初 milestone-logic.md では新規 kind として構想していたが、実装済みの `nth-title`（連覇でも初優勝でもない複数回優勝）が既に同じトリガー条件（過去に優勝歴があり、直前のエディションからの連続でない）で発火することが分かったため、**別kindを新設せず `nth-title` のラベル・detailに年数ギャップを追加する形で吸収した**（同一事象への二重イベント発行を避けるため）。

- `detail` に `gapYears`（前回優勝からの経過年数）・`previousTitleYear`（前回優勝年）を追加。
- ラベルを `${n}回目の優勝` → `${gapYears}年ぶり${n}回目の優勝` に変更（個人戦・団体戦の両方）。
- `nth-title` の kind 文字列自体は変更していないため、`src/components/milestoneKindTag.ts` の種別タグ（「優勝」）・`src/components/PlayerStatisticsSections.tsx` 側のラベルマップなど既存の呼び出し元は無改修で動く。

### 表示面の配線

`getChampionMilestones` の戻り値（`events`）に新イベントが混ざるだけなので、既存の3消費箇所（大会結果ページ `ResultContextBlocks` / 大会ハブ・プレビュー `TournamentContextBlocks` / 選手ページ `PlayerCareerHighlights`、いずれも `kind: string` の汎用型でフィルタなし）・記事生成（`lib/newsArticle.ts`）は無改修で新イベントを自動的に拾う。`src/components/milestoneKindTag.ts` に `perfect-title`（表示テキスト「無敗優勝」、indigo系配色）を追加した。

### 動作確認（2026-07-30、ts-node で実データに対して実行）

P0検証で洗い出した候補を含む5ケースで `getChampionMilestones` を直接実行し、期待どおりの出力を確認した。

| ケース | 期待 | 結果 |
|---|---|---|
| `highschool-championship/team-none-boys/2024` | perfect-title（高田商） | ○ perfect-title + first-title（初優勝でもあったため両方出力） |
| `zennihon-championship/doubles-none-boys/2024` | nth-title 2年ぶり2回目（船水颯人・上松俊貴） | ○ 両選手それぞれ `"2年ぶり2回目の優勝"` |
| `highschool-championship/team-none-girls/2025` | perfect-title（東北、2連覇と同時） | ○ repeat-title（2連覇）+ perfect-title の両方 |
| `highschool-senbatsu/team-none-girls/2025` | nth-title 2年ぶり4回目（東北） | ○ `"2年ぶり4回目の優勝"` |
| `zennihon-championship/doubles-none-boys/2025`（統制群） | perfect-titleでもnth-titleでもない | ○ first-titleのみ（誤検出なし） |

`npx tsc --noEmit` はエラー0件、`eslint` も対象ファイルでエラー0件（既存の native binding 警告のみ、無関係）。

### 未着手（範囲外のまま）

- `win-streak`（P2、`analysis.json` の時系列拡張が前提）。
- `first-region`（P0で不採用と結論済み）。
- 記事生成キューへの合流（P4、姉妹案側の進捗待ち）。

## 4. 課題・未解決（更新）

- `first-region` の「地域」軸の定義（都道府県か、ブロックか、学校か）。表記揺れ・名寄せの品質に強く依存するため、P0 の頻度検証と同時に誤判定率も見る。
- 重要度順序の最終決定（既存6種との相対位置）。記事テンプレ側の上位N件表示に影響。
- ~~ジャイアントキリング閾値は「順位差の絶対値」より「順位比・tier差」の方がロバストという仮説~~
  → **解消（2026-07-11）**: Elo期待勝率ベース（0.15以下=候補、0.10以下=特大）で確定。
  順位比よりさらにロバストで、較正曲線の裏付けあり。
- ランキング自体の精度向上（tier係数・K値）は本案のスコープ外だが、A系統の品質上限を決める。ランキング側の較正作業に「giant-killing 判定に使える精度か」という評価観点を1つ足してもらう。

## 5. 関連

- [2026-07-11-idea-giant-killing-ranking.md](./2026-07-11-idea-giant-killing-ranking.md)(親アイデア)
- [2026-07-11-rare-event-sns-plan.md](./2026-07-11-rare-event-sns-plan.md)（姉妹案の詳細検討。P4で発信キュー統合）
- [2026-06-21-milestone-logic.md](./2026-06-21-milestone-logic.md)（拡張先の既存設計）
- [ADR-005](../adr/ADR-005-news-context-block-architecture.md)（イベント抽出レイヤ）
- [docs/wiki/open-questions.md](../wiki/open-questions.md)「選手データベース拡張」節（ランキング較正）
- `lib/milestones.ts`、`data/ranking-config.json`
