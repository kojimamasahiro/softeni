# Open Questions

## 全日本学生選抜インドア（zennihon-university-indoor）

- 第59回(2025)の開催会場が公式公開情報から特定できず、`information` の `location` を空にしている。
  要項PDF等で会場が判明したら補完する（開催日は2025-11-03で確定）。
- 2023(第57回)・それ以前の年度は別レイアウトの可能性があり、`scripts/pdf/university_indoor.py`
  のページ割当・座標前提を年度ごとに確認してから取り込む。

## 公開面 / ドメイン分離

方針決定済み（2026-06、ADR-003）: 「閲覧公開（メディア）＝本体 `softeni-pick.com` に統合」
「ツール公開（UGC）＝`score.softeni-pick.com` を本拠地に分離」と役割で割り切る。
コードベースは分けず、分析エンジン（`lib/`）は共有。詳細は
[ADR-003](../adr/ADR-003-score-media-tool-separation.md)。

残る Open Question:

- score 側のヘッダー/フッターやブランド表現を分ける正式方針はあるか
- `score` mode を Phase 2 で UGC 本拠地に転換する際の既存 score mode ラッパとの整合

## 試合詳細の beta 昇格（検討中 2026-06）

設計の詳細とドラフト仕様は docs/wiki/score-site-link.md に集約。主な決定:

- 掲載大会に紐づく試合は大会ページ配下のネスト URL（`/tournaments/.../matches/{UUID}`）で indexable にする
- 野良試合は当面 `/beta/matches-results/*`（noindex）に残す
- URL の ID は UUID 維持（slug 化しない）、50 件上限撤廃・追記型生成へ
- 大会紐付けの誤りは削除→新規作成し直しで対応する

残る Open Question は score-site-link.md 末尾を参照。

## score データモデル

- score 機能の正式な source of truth は Supabase か、それとも生成済み JSON か
- `edit_token` / `edit_token_hash` は ADR-003 で廃止方針（認証所有モデルへ移行）。撤去の段取りは未定
- `matches.status` / `processing_status` の正式な状態遷移は何か
- `points.result_type` の正式な enum 一覧はあるか

## 公開/編集権限

方針（2026-06、ADR-003）: UGC 公開を前提に、`edit_token` トークン方式は廃止し、
認証ユーザー所有モデル（`Match.owner_user_id`）と `visibility`（public / private 既定 /
限定公開）に寄せる。静的 JSON 生成は public のみを対象にする。

残る Open Question:

- `visibility` の正式 enum と既定値（private 既定で確定だが限定公開の表現方法）
- 認証方式（プロバイダ・セッション・Supabase Auth を使うか）
- UGC のモデレーションと公開審査の運用
- `score` mode 以外の本番環境で API 書き込みをどのように制御しているか

## 成長分析の公開境界 / 同意

方針（2026-06、ADR-004 Draft）: 成長分析は**グループ内限定公開（L1: パスワード/限定リンクを知る人のみ）**を
当面の主運用とする。実名で個人をサイト全体に公開・ランキング掲載する「全体公開」（L2/L3）は提供せず、
UGC 統合とあわせて保留し、コンテンツ拡大とユーザー反響を見てから再検討する。
グループ内展開（学生含む）では本人・保護者の個別同意は基本不要。詳細は
[ADR-004](../adr/ADR-004-growth-analysis-visibility-consent.md)。

決定で解消:

- 同意主体（グループか本人か）／未成年の保護者同意 → 全体公開しないため当面発生しない。
- コンテンツ化の経路（旧 A3）→ 一般公開コンテンツはグループ内限定機能と切り離し、サイト責任者が
  既に公開されている情報をもとに作成・公開する（運営の既存の公開運用と同じ範囲、個人の追加同意は不要）。
- 名前付き成長の公開先 → 1〜2 選手に絞った運営キュレーションの**ショーケース公開**（visibility `public` を
  allowlist にだけ付与）。公開先はトップレベルの `/growth`（ハブ）＋ `/growth/[slug]`（インデックス対象）。
  将来 score への集客導線にする。選手ページ統合・results 作り込みは行わない。
- スタンドアロンの `/beta/matches-results/growth` は「グループ＝公開済みの試合」とみなし、A1 を待たず
  公開試合の参加者（`targets.json`）を対象ドロップダウンに表示する内部ツール面（`noindex`）。
  旧「A1 整備まで一覧非表示」は撤回（2026-06）。
- 実装状況 → Decision 5 の土台（`GrowthTarget.visibility`・撤回リスト・noindex）と
  ショーケース基盤（`data/growth-featured.json`・`featuredKeys`・`/growth` ハブ＋ `/growth/[slug]`・
  `lib/growthShowcase.ts`・共有表示コンポーネント・results 相互リンク・シングルス/ダブルスのタブ集約・
  もとにした試合の表示）は実装済み。score CTA 配線・集客導線は次フェーズ。
  詳細は ADR-004 の Implementation Status。

後回し（運用開始後に詰める。詳細は ADR-004 の A1/A2）:

- A1: 「公開済みの試合」より狭く、特定グループだけに限定したい場合のアクセス制御方式（ゲート/認証/パスワード等）。
  現状の `/beta/matches-results/growth` は公開試合の参加者を表示する内部ツール（noindex）で足りており、A1 は
  さらに絞り込みが必要になった段階で検討する。
- A2: 撤回（オプトアウト）の反映タイミングと緊急削除（該当 JSON 即時削除／CDN パージ）経路。

保留（再検討トリガー＝コンテンツ拡大・ユーザー反響。詳細は ADR-004 の P1/P2）:

- P1: 実名の全体公開（L2/L3）を採用する場合の同意・実名/匿名・未成年・引き上げ導線の設計。
- P2: score mode を UGC 本拠地へ転換する際の `growth_consent`（氏名ベース）と認証アカウント同意の統合・移行。

## YouTube / 動画レビュー

- YouTube 連携の保存方式と正式運用ルールは何か
- `match_video_sessions` / `match_point_candidates` の本番利用状況はどうなっているか
- 動画レビュー候補を誰がどの手順で確定するか

## 分析ロジック

- 分析指標の採用基準は何か
- 研究や現場知見に基づく裏付けをどこまで持たせるか
- `lib/matchAnalysis.ts` と `lib/growthAnalysis.ts` の責務境界を正式に定義するか
- 成長分析 JSON の更新タイミングと運用担当は誰か

## データ生成運用

- tournament details 生成の正式手順はどれか
- players 生成の最終入力源はどれか
- 手動補正のルールや履歴をどこに残すか

## 地域大会ページ

- `data/tournaments/local_index.json` の `officialUrl` を今後 UI で使うか
- `/tournaments/local/[federationId]` の大会カード並び順を明示ソートするか
- `areaId: "city"` の大会を都道府県ページから分離する予定があるか
- `detected-documents.json` で `accepted` にした候補を、どの手順で `information/*.json` に反映するか
- 巡回候補から既存 `local_index.json` の大会をどこまで半自動で推定するか

## STリーグ

- STリーグⅢ は大会データの収集が難しいため、階層構成（Ⅰ・Ⅱ・Ⅲ）の中での位置付けを紹介する扱いとし、対戦データは持たない方針。
  「準備中」の TODO ではないため、データ収集対象には含めない（`hasMatchData: false`）。
- STリーグⅡ（女子）の出場チーム・対戦データが未入力（公式PDF＝組合せ/進行表からの手入力が必要）。
  該当 division は `league.json` の `hasMatchData: false`、ページ上は「準備中」表示で運用中。
- `data/st-league/editions.json` の `promotionRelegation`（年度間の昇格・降格）は一部 Assumption。
  公式記録での裏取りが必要。
- 第1回（2023）・第2回（2024）の詳細データ（参加チーム・結果）が未入力。
- NTT西日本の連覇数など個別記録の裏取り。
- 詳細は `docs/wiki/st-league.md` を参照。

## 高校カテゴリ

- 高校カテゴリの学校名表記揺れは、`data/tournaments/index.json` に載る大会を横断して、同年度・同姓同名選手が別学校名で出た場合に同一校として寄せる暫定ルールを採用している
- 上記ルールは誤結合を許容した暫定運用であり、別校を同一校として結合するリスクがある
- `scripts/highschool/03list/inferred-team-aliases.json` の確認頻度と、手動補正ルールの置き場所をどうするか
