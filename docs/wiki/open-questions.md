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

## score機能の一般公開・新機能ピボット（検討中 2026-07-11）

詳細は [score-general-availability.md](./score-general-availability.md)。

- 差別化の核（動画事後記録／大会DB接続／重要局面分析）のどれを一番の訴求にするか
- ターゲット（個人選手 or チーム/クラブ単位）のどちらから攻めるか
- 「顧問や選手がこの手の分析を欲しがるか」の聞き取り検証
- パイロット相関分析（16試合・717ポイント）の母数拡大後の再検証
  （特にブレークポイント非対称性・ラリー長効果・1stサーブフォルトの無影響という結果の再現性）

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

## 選手データベース拡張（計画・未実装 2026-07-01）

設計ドラフト: 機能仕様 [docs/raw/2026-07-01-player-page-comprehensive-design.md](../raw/2026-07-01-player-page-comprehensive-design.md)、
集計エンジン [docs/raw/2026-07-01-player-statistics-engine.md](../raw/2026-07-01-player-statistics-engine.md)。
wiki 反映は [players-pages.md](./players-pages.md)「選手データベース拡張」節。

決定で解消（2026-07-01）:

- 学年別成績 → 確実な生年・入学年データが無いため**除外（実装しない）**。
- 全国大会の定義 → `index.json` の大会のうち `generationId` が `international` / `international-qualifier` 以外。
- 年区切り → 年度（大会データ `year` が既に年度指定のためそのまま使用）。
- ランキングの掲載偏り補正 → その年度の上位 3 大会のみ合算＋ `scope-limited` 注記。tier・係数は `data/ranking-config.json` に外出し。
- 勝率・ゲーム率の算入（データ実体に基づき改訂 2026-07-01）→ 不戦勝と途中棄権はデータ上 `retired:true` で判別不能。方針=「実際に戦った試合だけで集計」。`retired:true` は勝率・ゲーム率から全除外、draw は分母除外。ただし順位・進出率・優勝判定など placement 側には反映する。
- ダブルス H2H の既定軸 → 対個人（相方問わず名寄せ）。ペア対ペアはオプション。
- 追加統計の閾値・分母 → 最高勝率=年度別（最小10試合）、苦手・得意選手=H2H 3対戦以上、決勝・準決勝進出率=ノックアウト個人戦を分母。
  閾値 `minMatchesForSeasonWinRate=10` / `minMeetingsForH2H=3` は `ranking-config.json` に外出し。

データ実体確認済み（2026-07-01）:

- 不戦勝 / bye は独立表現を持たず `retired:true` で登録され、途中棄権と判別不能（retired 451 件中 約84% が「勝者=規定ゲーム到達・敗者=0」の既定スコア）。ルールは上記に確定反映。

決定で解消（2026-07-11、ランキング較正ハーネスによる。詳細は
[docs/raw/2026-07-11-ranking-calibration-harness-plan.md](../raw/2026-07-11-ranking-calibration-harness-plan.md)）:

- tier の微調整 → バックテスト（27,199試合・予測的中率）で較正。**外国選手参加の国際大会
  （korea-cup・平和カップひろしま）はランキング集計から除外**（`excludeTournaments`）、
  **国際予選3つ＋ルーセント東京インドアは major、ヨネックス北海道は national に再分類**
  （`tierOverrides`。旧 resolveTier では国際系→local に落ちておりミスプライシングだった）。
  再生成後の前年度スナップショット的中率 67.6%→68.1%。
- 順位係数・topN → グリッドサーチで flat係数＋topN=2 が的中率+1pt と判明したが、実績表彰としての
  性格を変えるため**現行維持を決定**（予測は Elo 副指標に任せる役割分担）。
- Elo の K 値 → K/scale 比 0.16 が Brier 最良（kByTier {80,64,48} を config 反映済み。enabled は
  false のまま）。

残る Open Question（実装フェーズで詰める）:

- ランキング副指標（Elo 系レーティング）の有効化（P3）: ダブルスの配分・provisional 扱い・表示面の設計。
- lucent-tokyo-indoor / yonex-hokkaido-international を index.json に掲載するか（tierOverrides は
  非掲載でも機能するが、大会ページとしての露出は別判断）。
- **同姓同名の人物別 id 分離 → 当面は「融合を許容」で決定（2026-07-02）**:
  `data/players/index.json` は「1 名前 = 1 数値 id」しか持たず、同姓同名の別人物を numeric id で分離できない
  （実測: index.json に nameKey 重複は 0 組。一方、同一カテゴリ内に同姓同名が別 participant.id で並ぶ実データが 30 件、
  `homonyms.json` に複数人物登録が 16 名）。numeric id を名前単位で解決するため、該当 id は複数実在人物の成績を融合しうる。
  - **決定**: 対象者が少なく実害が限定的なため、**当面は融合を許容する**（人物別 id の払い出しは行わない）。
    緩和策のみ実装して運用し、対象者が増えて実害が顕在化した段階で再検討する。
  - 実装済みの緩和（2026-07-02）: (1) H2H/ペアは `playerKey`（名前@所属）で分離（データ契約 §D）、
    (2) `lib/playerStats/facts.ts` で同一カテゴリ内 self-vs-self 試合をスキップ（自己対戦化・二重計上の除去）、
    (3) `homonyms.json` を読み `PlayerStatistics.identity.homonymRisk` を付与（UI 注記・記事で警告可能）。
  - 将来の解決策（採用保留）: participant.id が所属を含むことを利用し人物別に numeric id を払い出す
    （index.json 生成パイプラインの変更）。既存 id・ページ URL・リンクへの影響が大きいため、必要が生じるまで着手しない。

## 国際大会の選手同定（ローマ字表記）

詳細は [data-import.md](./data-import.md)「国際大会（ローマ字表記のみの参加者）の選手同定」。

- コリアカップ2026は日本選手63名中9名のみ `data/tournaments/participant-aliases.json` で解決済み（curated slugとの完全一致で確度100%が取れた分のみ）。残り54名は連盟発表等で漢字が判明次第、追記する
- 対応表はこの1大会・1年度に限定していない（`tournaments[].years[]` 構造）ため、今後の国際大会（アジア選手権、ワールドカップ予選等）でも同じ仕組みを使い回せる。次の国際大会でも「代表発表(ローマ字)に対して、既存curatedプロフィールとの機械的完全一致でどこまで拾えるか」をまず確認し、残りは手動追記する運用を継続する
- 対応表の更新はincremental差分検知の対象外（`participant-aliases.json` はmanifestのファイルスナップショット対象に含まれていない）。更新時は`playerstats:facts`をフル実行する運用ルールを徹底する必要がある

## 高校カテゴリ

- 高校カテゴリの学校名表記揺れは、`data/tournaments/index.json` に載る大会を横断して、同年度・同姓同名選手が別学校名で出た場合に同一校として寄せる暫定ルールを採用している
- 上記ルールは誤結合を許容した暫定運用であり、別校を同一校として結合するリスクがある
- `scripts/highschool/03list/inferred-team-aliases.json` の確認頻度と、手動補正ルールの置き場所をどうするか
- （対応済み）大会結果データの表示上の学校名・県名の揺れは、手動対応表 `data/tournaments/team-name-aliases.json` ＋ `scripts/normalize-team-names.mjs` で正準名へ統一する運用を追加した（誤結合を避けるため自動推定ではなく手動定義）。都道府県の接尾辞揺れ（例: 徳島→徳島県）はスクリプト内蔵の47都道府県マップで補完。適用範囲は `highschool-japan-cup`（HJC）。登録済みエイリアス: 高田商 / 大分商 / 明豊 / 旭川工 / 北科大 / 焼津 / 高崎商 / 県岐阜商 / 富士見。HJC 2024男子ダブルスの破損（県名混入・参照切れ）は `scripts/fix-hjc-2024-doubles.mjs` で修復済み。詳細は `docs/wiki/data-import.md`。
