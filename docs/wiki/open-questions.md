# Open Questions

> **適用範囲: 混在**（運用の問いは汎用、データの問いはソフトテニス固有）。
> **2026-09-18 に未解決の問いだけへ圧縮した。** 解決済みの記録・調査の経緯・実測値は
> [raw/2026-09-18-wiki-archive-open-questions.md](../raw/2026-09-18-wiki-archive-open-questions.md)。

このページは**未解決の問いだけ**を置く。**解決したものは本文から外し、上のアーカイブに送る**
（結論が他ページの仕様になるものは、そのページへ書いてからここを消す）。

**wiki の未解決の問いはここだけに書く**（2026-09-30〜）。各ページの `## Open Questions` 節はここへのリンク1行だけ
（2か所に書くと解決時に片方が取り残される。[raw](../raw/2026-09-30-llm-wiki-lint.md)）。

## ドキュメント運用

- **選手の登録名変更（改名）の対応表が未実装**。`data/players/player-name-aliases.json` と
  `scripts/normalize-player-names.mjs`、林 湧太郎 → 林 佑太郎 の適用が残っている。
  設計は [team-player-identity.md](./team-player-identity.md)。
- **改称した大学を1校にまとめるか**（`神戸松蔭女子学院大学` / `神戸松蔭大学` 等）。どちらの表記も正しいので
  alias では寄せていない。`/teams/` 側は mapping で束ねたが、進路データ（出身高校一覧）側は未解決
  （[university.md](./university.md)）。
- **高校→大学の進路で氏名一致のみの採用が96%**。推定誤マッチ約20件を個別に特定する手段が無い。
  同じ高校から同じ大学へ複数人、などの相互裏付けで `basis` を細かくできるか。
- wiki → raw の参照が「バッククォートのパス表記」と Markdown リンクで混在し、到達性を機械チェックできない。
- 中断案件の「再開トリガー」を統一フォーマットで持たせるか（最初の適用先候補は `docs/ui/**` の M5＝トークン導入）。
- `npm run check:wiki` の報告のみの項目（文字数・適用範囲・孤立・ADR Status・Compile Log）を**ゲートに上げるか**
  （リンク切れと SQL 台帳の漏れは既にゲート。[raw](../raw/2026-09-19-docs-layer-cleanup.md)）。

## 発展候補アイデア一覧（Idea Backlog・プロジェクト運用/メタ）

プロダクト機能でなく、開発・AI協働の進め方に関するアイデアはここに積む
（score 機能の機能アイデアは [score-general-availability.md](./score-general-availability.md)）。
表の「状況・目的」は**状況と1行の目的・残りだけ**（規則は [idea-backlog.md](./idea-backlog.md)）。

| アイデア | 状況・目的（1行） | 詳細 |
|---|---|---|
| AIが自律的にサービスを改善する仕組み | **方向決着・一部実装**（2026-09-06〜）。検知と検証をAIに任せ、方向の判断は人が持つ。CI と判断台帳まで実装。チーム名寄せは全件人手レビューへ（[ADR-019](../adr/ADR-019-team-merge-human-only.md)） | [アイデア](../raw/2026-09-06-idea-autonomous-improvement-agent.md) |
| AIとの共同探索と探索プロセスの属人性 | 発散フェーズ・中断中（2026-07-11）。**再開は raw 末尾の「再開ポイント」から** | [アイデア](../raw/2026-07-11-idea-ai-co-exploration-context.md) |
| skillのローカルLLM代替（Claude不在時） | **一部実装**（2026-08-14〜）。venue-data・pdf-to-players は実装済み。本命の insight は照合の網の拡張が先。モデル選定は保留 | [アイデア](../raw/2026-08-14-idea-local-llm-skill-replacement.md) |
| wiki の圧縮（読み込みコストの削減） | **完了**（2026-09-18）。全38ページを圧縮（47万字→27万字）。以後は超過したページを [slim-wiki-page.md](../prompts/slim-wiki-page.md) で圧縮 | [作業ノート](../raw/2026-09-18-wiki-slimming.md) |

## データの整合・名寄せ

- **ダブルスのペアの境界ずれ**（`林楓|恋荒` ＋ `川|琴美` → `林|楓恋` ＋ `荒川|琴美`）を拾う検出器が無い。
  検出器A（分割衝突）・B（辞書照合）のどちらにも掛からない。
  「同一エントリー内の2人の氏名を連結し直し、別の切り方なら双方が辞書に当たるか」で検出できるはず。
- **インターハイ2012 男子ダブルス・埼玉県の `春日部` がどの高校か未確定**（春日部/春日部東/春日部工業 等）。
  当時の出場者は吉水悠・中村匡貴。`春日部クラブ`（社会人）へ誤って寄らないよう alias に `scope` を付けてある。
- **選手共有シグナルで挙がった104クラスタのレビュー**（[ADR-017](../adr/ADR-017-team-merge-signal-player-overlap.md)）が全件人手判断待ち。
  うち一部は表記揺れではなく**取り込み時の誤字**（`きのくに宿用金庫` 等）で、alias ではなく**元データの修正**が要る。
- `inferred-team-aliases.json`（高校パイプライン）と `team-player-overlap.mjs`（本体）が**同じ規則の二重実装**。どちらに寄せるか。
- **`normalize-team-names.mjs` の既定スコープが `highschool-japan-cup` のまま**。既定で流すと HJC しか直らない。
  既定を `all` にするか prebuild に組み込むか（`normalize-team-spacing.mjs` は既に prebuild の先頭にある）。
- 高校カテゴリの学校名表記揺れは「同年度・同姓同名選手が別学校名で出たら同一校に寄せる」暫定ルールで、**誤結合を許容している**。
  `scripts/highschool/03list/inferred-team-aliases.json` の確認頻度と手動補正ルールの置き場所も未決。
- **国際大会（ローマ字表記）の選手同定**: 対応表 `data/tournaments/participant-aliases.json` は
  curated slug との完全一致で拾えた分だけ登録済み（コリアカップ2026は63名中27名）。残りは漢字が判明次第追記する。
- **同姓同名の人物別 id の払い出し**（当面は融合を許容。[players-pages.md](./players-pages.md)）。実害が出た段階で再検討。

## 大会データ

- **2段リーグ形式の2段目（準決勝リーグ）の順位が記録されない**。`results[].roundrobin` は
  組を1つしか持てない。段ごとの配列にするかは、この形式が現状1大会だけなので保留。
- **開催前・進行中の大会で未確定席をどう見せるか**（「A組1位」と書くか空欄か）。現状は空席として描かれる。
- **予選リーグ大会に残っている `entries[].type` を消すか**。投入ツールが書き続けるので放置すると増える。
  `lib/bracketLayout.ts` は今も `type` から席順を組むため「読まれていない」わけではなく、
  **予選リーグ側の `type` を消せば「全件 `packing` かつ2冪」への防御コードも不要になる**。
- **`highschool-championship/2013/doubles-none-boys` の entryNo 136 の組が誰か分からない**（同じ `playerIds` が
  136 と 277 の2席にある）。元資料が無いと復元できず、このままだとこの組の2013年の成績が二重計上される。
  Assumption: 誤っているのは 136 の側。
- **同種の異常が他に3件ある**（`entries[].playerIds` の重複1件、`nextMatchId` の先に勝者が居ない2件）。
  どの検出器にも入っていないので次に起きても気付けない。ルール化するかは未決定。
- **`tournament_results_common.check()` が入力ツール経路に掛かっていない**（Python の PDF パイプラインでしか走らない）。
  `validate-entries.js` 側へ移すか、全データ走査の検出器を足すか。
- **入力ツールが本戦前の「予選」形式（`type: 'preliminary'`）を出力できない**。既存データでは1件だけなので保留。
- **`location` の検算は2024年度以降しかできない**（jsta の日程一覧が2024年度以降のため）。2023年以前は未検算（Assumption）。
  検算スクリプトを常設するかも未決。
- **`surface` の実在値と [data-model.md](./data-model.md) の語彙が食い違う**。実在は `砂入り人工芝` / `人工クレー` / `クレー` の3種で、
  語彙にある `ハード` と `木床フローリング` は1件も無い。`人工クレー` を寄せるか語彙に足すかを決める。
- **全日本学生選抜インドア**: 第59回(2025)の会場が特定できず `location` が空。
  2023年以前は PDF のレイアウトが違う可能性があり、`scripts/pdf/university_indoor.py` の座標前提を年度ごとに確認してから取り込む。
- **団体戦の対戦ごとの記録（オーダー）の残り**（[ADR-020](../adr/ADR-020-team-match-rubber-details.md)）:
  インターハイ2021年以前（様式未確認。2020 は中止）/
  **ゲームの成立検査（4点先取・デュースは2点差・3-3 の第7ゲームは7点先取）を
  `check-team-match-details.mjs` に入れるか**——入れると**出典の誤記3件**
  （2023 女子 `4 － ⑦`、[2022 男子 `3 － ⑦` `2 － ⑤`](../raw/2026-09-19-interhigh-2022-team-match-order.md)）
  で落ちるので許可リストが要る（今は取り込みのたびに手で確認）/
  **2022 男子 3回戦 東北-浜田 の `retired: true` が正しいか**——PDFは通常の打ち切り、
  チャートの `R` は昌平の2回戦だけ。誤りなら東北の勝ちと浜田の負けが勝率から抜ける
  （[経緯](../raw/2026-09-19-interhigh-2022-team-match-order.md)）/
  **ゲームごとのポイント（`games`）の見せ方** / 打ち切り時点の途中のゲームを持つか（今は落としている）/
  高校選抜の他年度（2020・2023・2024 は出典が JSTA 以外）/ 学校名の表記違いで結び付かない選手。
- **アジア競技大会2026 の取り込み**（[upcoming-tournaments-runbook.md](./upcoming-tournaments-runbook.md) S11）:
  範囲は決着（5種目すべて全組・全試合）。残るのは**外国選手が勝敗を持った後の扱い**（選手ページ・名寄せ・
  `data/players/index.json`。9/21 の混合ダブルスから実際に持ち始めた）を会期後に見直すこと。

## 検査・パイプライン

- **`verify-facts-golden.ts` の golden は `analysis.json` そのもの**なので、データが増えると DIFF が出る。
  再生成された `analysis.json` をコミットすれば green になり、**実際そういう運用になっている**。
  残る判断は「この運用を明文化して終わりにするか、差分しきい値方式へ作り替えるか」の1点。
- **`check-highschool-pipeline-freshness.mjs` は元データのハッシュしか見ない**ので、`scripts/highschool/**` の
  python を直しても反応しない。スクリプトの内容も混ぜると「コメントを直しただけで赤くなる」ノイズが増える。未決定。
- **milestone の不変条件を機械チェックするか**。`nth-title` の `gapYears === 1` は定義上ありえない（実際に5件出て修正済み）。
  候補: `nth-title` は `gapYears >= 2` / 同一選手に `repeat-title` と `first-title` が同時に出ない / `repeat-title` の `since < year`。
  全エディション総当たりで数秒なので CI に載せられる。併せて `lib/milestones.ts` にテストが1本も無い。

## SEO・公開面

- **大会の略称マスタが3つに分かれている**（`index.json` の `searchLabel`/`searchAliases` / 高校全国大会の
  `highschoolNationalTournamentMeta.ts` / 優勝判定用の `nationalTitles.ts`）。対象集合が違うので分けたが、
  **実害が出はじめている**（`/news/highschool-championship-2026/` の title に「インターハイ」literal が無い）。
  選択肢: (a) 高校大会にも `index.json` 側を入れて二重管理 (b) 高校マスタを `index.json` へ寄せる (c) news ルートだけ両方引く。**未判断**。
- **汎用ハブへの「開催中モード」移植**（[seo.md](./seo.md) #11）。インカレ・全中・全日本選手権など汎用ルートの大会は
  会期中インテントへの切替が効かない。期限は次に会期を迎える汎用ルートの大会の前。
- **トップページのよく見られているページ**（GA4 の CSV を手で取り込む運用）:
  - **検索窓の入力が `page_view` として数えられている**（表示回数の36.6%）。単に送るのをやめると
    `check-search-misses.mjs` が検索語を取れなくなる。案は shallow な `?q=` 更新を `search` イベントで送ること。要判断。
  - **選手ページの URL に `?q=` が付く経路が未特定**（集計では除外済み）。
  - **週1の自動化（GA4 Data API ＋ GitHub Actions）をやるか**。やる場合はこのリポジトリで初めて外部 API の Secret を持つ。
- **GA4 の拡張計測「ブラウザの履歴イベントに基づくページの変更」をオフにしたかが未確認**。
  オンのままだと SPA 遷移ごとに page_view が2回出る（手動送信と自動送信）。コードは手動送信だけで足りる前提
  （[monetization.md](./monetization.md)「計測（GA4）」）。オフにしたら DebugView で確認して消し、上の36.6%（二重計上を含む）を測り直す。
- **OGP画像の再生成がフォント環境に依存する**（システムフォントを解決するため、データが同じでも別ハッシュになる）。
  フォント同梱かコンテナ化で直せるが、**当面は「全件再生成しない・足りないぶんだけ足す」で回る**。
- OGP 文言・サイト名の正式運用ルール（[public-pages.md](./public-pages.md)）。
- 高校カテゴリの注目校表示ロジックを手動編集可能にするか。
- **SEO 施策の効果測定**（番号は [seo.md](./seo.md) の施策番号）:
  - #3 集中先（高校歴代ページ）が対象クエリで上位を取れているか。分散なしは 2026-08-15 に確認、順位は未計測
    （[M4検証ランブック](./highschool-seo-m4-verification.md)）。
  - #3 内部リンク振り替えでほぼ孤立した汎用ハブ（被リンク約25枚）を noindex のまま残す意味があるか。
  - #7 高校メンバー系クエリの受け皿を学校ページに一本化すべきか。
  - #8 301 後の評価移行と、展望記事×ハブの棲み分けが GSC で確認できるか。
  - #11 会期中の日次更新が実際にクロールされ、「{通称}{年}」系で表示を取れたか。1日1回ビルドの運用コスト
    （会期中だけ差分ビルドにできるか）。
  - #15 オーダーの literal と FAQ が「{大会}{年} オーダー」「{学校名} メンバー {年}」で表示を取れたか（未計測）。

## 収益化・計測

[monetization.md](./monetization.md) の未決。

- 手動枠の合否閾値が暫定値（CLS 0.1 / 推定収益 / 回遊20%）。1面目の実測でベースラインに差し替える。
- アフィリエイトを再開するか（コードは削除済み）。
- `app-ads.txt` の対象アプリと Web 本体の関係。
- lazyOnload 化のあと `#418` / `no_div` が本番で解消したかのモニタリング（ローカルでは再現できない）。

## ビルド・デプロイ

[deployment.md](./deployment.md) の未決。

- webpack compile（約1分45秒）を Turbopack で短縮できるか（未検証）。
- nft の走査が CF 実機でどれだけのコストか（ローカル計測のみ）。

## score 機能

- **正式な source of truth は Supabase か生成済み JSON か。**
- **Supabase の RLS の有無とポリシー**、index・trigger・constraint の全体像（コードから読めない。[database.md](./database.md)）。
- **公開用 `matchId`（UUID）を恒久的にそのまま URL に使うか**（[score-feature.md](./score-feature.md)）。
- **死んだ値を型から落とすか**（`matches.status` の `archived`、`processing_status` の `ready` / `processing` は読み書き0箇所）。
- **`result_type` の集合が3箇所に重複定義**されている（`lib/matchLogic.ts` / `lib/matchAnalysis/helpers.ts` /
  `src/pages/beta/matches-results/[matchId]/index.tsx`）。`forced_error` / `unforced_error` を含むかが箇所ごとに違う。
- Supabase の `edit_token` 列をいつ落とすか（落とすなら `docs/sql/` に DDL と [APPLIED.md](../sql/APPLIED.md) の行が要る）。
- **公開/編集権限**（ADR-003 の方針は決定済み）: `visibility` の正式 enum と限定公開の表現 / 認証方式 /
  UGC のモデレーション運用 / `score` mode 以外での API 書き込み制御。
- **公開面・ドメイン分離**（方針は ADR-003 で決着、ツール公開側の具体が未着手）: score 側のヘッダー/フッター・ナビを
  記録の道具としてどう作るか（再利用できるのは `PublicMatchDetailPage` と分析ロジック）/ 2ドメインを同じビルド成果物で配るか別 build か /
  Phase 2 で UGC 本拠地へ転換する際の既存 score mode ラッパとの整合 / 書き込み経路と認可。
- **成長分析の公開境界**（[ADR-004](../adr/ADR-004-growth-analysis-visibility-consent.md)）: A1 特定グループ限定のアクセス制御方式 /
  A2 撤回の反映タイミングと緊急削除経路 / P1 実名の全体公開を採る場合の同意設計 / P2 `growth_consent` と認証アカウントの統合。
  **再検討トリガーはコンテンツ拡大とユーザー反響。**
- **score 機能の一般公開・ピボット**（[score-general-availability.md](./score-general-availability.md)。差別化の核は
  2026-08-03 に「重要局面別の分析エンジン」で決着）: 個人選手かチーム/クラブ単位か / 顧問・選手への聞き取り検証 / パイロット相関分析の母数拡大後の再検証（ブレークポイント非対称性・ラリー長効果・1stサーブフォルト無影響の再現性）。
- **YouTube / 動画レビュー**: 保存方式と正式運用ルール / `match_video_sessions` / `match_point_candidates` の本番利用状況 /
  レビュー候補を誰がどの手順で確定するか。
- **Elo レーティングの公開面の設計**: 未成年の実名で「負けると下がる数字」を出すかの感度整理。当面は内部利用に留める（2026-07-11 決定）。
  `data/ratings/current.json` の更新運用（現状は details 追加時に手動で `ratings:generate`）も未決。
- **lucent-tokyo-indoor / yonex-hokkaido-international を `index.json` に掲載するか**（`tierOverrides` は非掲載でも効く）。

## 各ページに紐づくもの

- **試合詳細の beta 昇格**（実装済み）の残り: 野良試合に後から `siteLink` を付けて昇格させる導線を作るか /
  **[score-site-link.md](./score-site-link.md) がドラフトの文体のまま**（現状仕様として書き直すか、設計ドラフトと明示するか）。
- **選手結果ページ「スコア詳細のある試合」を大会結果の該当カードに統合するか**。
  `ScoreMatchLink.matchId` に対応する結合キーが `PlayerMatch` に無く、新規 join の実装が要る（[players-pages.md](./players-pages.md)）。
- **STリーグ**: Ⅱ部女子の順位決定戦・選手別データが未入力
  （公式PDFに選手名簿が無い）/ **結果を `details/` にも入れるか**（入れると Player Statistics Engine に乗るが、
  tie の内訳が落ち・カニバり・順位が二重管理になる。選手DB連携が主目的になった時点で再判断）/
  `promotionRelegation` の裏取り / Ⅱ部女子2025の開催日は男子Ⅱ部に合わせた仮置き（2025-12-11、Assumption）/
  女子Ⅱ部の他年度（2023・2024）と2026以降は未入力 / NTT西日本の連覇数など個別記録の裏取り。
  詳細は [st-league.md](./st-league.md)。
- **地域大会ページ**: `local_index.json` の `officialUrl` を UI で使うか / 大会カードの並び順を明示ソートするか /
  `areaId: "city"` の大会を都道府県ページから分離するか。
- **分析ロジック**（[score-analysis.md](./score-analysis.md)）: 指標の採用基準 / 研究・現場知見の裏付けをどこまで持たせるか /
  成長分析 JSON の更新タイミングと担当。
- **データ生成運用**（[data-import.md](./data-import.md)）: tournament details 生成の正式手順 / players 生成の最終入力源 /
  どこまでが自動生成でどこからが手修正か、手動補正のルールと履歴の置き場所。
- **ニュースの文脈ブロック**（[news-context-blocks.md](./news-context-blocks.md)）: 根はどれも同一人物の同定。
  `head-to-head` の導入可否（**ペア単位なら現在の名寄せ水準でも安全**、危険なのは選手単位に降ろしたときと世代を跨いだとき。
  粒度ごとに解禁できる）/ 世代をまたいだ選手照合の解禁条件（目安は `homonyms.json` が id 分割として選手解決に統合されること）/
  未実装 milestone（`best4-first` / `career-wins` / `first-appearance`）の語彙確定。
- **希少イベント**（[rare-events.md](./rare-events.md)）: 大会結果ページ・大会ハブへの差し込み（P2。milestone 系と「名場面」欄を統合するか）/
  サイト記録一覧の indexable 昇格（昇格時は seo.md の重複マップを確認）/ 記録更新履歴の永続化（`rare-events.json` は上書き生成）/
  scope 拡張（`season` / `all-time`）の時期（P3、反響次第）/ `shot_type` / `shot_course` が記録されたときのカテゴリ拡充 /
  前衛・後衛ロールの記録（「後衛のスマッシュ」等はこれ待ち）/ 発見ハーネスの期待値をサブパターン条件付き確率にするか /
  配信元（大会主催者・配信者）への事前一声の運用ルール化。
- **SNS ストーリー基盤**（[sns-story-platform.md](./sns-story-platform.md)。5分類ストーリーの範囲は 2026-08-01 に決着）:
  基盤全体として抽出ロジックを既存と統合するか / 評価情報のうち季節性・話題性・保存価値の算出（希少性は実測頻度で代替）/
  JSON/YAML のスキーマ全体 / 媒体別テンプレと投稿頻度 / 高校・中学カテゴリの供給不足（高校14組中3組が0件。
  検出網を広げるか一般カテゴリに集中するか）。
