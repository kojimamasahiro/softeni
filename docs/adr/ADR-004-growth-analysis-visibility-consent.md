# ADR-004: 成長分析の公開境界と同意レベル（段階公開モデル）

## Status

Draft。採用範囲は **(1) グループ内限定公開（L1）** と **(2) 運営キュレーションのショーケース公開（L2 を 1〜2 選手の
allowlist にだけ付与）** の 2 つ（2026-06 決定）。ショーケースは「成長記録で何が分かるか」を見せ、将来 score へ
誘導する集客導線（score CTA は score 方針が固まるまで配線せずプレースホルダのみ）。
自由な全体公開（セルフ公開トグル）・ランキング（L3）・UGC 統合は引き続き**保留**。

## Context

`/beta/matches-results/growth`（および score mode `/matches/growth`）の成長分析は、
score 機能の延長として「部活などグループ内での成長記録」を想定して作られた。
この方針は残しつつ、softeni-pick 本体のコンテンツとして閲覧される機能へ育てたい。

現状の実装は次のようになっている（`lib/growthAnalysis.ts`）。

- `buildGrowthTargets(matches)` は公開試合に登場する**全選手/ペアを自動的に対象化**する。
- ターゲットキーは `player:<正規化氏名>` / `pair:<氏名&氏名>`（`getSideTargetBase`）。
- `generate-beta-matches-json.mjs` が全ターゲットの `targets.json` と
  `reports/{target}.json` を生成し、公開出力する。

つまり現状、成長分析には**同意・公開フラグが一切存在しない**。
「試合結果が公開されている」という事実だけを根拠に、本人の個別同意なしに
**実名の能力分析ページ**が自動生成・公開されている。

ここで効く論点は 2 つ。

1. ADR-003 が定義する match 単位の `visibility`（掲載試合=public）と、
   **個人の成長分析の公開可否は別物**である。試合結果の公開と、
   その人を名指しで「サーブが弱い/キーポイントに弱い」と継続分析・将来ランキング化することは、
   感度が質的に異なる。
2. ソフトテニスは中高生（未成年）の比率が高く、実名での能力評価・他者との横断比較・
   ランキング掲載はとくに慎重な扱いが要る。

本体コンテンツ化（プロフィール統合、横断ベンチマーク、ランキング/集約記事）へ進める前に、
公開境界と同意の方針を先に確定しないと、後続実装が手戻りする。

## Decision

成長分析の公開を一律にせず、**ターゲット（個人/ペア）単位の段階公開（visibility ラダー）**を導入する。
match 単位の `visibility`（ADR-003）とは**直交する独立軸**として扱う。
match が public でも、その個人の成長分析が自動で public になることはない。

### 1. 公開レベル（ラダー）

ターゲット単位に `growthVisibility` を持たせる。

- **L0 none** — レポートを公開出力しない。記録のみ。`targets.json` / `reports/*.json` に出さない。
- **L1 link** — `targetKey` を知る人だけ閲覧可。`targets.json` に**載せず**、レポートは
  直リンクのみ・`noindex`。部活内共有の既定面。
- **L2 public（自己分析のみ）** — 選手/ペアページに成長セクションを表示しインデックス対象。
  ただし**横断比較（他者・全体平均・パーセンタイル）は表示しない**。自分の過去との比較に限る。
- **L3 ranked** — 全体平均比較・パーセンタイル・「最も伸びた選手」等のランキング/集約コンテンツに
  **実名で掲載可**。

### 1.1 当面の採用範囲（2026-06 決定）

- **採用するのは L0 / L1 のみ。** 成長分析はグループ内限定公開を主運用とする。
- **L2 / L3（実名で個人をサイト全体に公開・ランキング掲載）は当面採用しない（保留）。**
  「全体公開設定」という操作自体を提供しない。将来コンテンツが広がりユーザー反響が出た段階で再検討する。
- L2 / L3 のラダー定義は将来の再検討用に残すだけで、現時点では実装対象外。

### 2. 推奨デフォルト（採用範囲内）

- **既定はグループ内限定公開（L1）。** グループ（部活/サークル）が記録し、パスワード/限定リンクを
  知るユーザーだけが閲覧する。`targets.json` に載せず `noindex`。
- **L1 の閲覧には同意を不要とする。** パスワードで閉じたグループ内展開（学生含む）では同意取得を求めない。
- **個人の撤回（オプトアウト）権は維持。** 撤回があれば次ビルドで L0 相当に落とす。
- 「全体公開設定」は提供しないため、既存ターゲットが実名でサイト全体に出ることはない。

### 3. 同意の主体

- **グループ内限定公開（L1）= 同意不要。** 入力者であるグループが管理し、パスワード/限定リンクで
  閉じているため、本人・保護者の個別同意フローは設けない。
- **本人同意・保護者同意の取得フローは当面不要。** これらは実名の全体公開（L2/L3）を前提とした論点であり、
  全体公開を採用しないため発生しない。将来 L2/L3 を検討する段で改めて設計する（Open Questions 参照）。

### 4. データモデル

当面の採用範囲（L0/L1）では、グループ単位の公開設定とアクセス制御、個人の撤回が表現できれば足りる。
重い `growth_consent`（個人同意テーブル）は L2/L3 を採用する段で導入する。

当面必要なのは次の 2 つ。

- **グループの公開設定**: 対象グループの成長レポートを生成・限定公開するか、アクセスを閉じる
  パスワード/限定リンク（トークン）の管理。
- **撤回リスト**: 公開を止めたい `subject_key`（`getSideTargetBase` と同一規則）を生成段で除外する。

将来 L2/L3 を採用する際に追加する `growth_consent`（参考、現時点では未導入）:

```
growth_consent
  subject_key      text   -- player:<正規化氏名> / pair:<...>
  level            text   -- 'none' | 'link' | 'public' | 'ranked'
  consent_source   text   -- 'group' | 'self' | 'guardian'
  group_id         text
  guardian_consent boolean default false
  anonymized       boolean default false
  granted_at       timestamptz
  withdrawn_at     timestamptz null
```

### 5. 生成パイプラインへの反映（採用範囲内）

- `buildGrowthReports` / `generate-beta-matches-json.mjs` で、対象を限定公開（L1）として生成し、
  `targets.json` には載せず `noindex`。アクセスはパスワード/限定リンクで閉じる。
- 撤回リストにある `subject_key` は生成段で除外する（`toPublicMatchSnapshot` が内部項目を削るのと同じ
  「公開境界で削る」思想に揃える）。
- 撤回は静的生成サイクルでのみ反映される（即時でない＝再生成・再ビルドが必要）。data-import.md と同じ注意として明記。
- L2/L3 向けの横断比較・ランキング集約・匿名化レンダリングは当面実装しない（保留）。

### 6. score mode / softeni-pick mode の差

- どちらのモードでも当面は L1（グループ内限定）止まり。実名の全体公開・インデックス（L2 以上）は行わない。
- score mode を UGC 本拠地へ転換し、ログインユーザー自身の成長を公開していく構想（ADR-003 Phase 2）は、
  コンテンツ拡大とユーザー反響を見てから着手する（保留）。

## Alternatives

- **現状維持（match 公開＝成長公開を継承）**: 実装は最小だが、実名能力評価を無同意で公開し続けることになり、
  未成年比率の高い競技で横断比較・ランキングへ拡張する前提と両立しない。却下。
- **全ターゲット opt-out（公開既定・撤回のみ）**: 導線は軽いが、既存データを遡及的に実名公開する初期状態が
  リスク。中間案として L3 のみ opt-in にする折衷も可能だが、初期既定は安全側（L1）を選ぶ。
- **match 行に成長公開フラグを同居**: 個人は複数 match にまたがるため、ターゲット単位の同意を
  match 行で表現すると不整合。別テーブル（subject_key 単位）が正しい。

## Consequences

- メリット: 当面はグループ内限定（L1）に絞ることで、同意取得・未成年配慮・横断比較・匿名化の
  重い設計を保留でき、部活内の成長記録という既存用途をそのまま維持できる。
- デメリット / 新規に必要なもの: グループ単位のパスワード/限定リンクによるアクセス制御と、
  撤回リストによる生成段除外。実名の全体公開を採用しないため、コンテンツ化（一般閲覧）は
  別の手段（匿名集約・運営の掲載試合ベースなど）か将来の L2/L3 再検討に委ねる。
- `GrowthTarget` 型に限定公開フラグ（生成・除外の判定）を持たせる程度で済む。`growth_consent` の
  本格導入は L2/L3 採用時に先送り。
- 撤回反映が静的生成サイクル依存になるため、運用上の SLA をドキュメント化する。
- 元の目的「softeni-pick のコンテンツとして閲覧される」は、グループ内限定機能とは切り離し、
  サイト責任者が既公開情報をもとに作成・公開する編集経路で実現する（Resolved 参照）。

## Related Files

- `lib/growthAnalysis.ts`（`buildGrowthTargets` / `getSideTargetBase` / `buildGrowthReports`、`GrowthTarget` 型）
- `scripts/generate-beta-matches-json.mjs`（公開対象の絞り込み・匿名化・noindex 出力）
- `src/pages/beta/matches-results/growth/index.tsx`, `src/pages/matches/growth/index.tsx`
- `docs/adr/ADR-003-score-media-tool-separation.md`（match 単位 visibility・閲覧/ツール分離。本 ADR はその個人軸の補完）
- `docs/wiki/data-model.md`, `docs/wiki/public-pages.md`, `docs/wiki/data-import.md`（撤回反映の注意）
- `src/types/database.ts`（`growth_consent` 型追加）

## Resolved（本決定で解消）

- **同意主体（グループか本人か）**: グループ内限定公開のみとし、実名の全体公開設定は提供しない。
  パスワード/限定リンクを知るユーザーだけが閲覧するグループ内展開（学生含む）では、本人・保護者の
  個別同意を基本不要とする。→ 旧 Q1・Q2 はこの決定により当面発生しない。
- **コンテンツ化の経路（旧 A3）**: 一般公開コンテンツは、グループ内限定の個人レポートとは切り離し、
  **サイト責任者が既に公開されている情報をもとに作成・公開する**。既公開情報を運営の編集判断で
  再構成する形（掲載試合の分析記事など、運営の既存の公開運用と同じ範囲）であり、個人の追加同意は不要と判断する。
  → コンテンツ化はこの編集経路で進め、グループ内限定機能とは独立に扱う。
- **名前付き成長の公開先 = ショーケース（最終方針 2026-06）**: 当初は `/players/[id]` 統合を検討したが、
  選手ページは廃止予定であり、データも公開動画の人力登録で少量にとどまる。そこで「広く浅く」ではなく
  **1〜2 選手に絞った深いショーケース**に方針転換した。運営が動画を集めて成長記録を作り込み、
  「成長記録で何が分かるか」を体感させ、将来 score へ誘導する集客導線とする。
  - 公開先は featured 選手ごとの専用ショーケースページ（インデックス対象）。`/players/[id]` 統合と
    results ページの作り込みは行わない。
  - URL は SEO 重視で**読める slug**（`/beta/matches-results/growth/<slug>`）。results との紐付けは URL を揃えるのではなく、
    featured 設定に results の数値 `playerId` を持たせ、ショーケース ↔ `/players/<playerId>/results` を相互リンクする形で取る
    （results id は数値で SEO 弱いため URL には使わない）。
  - これは visibility `public` を**ごく小さな allowlist にだけ付与**する形で、A3（運営が既公開情報から
    キュレーション）の範囲。自由な全体公開とは別物。
  - score CTA は score 方針が固まるまで配線せず、プレースホルダのみ置く。

## Implementation Status（2026-06）

本 ADR の Decision 5 の土台と、ショーケース公開の基盤を実装済み。

ショーケース関連:

- `data/growth-featured.json`: ショーケース対象（1〜2 選手）の allowlist（`subjectKey` / `slug` / 任意の `title`・`intro`）。
- `lib/growthAnalysis.ts`: `GrowthBuildOptions.featuredKeys` を追加し、対象の `visibility` を `public` に引き上げ。
- `scripts/generate-beta-matches-json.mjs`: featured リストを読み込み生成に反映。
- `src/components/growth/GrowthReportView.tsx`: レポート表示パーツ（Card / MetricRow / PracticeThemes / ラベル）を
  共有化。成長ページとショーケースの両方で再利用。
- `src/pages/beta/matches-results/growth/[slug].tsx`: featured 選手ごとのインデックス対象ショーケースページを
  静的生成（`getStaticPaths` = featured、score モードでは持たない）。「何が分かるか」の解説＋無効な score CTA プレースホルダ付き。
  `playerId` があれば `/players/<playerId>/results` へ相互リンク。
  - 表示は起点選手のシングルス記録＋その選手を含むペア記録を `targets.json` の `playerNames` から自動集約し、
    タブ（「シングルス」「ダブルス（相手名）」）で切替。ダブルスは「ペア」単位の別ターゲットとして記録されるため、
    個人記録には混ざらず別タブになる。featured 設定はシングルスの `subjectKey` を指定すれば、ペアは自動で集まる。
- `src/pages/players/[id]/results.tsx`: featured 対象選手の results ページに「成長記録を見る」導線を1つ追加
  （`data/growth-featured.json` を `playerId` で引いて slug を解決。非対象では何も出さない）。

Decision 5 の土台:

- `lib/growthAnalysis.ts`: `GrowthVisibility` 型と `GrowthTarget.visibility`（既定 `'link'`）、
  `buildGrowthTargets` / `buildGrowthReports` に撤回（`excludedKeys`）対応を追加。
- `data/growth-exclusions.json`: 撤回（オプトアウト）リスト。`scripts/generate-beta-matches-json.mjs` が
  読み込み、該当 `subject_key` をレポート生成から除外。
- スタンドアロン成長ページ（`/beta/matches-results/growth`・score の `/matches/growth`）: `noindex` 化。
  対象ドロップダウンは **公開試合（`/beta/matches-results` に表示中の試合）の参加者＝`targets.json`** を表示する
  内部ツール面（更新 2026-06）。`targets.json` は同じ公開試合から生成されるため、表示中の試合の参加者と一致する。
  これは公開的な"全選手の発見"ではなく、隣接する試合結果一覧と同じ露出範囲（`/beta` は robots Disallow＋`noindex` で検索非対象）。
  - 当初の「A1 フラグ（`NEXT_PUBLIC_GROWTH_GROUP_ACCESS`）が立つまでドロップダウン非表示」は撤回。
    「グループ＝公開済みの試合」とみなし、A1（特定グループへの限定アクセス）を待たずに一覧を出す。
    `isGrowthGroupAccessEnabled` は未使用（将来、特定グループに更に絞る場合のフラグとして温存）。
- 未実装（次フェーズ）: ショーケースへの集客導線（トップ/SNS からのリンク）、score CTA の配線（score 方針確定後）、
  A1 のアクセス制御、撤回反映の即時化。選手ページ統合・results 作り込みは方針転換により行わない。

## Open Questions（後回し）

A1・A2 は当面後回しとする（運用を始めてから詰める）。記述形式は「やりたいこと → 問題 → 決めること」。

### A1. グループ内限定公開のアクセス制御方式（後回し）

- やりたいこと: パスワード/限定リンクを知る人だけが成長レポートを見られる状態にしたい。
- 問題: 現状サイトは静的生成で、レポート JSON は URL を知れば誰でも取得できる（真の認証がない）。
  `noindex` と推測困難なトークン URL は「検索に出ない」止まりで、厳密なパスワード保護ではない。
- 決めること: どこまでの強度を要件にするか。推測困難な限定リンク（noindex）で割り切るか、
  クライアント側ゲート／ランタイム認証まで作るか。グループのパスワード/トークンを誰がどう発行・共有するか。

### A2. 撤回（オプトアウト）の反映（後回し）

- やりたいこと: グループ内限定でも「自分の分は消して」に応えたい。
- 問題: 静的生成のため、撤回リストに載せても次のビルド＆デプロイまで実ファイルは消えない。
- 決めること: 撤回をどのくらいで反映すると約束するか。緊急時に該当 JSON 即時削除／CDN パージの
  別経路を持つか（全体公開しない分、緊急度は下がるが導線は要る）。

## 保留（将来の再検討トリガー付き）

コンテンツが広がり、ユーザー反響が出てから再検討する。トリガーに達したら本 ADR を更新する。

### P1. 実名の全体公開（L2/L3）を採用する場合の同意・匿名・未成年設計

- L2/L3 を解禁する場合、どのレベルからグループ同意では足りず本人同意を必須にするか。
- 未成年の保護者同意を集め・確認する現実的な手段。集められないなら未成年は匿名のみに制限するか。
- ランキング/集約での実名 vs 匿名の既定（既定匿名＋実名 opt-in で記事として成立するか）。
- L1 から L2 以上へ引き上げる同意取得の導線（過去の選手への連絡手段がない問題）。

### P2. score mode（UGC）転換時の同意モデル統合

- ADR-003 Phase 2 で選手＝ログイン本人（`owner_user_id`）になると、氏名ベースのグループ前提と
  アカウント同意が併存・衝突する。認証所有モデル導入時に `growth_consent` をどうアカウントへ移行するか。
- 着手はコンテンツ拡大・ユーザー反響を見てから（保留）。
