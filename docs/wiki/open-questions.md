# Open Questions

このページは**未解決の問いだけ**を置く。解決したものは末尾の
「[解決済み（記録）](#解決済み記録)」へ移し、1〜3行の結論と参照先だけ残す
（2026-09-02 に整理。解決済みの節が本文中に居座り「未解決の一覧」として読めなくなっていたため）。

## ドキュメント運用（2026-08-12 lint → 2026-09-02 lint で更新）

`docs/raw/2026-08-12-llm-wiki-lint.md` / `docs/raw/2026-09-02-llm-wiki-lint.md`
（リポジトリ全体のヘルスチェック）の §5 より。機械的に直せるものは各 lint で修正済みで、
ここには判断が要るものだけを残す。

**2026-09-02 に解消したもの**（項目は落とし、経緯だけ残す）:

- 解決済み Open Question の置き場 → 末尾に「[解決済み（記録）](#解決済み記録)」を新設し、
  解決した6件を移した。以後、解決したものは本文から外してそこへ移す。
- `docs/sql/*.sql` の適用追跡 → [docs/sql/APPLIED.md](../sql/APPLIED.md) を新設して解決。
  ただし `receive-order.sql` の本番適用可否は**まだ「未確認」のまま**で、下に単独の項目として残す。
- Compile Log 欠落26本の遡及 → AGENTS.md に適用開始日（2026-07-11）と
  2026-08-01 以降のバックフィル済みを明記して打ち切り済み。**2026-08-13 以降に新規追加された
  raw 36本のうち7本に Compile Log が無い**ため、下に運用の項目として残す。
- CI スクリプト2本（`check-highschool-pipeline-freshness.mjs` / `check-orphan-entries.mjs`）の
  docs 未言及 → 解消済み。

現在の未解決:

- **`docs/sql/receive-order.sql` を本番 Supabase に適用したかが未確認。** 未適用ならポイント入力の
  レシーブ選手自動推定が働かない（`games.initial_receive_player_index` が常に null）。
  確認して [APPLIED.md](../sql/APPLIED.md) に日付を入れる。
- **Compile Log の運用が定着しきっていない。** 2026-08-13 以降の raw 36本中7本が未記入
  （`2026-08-12-secondaryschool-{release-checklist,teamid-review}` / `2026-08-12-university-team-name-cleanup` /
  `2026-08-13-player-name-variants-review` / `2026-08-15-m4-gsc-review` /
  `2026-08-20-zennihon-workers-2022-general-boys-review` / `2026-08-31-player-registered-name-change`）。
  うち作業リスト型（teamId 目視・要確認リスト）は wiki へ載せるものが元々無い可能性が高いので、
  **「作業リスト型の raw には Compile Log を求めない」と AGENTS.md に例外を書くか、
  「除外のみ1行」で必ず書かせるか**を決める。
- **選手の登録名変更（改名）の対応表が未実装。**
  `data/players/player-name-aliases.json` と `scripts/normalize-player-names.mjs` の実装、
  林 湧太郎 → 林 佑太郎 の適用（`index.json` の count 22 → 24 を含む）が残っている。
  設計は [team-player-identity.md](./team-player-identity.md)「選手の登録名変更（改名）」、
  経緯は [raw/2026-08-31-player-registered-name-change.md](../raw/2026-08-31-player-registered-name-change.md)。
- **改称した大学を1校にまとめるか。** `神戸松蔭女子学院大学` / `神戸松蔭大学`（2025年改称）、
  `神戸親和女子大学` / `神戸親和大学` が `/university/` と大学別の出身高校一覧で別々に並んでいる。
  どちらの表記も正しいので名寄せ（alias）では寄せていない。表示だけ「旧称」として束ねるか、
  改称をエンティティとして扱う仕組みを作るか（[university.md](./university.md)「既知の課題」）。
  2026-09-14: `/teams/kobe-shoin-univ/` では mapping で2表記を束ねた。進路データ（出身高校一覧）側は未解決。
- **高校→大学の進路で、氏名一致のみの採用が96%を占める。** 推定誤マッチ約20件を個別に特定する手段が無い。
  同じ高校から同じ大学へ複数人、などの相互裏付けで `basis` を細かくできるか
  （[raw/2026-09-13-university-pathways-verification.md](../raw/2026-09-13-university-pathways-verification.md)）。
- 2026-05-24 最終更新の4ページ（`backend.md` / `database.md` / `project-overview.md` /
  `score-analysis.md`）を「復元した初期メモ」から「現行仕様」へ昇格させるか、統合して
  Deprecated にするか。実装との突き合わせでは内容はほぼ正しく、格付けだけが古い
  （2026-09-02 lint でも API エンドポイント11本が実装と全一致することを再確認。
  ただし同 lint で `prebuild` の記述が3段のまま実態15段とずれていたのを修正しており、
  「内容は正しい」は無条件ではない）。
- wiki → raw の参照が「バッククォートのパス表記」と Markdown リンクで混在しており、
  到達性を機械チェックできない。どちらかに寄せるか。
- 中断案件の「再開トリガー」を統一フォーマットで持たせる
  （`docs/exploration-cycle-audit-2026-08-10.md` §1-7 の提言。最初の適用先候補は
  `docs/ui/**` の M5＝トークン導入、2026-07-04 から停止中）。
- この lint 自体を `scripts/check-docs-lint.mjs` として CI 化するか
  （リンク切れ・孤立・Compile Log 欠落・ADR Status 記入漏れは機械判定できる）。

## 発展候補アイデア一覧（Idea Backlog・プロジェクト運用/メタ）

プロダクト機能でなく、開発・AI協働の進め方に関するアイデアはここに積む
（score機能まわりの機能アイデアは [score-general-availability.md](./score-general-availability.md) の表を参照）。

表の「状況・目的」は**状況と1行の目的・残りだけ**を書く（数値・経緯は raw へ。規則は [idea-backlog.md](./idea-backlog.md)「使い方」）。

| アイデア | 状況・目的（1行） | 詳細 |
|---|---|---|
| AIが自律的にサービスを改善する仕組み（検知・検証の全体委譲） | **方向決着・一部実装**（2026-09-06〜）。検知と検証をAIに任せ、方向の判断は人が持つ。CI（`checks.yml`）と判断台帳まで実装。チーム名寄せは全件人手レビューへ（[ADR-019](../adr/ADR-019-team-merge-human-only.md)）、抜き取り監査はPDF取り込みへ移す | [アイデア](../raw/2026-09-06-idea-autonomous-improvement-agent.md) |
| AIとの共同探索と探索プロセスの属人性 | 発散フェーズ・中断中（2026-07-11）。中心の問い=「AIは人間の探索の属人性をどこまで減らせるか（品質の底上げ、答えの均一化でなく）」。消化状態の追跡はミクロ層として下位に位置付け。**再開はrawファイル末尾の「再開ポイント」（未回答の問い3つ）から** | [アイデア](../raw/2026-07-11-idea-ai-co-exploration-context.md) |
| skillのローカルLLM代替（Claude不在時） | **一部実装**（2026-08-14〜）。Claude 不在時に skill をローカルで回す。venue-data・pdf-to-players は実装済み（LLMはほぼ不要）。本命の insight は照合の網の拡張が先。モデル選定は保留 | [アイデア](../raw/2026-08-14-idea-local-llm-skill-replacement.md)、[インカレの姓名分割](../raw/2026-08-29-intercollegiate-name-split.md) |
| wiki の圧縮（読み込みコストの削減） | **一部実施**（2026-09-18〜）。wiki を現在の仕様だけにして毎回の LLM コストを下げる。seo.md は圧縮済み、予算超過の残り9ページ（手順は [slim-wiki-page.md](../prompts/slim-wiki-page.md)） | [作業ノート](../raw/2026-09-18-wiki-slimming.md) |

## 姓名の分割ゆれ（2026-08-29 棚卸し）

**未解決なし**。検出器A（分割衝突）・検出器B（辞書照合）とも 0 件
（`node scripts/check-name-splits.mjs --strict` が成功する状態）。
保留していた 6 件と辞書照合の 21 件は 2026-08-29 にユーザー判断で確定した。
判断の物差しは [team-player-identity.md](./team-player-identity.md) の「姓名の分割ゆれ」節、
全数の根拠は [raw/2026-08-29-name-split-audit.md](../raw/2026-08-29-name-split-audit.md)。

- **対応済み（2026-08-29）**: `check-name-splits.mjs --strict` を `prebuild` のゲートに入れた
  （`check-highschool-pipeline-freshness.mjs` の次、実行 0.7 秒）。
  新しい取り込みで疑いが出た時点でビルドが止まるので、`verified` に足すか表に判断を書いて
  `normalize-name-splits.mjs` を回すまで通らない。
- **未着手**: ダブルスの**ペアの境界ずれ**（`林楓|恋荒` ＋ `川|琴美` → `林|楓恋` ＋ `荒川|琴美`）を
  拾う検出器が無い。検出器 A・B のどちらにも掛からず、2026-08-29 の 1 件は副作用で偶然見つかった。
  「同一エントリー内の 2 人の氏名を連結し直し、別の切り方なら双方の姓名が辞書に当たるか」を
  見れば検出できるはず。他に残っているかは未調査。

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

## 試合詳細の beta 昇格（設計 2026-06 → **実装済み 2026-07-02**）

設計の詳細は [score-site-link.md](./score-site-link.md)。決定はすべて実装に入っている
（2026-09-02 に確認）:

- ネスト URL `/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]/matches/[matchId]`
  のページが実在（2026-07-02 追加）。野良試合は `/beta/matches-results/*` のまま
- 逆引き表は `public/data/beta-matches/reverse/by-tournament.json` / `by-player.json` の2本を
  `scripts/generate-match-reverse-index.mjs`（`prebuild` 済み）が生成
- 掲載試合は25件中24件に `siteLink` が付いている

残る Open Question:

- ~~逆引き表の置き場所とファイル分割（全選手1ファイルで足りるか）~~
  → **足りている**（`by-player.json` が29KB / `by-tournament.json` が10KB、25試合時点）。
  試合数が3桁になったら再評価する
- 手入力フォールバック（野良）試合に後から `siteLink` を付与して掲載大会試合へ昇格させる導線を作るか
  （現在 `siteLink` なしは1件）
- **[score-site-link.md](./score-site-link.md) 自体がドラフトの文体のまま**（「本リリースでは急がない」
  「移行スクリプトで一括付与する」等の未来形）。最終更新 2026-06-25 で、wiki 32ページ中もっとも古い。
  実装済みの現状仕様として書き直すか、設計ドラフトとして明示するか

## score データモデル

**2026-09-02 に実装から回答できたもの**（下記は Open Question から外した）:

- **`matches.status` / `processing_status` の値と遷移**（`src/types/database.ts`・書き込み箇所を実測）
  - `matches.status`: 型は `draft | in_progress | completed | archived` の4値。実際に書かれるのは
    `draft`（作成時の一部）→ `in_progress`（試合作成・ゲーム追加時）→ `completed`（入力完了時）で、
    **`archived` は読み書きとも0箇所＝死んだ値**。
  - `processing_status`（動画レビューセッション）: 型は5値。実際は
    `draft`（セッション作成）→ `reviewing`（セグメント登録・レビュー中）→ `committed`（確定時、
    `lib/videoReview.ts`）の3値のみで、**`ready` / `processing` は未使用**。
- **`points.result_type` の enum**: winner 7値（`smash_winner` / `volley_winner` / `passing_winner` /
  `drop_winner` / `net_in_winner` / `service_ace` / `winner`）＋ error 7値（`net` / `out` /
  `smash_error` / `volley_error` / `double_fault` / `receive_error` / `follow_error`）＋
  旧データ用の `forced_error` / `unforced_error`。
- **`edit_token` / `edit_token_hash` の撤去**: アプリ側（`src/**` / `lib/**` / `src/types/database.ts`）
  からは**既に消えている**。残るのは `scripts/generate-beta-matches-json.mjs` の
  `INTERNAL_FIELD_NAMES`（公開 JSON から落とす防御用の名前リスト）と、Supabase 側の実カラムだけ。

残る Open Question:

- score 機能の正式な source of truth は Supabase か、それとも生成済み JSON か
- 上記の**死んだ値（`archived` / `ready` / `processing`）を型から落とすか**、将来使う予定として残すか
- `result_type` の集合が**3箇所に重複定義**されている（`lib/matchLogic.ts`・
  `lib/matchAnalysis/helpers.ts`・`src/pages/beta/matches-results/[matchId]/index.tsx`）。
  `forced_error` / `unforced_error` を含むかが箇所ごとに違うので、一本化するか
- Supabase の `edit_token` 列そのものをいつ落とすか（落とすなら `docs/sql/` に DDL と
  [APPLIED.md](../sql/APPLIED.md) の行が要る）

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

## 予選リーグ→決勝Tのデータ表現（積み残し）

本体（`bracket-slot-parity` の誤検知）は 2026-08-22 に `knockoutDraw` の導入で解決済み。
経緯は末尾の[解決済み（記録）](#解決済み記録)。以下はそこから残った未解決事項。


- **2段リーグ形式（予選リーグ→準決勝リーグ→優勝決定戦）の2段目の順位が記録されない。**
  `results[].roundrobin` は組を1つしか持てないため、`zennihon-university-ouza/2026/team-none-boys`
  では準決勝リーグの順位が残らず、「ベスト4」「ベスト8」の根拠が `matches` にしか無い。
  `roundrobin` を段ごとの配列にするかは、この形式が現状1大会だけなので保留。
- 開催前・進行中の大会で未確定席をどう見せるか（「A組1位」と書くか空欄のままか）。
  データ上は開催前でも表を組めるようになったが、表示は未設計で現状は空席として描かれる。
- 予選リーグ大会に残っている `entries[].type` を消すか。**2026-09-02 に再実測して2点訂正**:
  - 件数は「90ファイル中26」ではなく、**予選リーグ／`knockoutDraw` を持つ112ファイルの全件**に
    残っている。投入ツール（`tools/tournament3` の `buildEntriesMeta`）が書き続けているため、
    放置すると増える一方（値の内訳は `packing` 18,018 / `extra` 10,634 / `seed` 5,890 / null 4,963）。
  - **「表示・検証はもう読まない」は誤り**。`lib/bracketLayout.ts` は
    ノックアウトのみの大会で今も `entries[].type` から席順を組む（`seed` / `extra` / `packing`）。
    予選リーグ大会では `knockoutDraw` の経路が先に効くので実害は出ていないが、
    同ファイルには「全件 `packing` かつ出場数が2冪だとパリティ検査をすり抜けて誤復元する」という
    実例（`zennihon-senior/2025/doubles-over80-girls`）への防御コードが入っており、
    **予選リーグ側の `type` を消せばこの防御そのものが不要になる**。

## 分析ロジック

- 分析指標の採用基準は何か
- 研究や現場知見に基づく裏付けをどこまで持たせるか
- 成長分析 JSON の更新タイミングと運用担当は誰か

## データ生成運用

- tournament details 生成の正式手順はどれか
- players 生成の最終入力源はどれか
- 手動補正のルールや履歴をどこに残すか

## 地域大会ページ

- `data/tournaments/local_index.json` の `officialUrl` を今後 UI で使うか
- `/tournaments/local/[federationId]` の大会カード並び順を明示ソートするか
- `areaId: "city"` の大会を都道府県ページから分離する予定があるか
- ~~`detected-documents.json` で `accepted` にした候補を、どの手順で `information/*.json` に反映するか~~
  （解決・2026-09-12: 手順を決めずに 583 件が放置されたため、ストアごと削除して運用を停止した。
  [tournaments-local.md](./tournaments-local.md) の「候補検知フロー（Deprecated）」を参照）
- ~~巡回候補から既存 `local_index.json` の大会をどこまで半自動で推定するか~~
  （失効・2026-09-12: 巡回候補そのものを廃止したため。再開するなら出口の設計から）

## STリーグ

- STリーグⅢ は大会データの収集が難しいため、階層構成（Ⅰ・Ⅱ・Ⅲ）の中での位置付けを紹介する扱いとし、対戦データは持たない方針。
  「準備中」の TODO ではないため、データ収集対象には含めない（`hasMatchData: false`）。
- STリーグⅡ（女子）は2025（第3回）は入力済み（`hasMatchData: true`、予選リーグの星取り・最終順位を掲載）。
  順位決定戦の個別対戦・選手別データのみ未入力（女子は公式PDFに選手名簿が無いため）。
  他年度（2023・2024）の女子Ⅱ部や2026以降は別途入力が必要（2023・2024の男女本戦データ自体は
  `participants.json` / `matches.json` とも既存）。詳細は `st-league.md` の
  「Open Questions / 未入力データ」節を参照（2026-06-25時点の本ページ記述はここで陳腐化していたため2026-08-01に修正）。
- **STリーグの結果を `data/tournaments/details/` にも入れるか**（2026-08-12 保留）: 一覧掲載は
  `information[].resultPath` での内部リンクで済ませ、結果本体は `/st-league/` に委譲した
  （`st-league.md`「大会一覧との連携」）。details へ複製すると Player Statistics Engine に乗り
  選手ページにSTリーグ戦績を出せるが、tie の内訳が落ちる・カニバる・順位が二重管理になる。
  選手DB連携が主目的になった時点で再判断する。
- `data/st-league/editions.json` の `promotionRelegation`（年度間の昇格・降格）は一部 Assumption。
  公式記録での裏取りが必要。NTT西日本の連覇数など個別記録の裏取りも同様。
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

決定で解消（2026-07-11、P3）:

- Elo副指標の有効化 → **生成のみ有効化**（`npm run ratings:generate` → `data/ratings/current.json`、
  内部利用）。レートは選手1人に1本（統合）、ダブルスはペア平均→両者同デルタ、provisional は
  K倍率でなく表示ゲート（10試合未満は無順位）として扱う。

残る Open Question（実装フェーズで詰める）:

- Eloレーティングの**公開面の設計**: 未成年の実名で「負けると下がる数字」を出すかの感度整理、
  出すなら established のみ・注記付き・下降表現を避けた見せ方。当面は内部利用に留める（2026-07-11決定）。
- `data/ratings/current.json` の更新運用（prebuild 組み込みは giant-killing 実装時に判断。
  それまでは details 追加時に手動で `ratings:generate` を再実行）。
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

## 選手結果ページ「スコア詳細のある試合」の大会結果統合（2026-08-07 追加）

選手結果ページのセクション階層化（[players-pages.md](./players-pages.md)「結果ページの
セクション階層化」）で検討したが見送った案。「スコア詳細のある試合」（`scoreMatchLinks`）は
大会結果（試合結果一覧）の一部試合への逆引きリンクで、内容が重複している。大会結果側の
該当試合カードにバッジ的に統合できれば別枠の表示が不要になるが、`ScoreMatchLink.matchId`
に対応する結合キーが `PlayerMatch`（`src/components/PlayerResults.tsx`）に無く、
新規joinの実装が要る。効果とコストを見て着手判断する。

## 国際大会の選手同定（ローマ字表記）

詳細は [data-import.md](./data-import.md)「国際大会（ローマ字表記のみの参加者）の選手同定」。

- コリアカップ2026は日本選手63名中27名が `data/tournaments/participant-aliases.json` で解決済み（curated slugとの完全一致で確度100%が取れた分のみ、2026-07-20時点）。残り36名は連盟発表等で漢字が判明次第、追記する
- 対応表はこの1大会・1年度に限定していない（`tournaments[].years[]` 構造）ため、今後の国際大会（アジア選手権、ワールドカップ予選等）でも同じ仕組みを使い回せる。次の国際大会でも「代表発表(ローマ字)に対して、既存curatedプロフィールとの機械的完全一致でどこまで拾えるか」をまず確認し、残りは手動追記する運用を継続する
- 対応表の更新はincremental差分検知の対象（`participant-aliases.json` は `computeGlobalHash`、`lib/playerStats/manifest.ts` のグローバル入力ハッシュ対象に含まれている）。追記すればハッシュが変わり prebuild が自動でフル再計算をトリガーするため、手動で `--full` を付ける必要はない（旧・対象外という記述は誤りだったため訂正。2026-07-20）
- パートナー（対戦相手だけでなく、自分と組んだ相方）の紐付けもこの対応表で解決される。`personRefFromParticipant`（`lib/playerStats/facts.ts`）は対戦相手・パートナーを区別せず同じロジックで解決するため、対応表に載っている相手であれば byPartner 集計（`lib/playerStats/aggregators/byPartner.ts`）や選手結果ページの「サマリー」→「パートナー別」でも自動的に本人の数値idへ紐付く。追加の実装は不要で、`aliases[]` にエントリを追記するだけで反映される

## 高校カテゴリ

- 高校カテゴリの学校名表記揺れは、`data/tournaments/index.json` に載る大会を横断して、同年度・同姓同名選手が別学校名で出た場合に同一校として寄せる暫定ルールを採用している
- 上記ルールは誤結合を許容した暫定運用であり、別校を同一校として結合するリスクがある
- `scripts/highschool/03list/inferred-team-aliases.json` の確認頻度と、手動補正ルールの置き場所をどうするか
- **`normalize-team-names.mjs` の既定スコープが `highschool-japan-cup` のままである点**（2026-09-02 確認）。
  未適用の揺れは現在0件だが、それは誰かが `--scope=all` を明示して流した結果で、
  既定で流すと HJC しか直らない。既定を `all` にするか、`prebuild` に組み込むか。
  なお `normalize-team-spacing.mjs`（全角半角の正準化）は既に `prebuild` の先頭に入っている。
  → 対応表の仕組み・登録済みエイリアス・過去の修正履歴は [data-import.md](./data-import.md) が正。

## チーム名寄せ（2026-09-05 追加）

- **インターハイ2012 男子ダブルス・埼玉県の `春日部` がどの高校か未確定**。
  `春日部クラブ`（社会人）へ誤って寄らないよう alias に `scope` を付けたが、
  素の `春日部` のまま残っている（春日部/春日部東/春日部工業 等の候補）。
  当時の出場者は吉水悠・中村匡貴。→ [team-player-identity.md](./team-player-identity.md)「alias の大会スコープ」
- **選手共有シグナルで挙がった104クラスタのレビュー**（[ADR-017](../adr/ADR-017-team-merge-signal-player-overlap.md)）。
  `data/teams/team-merge-review.html` に「選手共有: N名」として並ぶ。自動OKには絶対に載らないので、
  全件が人手判断待ち。うち55件は `scripts/highschool/03list/inferred-team-aliases.json` に既出。
- そのうち**表記揺れではなく取り込み時の誤字**が混ざっている（`きのくに宿用金庫` / `きのくに用金庫`、
  `岩見沢光陵中学校拠`）。これらは alias ではなく**元データの修正**が要る。
- `inferred-team-aliases.json`（高校パイプライン）と `team-player-overlap.mjs`（本体）が
  **同じ規則の二重実装**になっている。どちらに寄せるか。

## milestone の不変条件を機械チェックするか（2026-09-05 追加）

- `nth-title` の `gapYears === 1` は**定義上ありえない**（ギャップ1年＝連続開催の連続優勝＝連覇）。
  実際に 2026-09-05 まで5件出ており、連覇判定と first/nth 判定の照合基準の非対称が原因だった
  （修正済み。[raw/2026-09-05-repeat-title-team-change.md](../raw/2026-09-05-repeat-title-team-change.md)）。
  この種の**自己矛盾するラベルを検出する不変条件チェック**を `scripts/check-*.mjs` 系に足すか。
  候補の不変条件: `nth-title` は `gapYears >= 2`／同一選手に `repeat-title` と `first-title` が同時に出ない／
  `repeat-title` の `since < year`。全468エディション総当たりで数秒なので CI に載せられる。
- 併せて、`lib/milestones.ts` にはテストが無い（`lib/__tests__/` に milestone のケースが1本も無い）。
  上記の総当たりチェックで代替するか、代表ケース（ペア替わり連覇・所属変更連覇・隔年開催）の
  ユニットテストを置くか。

## 大会 information の `location` 検算（2026-08-28 追加）

全中2026の `location` が前年の値（`熊本県`）の複製で誤っていた件
（[raw/2026-08-28-zenchu-2026-location-fix.md](../raw/2026-08-28-zenchu-2026-location-fix.md)）の残タスク。

- **2023年以前の `location` は未検算**（Assumption）。機械照合に使った
  `data/local-sources/jsta-yearly-events/` は2024年度以降しか存在しないため、
  遡るには大会ごとの要項/公式サイトを個別に当たることになる。
  優先度は低い判断: 2023年以前で「連続する年に同じ `location`」が出るのは
  高校選抜2020-2023（愛知県）・STリーグ2023-2024（愛知県）等で、いずれも
  固定会場の大会として説明がつく。ただし**一次情報での確認はしていない**。
- 検算を `scripts/` に常設するか。今回は使い捨てスクリプトで回した。
  `check:upcoming` と同じく「終了コード0の運用タスク一覧」として足す余地はある。
- `surface` の実在値と [data-model.md](./data-model.md) の語彙が食い違う。
  **実測（2026-09-02）**: `砂入り人工芝` 21件 / `人工クレー` 6件 / `クレー` 1件の**3種類だけ**で、
  語彙にある `ハード` と `木床フローリング` は**実データに1件も無い**。
  `人工クレー` を `クレー` へ寄せるか語彙に足すか、`ハード` / `木床フローリング` を語彙に残すかを決める
  （再実測: `grep -rho '"surface": "[^"]*"' data/tournaments/information/ | sort | uniq -c`）

## `verify-facts-golden.ts` の golden 値が陳腐化している（2026-08-28 記録）

`npm run playerstats:verify` の1つめ `scripts/playerStats/verify-facts-golden.ts` が
**14人で DIFF** になる。いずれも facts のほうが golden より試合数が多い方向。

**母数（2026-09-02 再訂正）**: DIFF の母数が **22** である点は正しいが、理由の説明が誤っていた。
`lib/playerStats/fixtures.ts` の `CURATED_FIXTURES` は **22エントリ（id 1..22）で全件 `slug` を持つ**。
slug を持たない4件（id 35 / 122 / 125 / 69）は別の定数 `HIGH_VOLUME_FIXTURES` の側にあり、
`verify-facts-golden.ts` はこれを読まない。したがってループ冒頭の `if (!fx.slug) continue;` は
**一度も発火しない**。「26エントリのうち4件が飛ばされて22になる」という説明は誤り。

**golden 値はハードコードされていない（2026-08-28 訂正）**。旧記述は「同スクリプトにハードコード、
最終更新2026-07-02」としていたが誤り。`verify-facts-golden.ts:55-62` は
`data/players/{slug}/analysis.json` を読み、その中身をそのまま golden として比較している。
ハードコードされているのは `CURATED_FIXTURES` の id / slug / name だけで、数値は
`data/players` のコミット内容に追随する。2026-07-02 に固まったのは**数値ではなく fixture 一覧**。

この違いは対処法を変える。DIFF の正体は「再計算した facts vs **コミット済みの analysis.json**」であり、
**本番ビルドが書き換えるファイルそのもの**なので、**再生成された analysis.json をコミットすれば
verify は副作用として green になる**。2026-08-28 の実測では、ビルドが書き換えた analysis.json は
14件で、**全件が `CURATED_FIXTURES` の中**（外は0件）だった＝DIFF 集合と同一。

エンジンの不具合ではないことは `verify-golden-final.ts`
（facts キャッシュ vs ソースからの再計算、76人で ok=76）が別途担保している。

- `playerstats:verify` は **prebuild に入っていない**のでビルドは落ちない。
  落ちるのは手で verify を回したときだけ
- 2026-07-19 の時点では2人（funemizu-hayato / kurosaka-takuya）だった
  （[raw/2026-07-19-cloudflare-build-time.md](../raw/2026-07-19-cloudflare-build-time.md) 追記2）。
  データが増えるたびに広がるので、放置すると verify が常に赤い状態になり
  「本物の退行に気付けない」検査になる

- ~~**カバレッジの穴**: `tsukamoto-hikaru` だけ検証対象外~~
  → **解決（2026-09-02）**。`lib/playerStats/fixtures.ts` の `CURATED_FIXTURES` に
  `tsukamoto-hikaru`（塚本光琉・id 159）を追加し、**23件 = `analysis.json` 23人で一致**。
  同じ足し忘れが再発しないよう、配列の JSDoc に「`analysis.json` を増やしたらここにも足す」
  という注意書きと件数の確認方法を入れた。

やること: 再生成された `analysis.json` をコミットして golden を現在値に合わせるか、
`analysis.json` を golden に使うのをやめて「前回値との差分がしきい値を超えたら落とす」形に
変えるかを決める。**前者は「値を貼り直す」作業ではなく、生成物をコミットするだけ**である点に注意。

**現状（2026-09-02）**: 前者は事実上の運用になっている。2026-08-28 に
`768918cc 選手の analysis.json を現在のデータで再生成する` でリセットされて以降、
データ取り込みのたびに再生成された `analysis.json` が同じコミットに乗っている
（8/28以降で10コミット）。つまり「DIFF が溜まり続ける」状態ではない。
**残る判断は「この運用を明文化して終わりにするか、差分しきい値方式へ作り替えるか」**の1点。

再発見の経緯: [raw/2026-08-28-build-time-nft-glob.md](../raw/2026-08-28-build-time-nft-glob.md) 追記2

## パイプラインのスクリプト変更を鮮度チェックが見ていない（2026-09-06 追加）

`check-highschool-pipeline-freshness.mjs` は**元データ**の内容ハッシュしか見ないので、
`scripts/highschool/**` の python を直しても反応しない。スクリプトを変えれば生成物は
変わりうるので、本来は再実行が要る。スクリプトの内容もハッシュに混ぜれば閉じられるが、
今度は「コメントを直しただけで赤くなる」ノイズが増える。どちらを取るかは未決定。
→ [調査メモ](../raw/2026-09-06-highschool-pipeline-freshness-false-positives.md)

## エントリーの二重登録と `nextMatchId` の壊れ（2026-09-06 追加）

`npm run bracket:verify` の250件不一致を調査した副産物
（[調査メモ](../raw/2026-09-06-bracket-verify-250-mismatches.md)）。

- **`highschool-championship/2013/doubles-none-boys` の entryNo 136 の組が誰なのか分からない。**
  同じ `playerIds`（`長友_祐人_日向_宮崎県 / 寺田_侑世_日向_宮崎県`）が entryNo 136 と 277 の
  2 席に入っている。複製されていた試合2件は削除して整合を取ったが、**136 の側の氏名は
  元資料（2013 インターハイ男子ダブルスのドロー表）が無いと復元できない**。
  このままだとこの組の選手ページで 2013 の「2回戦敗退」が2件計上される。
  Assumption: 誤っているのは 136 の側（複製された試合が 277 の対戦相手を持っていたため）。
- **同種の異常が他に3件ある（未対応）。** どちらの走査も現状どの検出器にも入っていないので、
  次に起きても気付けない。ルール化するかは未決定。
  - `entries[].playerIds` の重複: `zennihon-university/2025/singles-none-boys.json`
  - `nextMatchId` の先に勝者が居ない: `highschool-shikoku-block/2026/doubles-none-girls.json` /
    `east-japan/2025/doubles-none-girls.json`
- **`tournament_results_common.check()` が入力ツール経路に掛かっていない。**
  2013 の3症状（試合数がエントリー数−1と合わない／勝者が次戦に現れない／同一ラウンドに
  同じ entryNo）はすべてこの `check()` の既存ルールで捕まるが、Python の PDF パイプラインを
  通ったときしか走らない。入力ツール（`tools/tournament3`）から入れたデータにも同じ検査を
  掛けるか（`validate-entries.js` 側へ移すか、全データ走査の検出器を1本足すか）は未決定。
- **入力ツールが本戦前の「予選」形式を出力できない。** `tools/tournament3` の
  `buildEntriesMeta()` は1回戦の枠組みだけを見るので、本戦前に予選があると枠がずれ、
  `type: 'preliminary'` を出せない。既存データではこの形式は
  `zennihon-singles/2017/singles-none-boys` の1件だけなので手当てを保留している。

---

## 大会の略称マスタが3つに分かれている（2026-09-09 追加）

同じ「大会の通称・検索名」を持つマスタが3つある。

| マスタ | 対象 | 使う場所 |
|---|---|---|
| `data/tournaments/index.json` の `searchLabel` / `searchAliases` | 汎用ルートの大会 | 大会ハブ・年度別結果・展望/結果記事の title / h1 / description |
| `lib/highschoolNationalTournamentMeta.ts` の `aliases` | 高校全国大会 | `/highschool/tournaments/[tournament]` |
| `lib/nationalTitles.ts` の `aliases` | 全国大会（優勝判定用） | 選手ページの勲章カード・「全国大会優勝」SEO 文言 |

分けた理由は `lib/tournamentSearchNames.ts` 冒頭に記録済み（対象集合が違う）だが、
**実害が出はじめている**。2026-09-09 に展望/結果記事の title を `searchLabel` 経由に
切り替えたところ、`index.json` 側が空の高校全国大会だけが取り残され、
`/news/highschool-championship-2026/` の title は「全国高等学校総合体育大会2026 展望…」の
ままで「インターハイ」literal を持たない。

選択肢: (a) 高校全国大会にも `index.json` の `searchLabel`/`searchAliases` を入れて
二重管理する、(b) 高校マスタを `index.json` 側へ寄せる、(c) news ルートだけ
高校マスタも引く。**未判断**。

→ [seo.md](./seo.md)「title の字数超過（大会ページ）と「インカレ 2026」の順位」、
[raw/2026-09-09-incare-2026-serp-position-and-title-budget.md](../raw/2026-09-09-incare-2026-serp-position-and-title-budget.md)

## 汎用ハブへの「開催中モード」移植（2026-09-09 追加）

会期中に title / h1 / description を「{通称}{年} 結果・途中経過」インテントへ切り替える仕組み
（[seo.md](./seo.md) #11・2026-08-01）は `/highschool/tournaments/[tournament]` 専用で、
汎用ハブ `/tournaments/[generation]/[tournamentId]/` には入っていない。
インカレ・全中・全日本選手権・全日本社会人など**汎用ルートの大会は全部この恩恵を受けていない**。

2026-09-09 に汎用ハブへ「最新収録年」を literal で入れる対策までは実施したが、
会期中の途中経過インテントへの切替は未実装。期限は次に会期を迎える汎用ルートの大会の前。

→ [raw/2026-09-09-incare-2026-serp-position-and-title-budget.md](../raw/2026-09-09-incare-2026-serp-position-and-title-budget.md)

## プロジェクトの skill が2箇所に分かれている（2026-09-09 追加 → 同日解決）

**解決**: 個人 skill 側にあった4つを `.claude/skills/` へ移した（選択肢 a）。
`tournament-insight` / `tournament-pdf-to-players` / `tournament-venue-data` / `idea-backlog`。
いずれも `data/tournaments/**` や `docs/wiki/**` を直接指す**このリポジトリ専用**の手順書で、
汎用 skill（docx / pdf / xlsx / skill-creator 等）とは性質が違う。
移動後に個人 skill 側は削除した（同名が2箇所にあると発火が曖昧になるため）。
**2026-09-17 訂正**: 個人 skill 側の4つは**まだ残っている**
（`~/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/.../skills/`。
セッションの skill 一覧にも `idea-backlog` と `anthropic-skills:idea-backlog` が並んで出る）。
原因はアカウント側の同期: 手元の `manifest.json` に claude.ai のアカウントに登録された skill
（`creatorType: "user"`）として載っており、2026-09-17 00:39 にも再同期されていた。
手元のフォルダを消しても戻るので、**claude.ai の設定から消す必要がある**（ユーザー判断 2026-09-17: 消す）。
以降は skill の変更が PR に載り、他のマシン・他の人にも届く。

以下は経緯の記録。

### 当時の状況

同じプロジェクト向けの skill が、リポジトリの内と外に分かれている。

| skill | 実体 | git |
|---|---|---|
| `tournament-pdf-to-results` | `.claude/skills/tournament-pdf-to-results/` | 追跡されている |
| `tournament-insight` / `tournament-pdf-to-players` / `tournament-venue-data` / `idea-backlog` | `~/Library/Application Support/Claude/.../skills-plugin/.../skills/` | 追跡されていない |

**実害が出ている**: 2026-09-09 に `tournament-insight` へ工程5（決着した種目の OGP 画像生成）と
工程3の注意（照合の主語引き継ぎ）を足したが、これは**このマシンにしか無い**。
他のマシン・他の人・PR のレビューからは見えない。手順書としては
[tournament-insights.md](./tournament-insights.md) が「作業手順そのものは skill にある」と
明記しているので、参照先が版管理されていないことになる。

選択肢: (a) 全部 `.claude/skills/` へ移してリポジトリで版管理する、
(b) 個人 skill のままにして wiki 側に手順を寄せる、(c) 現状維持。**未判断**。

→ [raw/2026-09-09-tournament-og-image-as-routine-step.md](../raw/2026-09-09-tournament-og-image-as-routine-step.md)

## OGP画像の再生成がフォント環境に依存する（2026-09-09 追加）

`snslib.py` はフォントを `/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc` 等の
**システムパスから解決**する。そのため OS・ライブラリの更新でグリフの描画が変わり、
**データが1文字も変わっていなくても再生成すると別ハッシュ＝別ファイル**になる。

2026-09-09 の全件 `--apply` では **337枚中313枚**が差し替え対象になった。
画素差は 10.1%、ただし並べて見た内容（名前・スコア・線）は完全に同一。
このときは既存337枚を git から復元し、新規119枚だけを採用した。

決定的に再現したいならフォントをリポジトリに置くか生成をコンテナ化する必要があるが、
**現状そこまでの必要があるかは未判断**。当面は「全件再生成しない・足りないぶんだけ足す」で回る。

→ [raw/2026-09-09-tournament-og-image-as-routine-step.md](../raw/2026-09-09-tournament-og-image-as-routine-step.md)

## OGP画像が119件不足している（2026-09-09 追加 → 同日解決）

**解決**: 119枚を生成して索引を 337 → 456 件にした。決勝が確定している種目は
すべて OGP画像を持つ状態になった（未生成の20件は決勝が未確定で、既定の summary カードで正しい）。
内訳はインターハイ24・全中18・全日本社会人12・全日本シングルス8・全日本選手権8・
インカレ8（対抗戦2種目を含む）・中学の地区大会36・ほか。

以下は経緯の記録。

### 当時の状況


`tools/sns-images/tournament_og.py` の `--only` 無し実行が 2026-08-02 から
`TypeError` で壊れていた（同日修正）。直した直後の dry-run:

```
生成対象: 456 件 / 対象外（決勝が未確定）: 20 件
```

一方 `data/tournaments/og-images.json` は **337件**。
**決勝が確定しているのに OGP画像を持たない種目が119件**あり、既定の summary カードに
フォールバックしている。全件生成が回せない期間が長かったのが効いていると思われる。

着手するかの判断材料: PNG 119枚で概ね 5MB がコミットに乗る（128色パレット化で1枚≒45KB）。
既存337枚で12MB なので、リポジトリのサイズとしては同じ桁の増加。

```bash
npm run og:tournaments                      # dry-run で件数を確認
npm run og:tournaments -- --apply           # 全件生成（既存は内容ハッシュが同じなら同名で不変）
```

→ [raw/2026-09-09-tournament-og-image-as-routine-step.md](../raw/2026-09-09-tournament-og-image-as-routine-step.md)

## EEA/UK に対する Google 認定 CMP（2026-09-09 追加）

2026-09-09 に同意を地域で分け、日本はバナー非表示・EEA/UK/スイスは従来どおり事前同意、
という形にした（[ADR-018](../adr/ADR-018-consent-by-region.md)）。

このとき、**以前から未対応だった論点が輪郭のはっきりした形で残った**。AdSense を配信して
いる以上、Google の EU ユーザーの同意ポリシー上、EEA/UK の訪問者には **Google 認定 CMP**
（TCF v2.2 対応）が必要で、`src/components/CookieConsent.tsx` の自作バナーはこれを満たさない。

- 本決定で新たに生じた問題ではない（全ユーザーにバナーを出していた時点で既に同じ状態）。
- ただし今回で「バナーが残るのは EEA/UK/スイスだけ」と範囲がはっきりしたので、
  対応するなら区切りとしては良い。
- **未確認**: そもそも当サイトの EEA/UK からのトラフィックがどの程度あるのか（GA4 の
  地域レポートで確認できる）。ごく少数なら、認定 CMP を入れるより
  「EEA/UK には広告を出さない」ほうが安く済む可能性がある。まずここを測る。

関連: [monetization.md](./monetization.md)「プライバシー・法務」、
[raw/2026-09-09-consent-banner-japan-exemption.md](../raw/2026-09-09-consent-banner-japan-exemption.md)

## トップページのよく見られているページ（2026-09-14 追加）

GA4 の CSV を手で取り込む形で実装した（[public-pages.md](./public-pages.md)「トップページのよく見られているページ」）。

- ~~実物の GA4 CSV でまだ試していない~~ → 2026-09-14 に実物で取り込み、期間行の形の違いを直した
- **検索窓の入力が `page_view` として数えられている。** `/players/` の検索は 400ms ごとに `?q=` を shallow に
  書き換え、`_app.tsx` の `routeChangeComplete` がそのたびに `page_view` を送る。2026-08-17〜09-13 の表示回数の
  **36.6%（19,883 / 54,333）** がこれ。一方で `scripts/check-search-misses.mjs`（検索の取りこぼし調査）はこの
  `page_view` を入力にしているので、単に送るのをやめると検索語が取れなくなる。
  案: shallow な `?q=` 更新は `page_view` ではなく `search`（`search_term`）イベントで送る。回遊検証の数字との連続性も含めて要判断
- **選手ページの URL に `?q=` が付く経路が未特定。** 実物で `/players/4898/results/?q=...` が46回（中身は別の選手名を
  1文字ずつ入力したもの）。ローカルで「検索 → 結果ページ → 戻る」をたどっても URL は正しく、再現しない。
  トップページの集計では除外済み（`lib/popularPages.ts`）
- **週1の自動化（GA4 Data API ＋ GitHub Actions）をやるか。** 手動運用を試してから判断する（ユーザー判断 2026-09-14）。
  やる場合はサービスアカウント・数値のプロパティID・Secret が要り、このリポジトリで初めて外部 API の Secret を持つ。
  ADR を書くかもそのとき決める

経緯: [raw/2026-09-14-idea-top-popular-pages-ga4.md](../raw/2026-09-14-idea-top-popular-pages-ga4.md)

## アジア競技大会2026 の日程の抜けと、結果取り込み（方式A）の細部（2026-09-17 追加）

- **公式リザルトサイトに 9/19 の日程が無い。** 9/18 は団体A組の第2試合までしか載っておらず、9/19 は
  日付タブ自体が無い。団体B〜D組の残り試合がいつかは不明（2026-09-16 確認）。
  `schedule` は団体を「9/18〜20」の範囲で持ち、9/19 の有無は書いていない。公開され次第見直す
- **方式A（日本選手が出た試合だけ取り込む）で、成績（`results`）をどこまで入れるか。** ブラケットが部分的になるため、
  日本選手以外の成績は持たない想定（**Assumption**）。表示側が「全エントリーがある」前提で壊れないかは未確認
- **団体の予選リーグの順位表**は、日本の組の全試合（日本が出ない試合を含む）が無いと作れない。
  組の試合だけは方式Aの例外として全部持つか
- **方式B（全試合・外国選手も選手として持つ）をやるか**は会期後に判断する（ユーザー判断 2026-09-17）

経緯: [upcoming-tournaments-runbook.md](./upcoming-tournaments-runbook.md) S10・S11 /
[raw/2026-09-17-asian-games-schedule.md](../raw/2026-09-17-asian-games-schedule.md)

## 解決済み（記録）

解決した問いは本文から外し、結論と参照先だけをここに残す（2026-09-02 新設）。
「なぜそう決めたか」の詳細は各リンク先が正。

### インカレ団体戦の `tournamentId`（2026-08-29 追加 → 2026-09-17 解決を確認）

別IDは作らず、選手権と同じ `zennihon-university` の対抗戦カテゴリ `versus-none-{boys,girls}` として
2022〜2026年度が投入済みだった（2026-09-07「インカレ過去」で投入、抽出は `scripts/pdf/zennihon_university_results.py`）。
Open Question の側だけが更新されていなかった。→ [data-import.md](./data-import.md) /
[raw/2026-09-09-incare-2026-doubles-results-import.md](../raw/2026-09-09-incare-2026-doubles-results-import.md)

### Idea Backlog 索引の「一言サマリ」が長すぎる（2026-09-02 追加 → 2026-09-17 解決）

索引の責務は変えず、サマリの書き方を「アイデア名（状況）」だけに制限した（1アイデア40字・1行400字が目安、
状況が変わったら追記せず括弧の中を書き換える）。39KB → 6KB。索引にしか無かった情報は無いことを確認し、
エリアページ側の古い状況（中学・小学生カテゴリ）と抜け（AdSense手動枠・GA4人気ページ）を直した。
→ [idea-backlog.md](./idea-backlog.md)「使い方」/
[raw/2026-09-17-idea-backlog-index-cleanup.md](../raw/2026-09-17-idea-backlog-index-cleanup.md)

### 「全国大会」判定の二重基準（2026-07-20 追加 → 同日解決）

選手ページの「全国」判定は `lib/nationalTitles.ts` のホワイトリスト（22大会）に統一
（`ENGINE_VERSION` 1.4.0）。バッジ・SEO 文言・キャリア年表の「全国初出場/初優勝」がすべて同じ基準を使う。
東日本・西日本選手権（地域大会）が「全国初優勝」として年表に出る問題は解消。
**残る二重性は意図的**: ランキングの tier 判定は引き続き広義 `isNational`
（`generationId` が `international` / `international-qualifier` 以外）を使う。用途が
「表示上の事実表明」ではなく「大会格の重み付け」のため。
→ [players-pages.md](./players-pages.md)「全国大会優勝の実績表示」

### ブラケット復元と決勝Tの席順（2026-08-22 解決）

真因は「決勝Tの席をエントリー単位（`entries[].type`）で持っていたこと」で、席を**予選リーグの組**に
持たせる `knockoutDraw` を導入して解決。復元適用 285 → 372 大会・突合 26,527 → 27,633 試合で不一致0件。
入力ツール（`tools/index.html`）も保存時に `knockoutDraw` を出力する。
→ [ADR-015](../adr/ADR-015-knockout-draw-by-group.md) /
[調査メモ](../raw/2026-08-22-bracket-slot-parity-roundrobin-false-positive.md)。
積み残しは本文「予選リーグ→決勝Tのデータ表現（積み残し）」。

### アジア競技大会日本代表予選会2025 女子準決勝リーグ グループAの順位（2026-08-26 記録 → 同日解決）

正しい順位は **宮前1位 / 長谷川2位 / 左近3位 / 浪岡4位**（ユーザーより提供）。ゲーム差でも三すくみになり、
内部で得失点差による順位決定が行われた。`roundrobin.rank` を修正し（浪岡 2→4 / 長谷川 4→2）、
両グループとも上位2名が進出する形に整合。`npm run bracket:verify` は376大会・28,385試合が一致／不一致0件。
→ 経緯は [raw/2026-07-26-idea-tournament-metadata-platform.md](../raw/2026-07-26-idea-tournament-metadata-platform.md) 追記10

### STリーグ チームページのメンバー欠落（2026-08-11 緩和）

`participants.json` のロースター収録が年度・男女で偏るため22チームでメンバー表示が皆無だった件は、
大会成績側の選手を年度×性別で統合する実装により16チームで解消。残る6チームは大会データが無いか、
団体戦のチーム単位エントリーしか無く選手を拾えない（元データのロースター入力が進めば埋まる）。
→ [st-league.md](./st-league.md)「『メンバー』クエリの受け皿」

### 高校カテゴリのチーム名対応表を全大会へ広げるか（2026-07-17 → 2026-09-02 解決）

`--scope=all --dry-run` で648箇所あった未適用揺れは **0箇所**。全スコープ適用が進み、
`normalize-team-spacing.mjs` が `prebuild` の先頭ゲートに入ったため、新規取り込みの揺れも次のビルドで潰れる。

### highschool パイプラインの鮮度チェックの守備範囲（2026-09-02 解決）

`prebuild` のゲート `check-highschool-pipeline-freshness.mjs` のハッシュ対象が
`details/highschool*/` だけで、生成側の `02result/extract.py` が読む22大会のうち
**19大会がハッシュ対象外**だった（件数の主力は `zennihon-university` 4,308 /
`zennihon-workers` 3,642 / `zennihon-singles` 2,813 件）。全日本選手権や社会人を取り込んでも
チェックは緑のまま生成物が古くなる状態。

**対応**: 入力範囲の定義を `scripts/highschool/lib/pipeline-sources.json` に切り出し、
`extract.py`（除外リスト）と `lib/source-hash.mjs`（ハッシュ対象）が**同じファイルを読む**ようにした。
片方だけ育って気付けない、という再発の型を潰すのが狙い。
ハッシュ対象は **13大会・122ファイル → 32大会・292ファイル**（01team が読む `highschool*` と
02result が読む22大会の和集合）。

**副産物**: 広げた直後にチェックが落ちたのでパイプラインを再実行したところ、
`scripts/highschool/**` の中間生成物（`01team/teams.json` / `02result/results.json` /
`03list/prefecture-summary.json`）が**1コミットぶん古いまま残っていた**ことが分かった。
直前のコミットが `data/highschool/*`（サイトが読む側）だけを commit していたため。
再生成した中間生成物は `data/highschool/*` と完全一致したので、**公開データに誤りは無い**。

### `lib/matchAnalysis/` と `lib/growthAnalysis/` の責務境界（2026-08-12 解決）

「1試合の中 / 複数試合をまたぐ」で分割。→ [score-analysis.md](./score-analysis.md)「責務境界」
