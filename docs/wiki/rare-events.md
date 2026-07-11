# 希少イベント検知（この試合の名場面）

ステータス: **P0 実装済み（2026-07-11）、全体判定へ変更（2026-07-12）**。score 機能で記録した
試合のポイント列から、記録済み全試合の横断比較で希少なプレー（名場面）を検知し、
試合詳細ページに表示＋SNS 手動投稿用テンプレを生成する。

親アイデア: [raw/2026-07-11-idea-rare-point-event-sns.md](../raw/2026-07-11-idea-rare-point-event-sns.md) /
詳細検討: [raw/2026-07-11-rare-event-sns-plan.md](../raw/2026-07-11-rare-event-sns-plan.md)

## 決定事項

**2026-07-12: 判定スコープを「大会単位」から「記録済み全試合（all-time）」へ変更**（ユーザー決定）。
記録できない試合の方が多く、大会単位だと比較の分母が薄すぎて「この大会最長」の意味が弱いため。
`RARE_EVENT_CONFIG.scope` で切り替え可能（'tournament' は当初案として温存。データが増えたら再検討）。
ラベルは「記録済み全試合で最長の〜」、ページ見出しは「この試合の名場面」に変更。

2026-07-11:

- **表示先は試合詳細ページ**（スコア記録と一緒に「この試合の名場面」ブロックで表示）。
  当初案の「ニュース記事に追記」は、ADR-010 で result 記事が廃止済みのため採らず、
  まずスコア詳細ページ表示から始める（将来、大会結果ページ・大会ハブへの差し込みは P2 候補）。
- **SNS 投稿は手動**（レポートスクリプトが出力するテンプレ文をコピペ。投稿前レビューを兼ねる）。
- **「何を希少とするか」はハーネスで調整**: 定義・閾値を `RARE_EVENT_CONFIG` に集約し、
  収穫レポート（分布・候補数・動画リンク有無）を見て変更→再実行を回す。
- データが少ないうちの誤検知（見かけ上の「大会最長」等）は**許容**。ただし表示・投稿には必ず
  scopeNote（当サイトでスコア記録した試合の範囲での比較である旨）を添える。

## 設計原則（プランから継承）

- **相対評価**を既定にする（絶対閾値は投稿過多 or ゼロ件に振れやすい。「プール内最長」は必ず成立）。
  比較プールは `scope` で切り替え（既定 'all-time'＝記録済み全試合。~~大会単位~~は 2026-07-12 に変更）。
  ただし min* 閾値で「語るに値しない最大値」（例: 最長ラリー3本）を落とす。
- **ポジティブ限定**（完封・連続失点など片方を下げるカテゴリは扱わない。当事者圏の多くが未成年）。
- **maxTies**: 「大会最大」が同値で多数並ぶ場合（例: 2点差逆転が6ゲーム）は希少性なしと判定しカテゴリごと非表示。
- 動画はクリップ再配布でなく**タイムスタンプ付き YouTube URL**（`video_start_ms` 由来）。
- 本文はテンプレートのみ・LLM 不使用（ADR-005 と同方針）。実名の扱いは大会結果として
  公開済みの範囲と同一に限定（ADR-003/004 の UGC プライバシー論点に踏み込まない）。

## カテゴリ（初期5種・すべて比較プール内での判定）

| kind | 判定 | 主な閾値（config） |
|---|---|---|
| longest-rally | `rally_count` 最大（未記録=0/null は除外） | minRally=9, maxTies=3 |
| service-ace | `result_type: service_ace` 全件（絶対判定） | maxTies=5 |
| longest-deuce | デュース到達ゲームで総ポイント数最大 | minTotalPoints=9, maxTies=3 |
| biggest-comeback | ゲーム勝者が喫した最大ビハインド | minDeficit=2, maxTies=3 |
| longest-point-streak | 同一チームの連続ポイント（試合内・ゲーム跨ぎ可） | minStreak=5, maxTies=3 |

スコア再構成は matchRules と同一規則（通常4点・ファイナル7点・2点差）。
`.mjs` から TS を import できないため定数は `lib/rareEvents.mjs` に複製している（変更時は両方を揃える）。

## データフロー

```
public/data/beta-matches/matches/*.json（既存生成物）
  ↓ lib/rareEvents.mjs（純関数。RARE_EVENT_CONFIG ＝希少性の定義）
  ↓ scripts/generate-rare-events.mjs（prebuild 連鎖: generate-match-reverse-index の後）
  ↓ public/data/beta-matches/rare-events.json（events + byMatch 索引）
  ↓ lib/rareEventsStatic.ts（getStaticProps 用リーダー、プロセス内キャッシュ）
  ↓ 試合詳細ページ「この試合の名場面」ブロック（ポイントへジャンプ＋動画再生）
```

- 比較プールは `buildScopePools()`: scope='all-time' は大会紐付けのある全試合を1プール、
  'tournament' は開催（`tournament_id × tournament_year`）単位。
  大会に紐づかない試合（野良・練習試合）はどちらでも対象外（プライバシー方針）。
- 表示は `/beta/matches-results/[matchId]` とネスト URL（score-site-link）の両方（コンポーネント共通）。

## 運用（ハーネスの回し方）

1. 大会を記録（既存の動画レビュー運用。候補になりそうなポイントは動画レビュー優先）。
2. `npm run rare-events:report` — 開催ごとにカテゴリ別の分布・候補・抑制状況と、
   postable（動画あり）イベントの**SNS 投稿テンプレ文**を出力。
3. 歩留まりが悪ければ `lib/rareEvents.mjs` の `RARE_EVENT_CONFIG` を編集して 2 を再実行。
4. 投稿はテンプレ文を人がレビューして手動で行う（X を第一候補。頻度が週2を超えるまで自動化しない）。
5. サイト表示はビルド時に自動更新（`npm run rare-events:generate` は prebuild に組込済み）。

## サイト記録一覧ページ（レコードブック、2026-07-12 追加）

`/matches/highlights`（**noindex・follow**。コンテンツが育ってから indexable 昇格を判断。
公開試合一覧 `/matches` の配下。当初 `/beta/matches-results/` 配下に置いたのは誤りで 2026-07-12 修正）。

全体判定（all-time）にしたことで、一覧は「イベントの羅列」でなく**サイト記録集（レコードブック）**として
成立する: カテゴリ＝種目の固定枠に現記録の値・保持ペア・大会・動画リンク・該当ポイントへの
ディープリンク（`?pointId=`）を表示。件数が少なくても「各種目の記録枠が埋まっている」形になるのが狙い。
最上級4カテゴリ（最長ラリー/最長デュース/最大逆転/最多連続）は記録カード、
サービスエース・昇格パターンは全件リストで表示する。

- 導線: 試合詳細の「この試合の名場面」ブロック末尾 →「サイト記録一覧」リンク。
- SNS 投稿の受け皿 URL としても使える（投稿文の定番リンク先候補）。
- 将来: 記録更新履歴（歴代記録）を残すと「サイト記録更新」の物語になる（P3 と接続。
  現状 rare-events.json はビルドごとに上書きで履歴を持たない）。
- score モードでは出さない（イベントの detailPath が指す大会ネスト URL が無いため）。

## パターン発見ハーネス（discovery、2026-07-11 追加）

決め打ちカテゴリの大小比較に加え、**特徴量の組み合わせから新しい希少パターンを発見**する
探索面（`npm run rare-events:discover`）。例:「デュース局面をスマッシュで決めた」のような
複数条件の組み合わせを、条件を決め打ちせずデータから見つける。

### 「条件を複雑にしただけ」問題と複雑さの許容ノブ

条件を AND で重ねれば何でも希少になれる（717ptで3条件なら大抵0〜1件）。そこで各条件の
周辺頻度から**独立仮定の期待件数**を計算し、次の3つに分類する。

| 分類 | 判定 | 意味 |
|---|---|---|
| 発見候補 | 実測≤maxCount かつ 期待≥minExpectedCount かつ lift≤maxLift(k)、サブパターンに還元不能 | 条件同士が反相関＝起きたら本物の希少 |
| 還元可能 | 上を満たすがサブパターン（k-1条件）が既に希少判定を満たす | 既知の希少に条件を1つ足しただけ |
| 複雑にしただけ | 実測は希少だが期待件数も小さい | 希少さが各条件の掛け算で説明できる |

複雑さの許容度は `DISCOVERY_CONFIG`（`lib/rareEventDiscovery.mjs`）のノブで調整する:
`maxConditions`（条件数上限）、`minExpectedCount`（発見に要求する期待件数）、
`maxLift`＋`liftTightenPerExtraCondition`（条件数が増えるほど lift 要求を厳しくする＝複雑さの価格）。
実測（2026-07-11、717pt）: maxConditions 3→4 で「複雑にしただけ」が 245→1095 に爆発する一方、
発見候補は 17→19 とほぼ増えず、複雑さは主に自明な希少しか生まないことを確認済み。

### 特徴量

`listPointsWithFeatures()`（`lib/rareEvents.mjs`）: 決まり方（result_type）、得点側（サーブ/レシーブ）、
ラリー帯、1stサーブ、デュース局面、ゲームポイント局面、ファイナルゲーム、shot_type / shot_course。
**前衛/後衛のロールは現行データに存在せず特徴量化できない**（例の「後衛がスマッシュ」は未探索）。
shot_type / shot_course はスキーマ有・未収録（recording_level: basic）。記録され始めると自動で探索対象に合流する。

### 発見 → 昇格の運用

1. `npm run rare-events:discover` — 発見候補を実例ポイント（動画リンク付き）と共に出力。
2. 人がレビュー（**多重比較の偶然当たりが混ざるため必須**。n が小さいうちは特に）。
3. 名場面として妥当なら `RARE_EVENT_CONFIG.patterns` に `{id, label, conditions}` で昇格
   → 以降は既存パイプライン（rare-events.json → 試合詳細ページ表示・投稿テンプレ）に自動で乗る。

既知の限界: 期待値は1条件の独立積で近似（サブパターンの条件付き確率ではない）。
サブパターン lift の併記と還元可能判定で緩和しているが、最終判断は人が行う。

## 実装ファイル

- `lib/rareEvents.mjs` — 検知ロジック＋ `RARE_EVENT_CONFIG`（categories / patterns）＋特徴量抽出＋投稿テンプレ組み立て
- `lib/rareEventDiscovery.mjs` — パターン発見（組み合わせ探索＋lift/期待件数スコアリング）＋ `DISCOVERY_CONFIG`
- `scripts/generate-rare-events.mjs` — 公開 JSON 生成（prebuild）
- `scripts/rare-events-report.mjs` — 収穫レポート＋投稿テンプレ（手動実行）
- `scripts/rare-events-discover.mjs` — パターン発見レポート（手動実行）
- `lib/rareEventsStatic.ts` — サーバー用リーダー＋ `RareEvent` 型
- `src/pages/beta/matches-results/[matchId]/index.tsx` — 「この試合の名場面」ブロック
- `src/pages/matches/highlights.tsx` — サイト記録一覧（レコードブック）

## 参考実績

- 2026-07-11（大会単位・16試合・5開催）: 24イベント（動画あり3件）。全開催で1件以上成立。
  zennihon-singles 2026 では 2点差逆転が6ゲームで同値タイ→ maxTies で抑制が機能。
- 2026-07-12（全体判定へ変更後・同データ）: 8イベント（動画あり1件）。大会単位の 24件から
  絞られ「全記録の中でトップ」だけが残る＝1件あたりの特別感は上がる。今後は記録が増えるほど
  既存イベントが塗り替えられていく（「サイト記録更新」の物語性は P3 の scope 拡張と接続）。

## 関連

- [score-general-availability.md](./score-general-availability.md)（Idea Backlog 索引）
- [score-site-link.md](./score-site-link.md)（試合詳細のネスト URL）
- [news-context-blocks.md](./news-context-blocks.md) / [ADR-005](../adr/ADR-005-news-context-block-architecture.md)（イベント抽出レイヤ・テンプレート主義）
- [ADR-003](../adr/ADR-003-score-media-tool-separation.md) / [ADR-004](../adr/ADR-004-growth-analysis-visibility-consent.md)（プライバシー方針）

## Open Questions

- 大会結果ページ・大会ハブへの差し込み（P2。milestone 系と「名場面」欄を統合するか）。
- サイト記録一覧の indexable 昇格判断（記録カテゴリ・件数が育ってから。昇格時は seo.md 重複マップ確認）。
- 記録更新履歴（歴代記録）の永続化方法（rare-events.json は上書き生成のため履歴を持たない）。
- scope 拡張（'season' / 'all-time': 「今季最長」「サイト記録更新」）の導入時期（P3、反響次第）。
- `shot_type` / `shot_course` が記録されるようになった場合のカテゴリ拡充。
- 前衛/後衛ロールの記録（発見ハーネスの特徴量として欲しいが記録UI拡張が要る。「後衛のスマッシュ」等はこれ待ち）。
- 発見ハーネスの期待値をサブパターン条件付き確率ベースに精緻化するか（データが増えてから判断）。
- 配信元（大会主催者・配信者）への事前一声の運用ルール化。
