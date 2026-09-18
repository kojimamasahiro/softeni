# Open Questions

> **適用範囲: 混在**（運用の問いは汎用、データの問いはソフトテニス固有）。
> **2026-09-18 に未解決の問いだけへ圧縮した。** 解決済みの記録・調査の経緯・実測値は
> [raw/2026-09-18-wiki-archive-open-questions.md](../raw/2026-09-18-wiki-archive-open-questions.md)。

このページは**未解決の問いだけ**を置く。**解決したものは本文から外し、上のアーカイブに送る**
（結論が他ページの仕様になるものは、そのページへ書いてからここを消す）。

## ドキュメント運用

- **`docs/sql/receive-order.sql` を本番 Supabase に適用したかが未確認**。未適用ならポイント入力の
  レシーブ選手自動推定が働かない（`games.initial_receive_player_index` が常に null）。
  確認して [APPLIED.md](../sql/APPLIED.md) に日付を入れる。
- **Compile Log の運用が定着しきっていない**（2026-08-13 以降の raw 36本中7本が未記入）。
  作業リスト型（teamId 目視・要確認リスト）は wiki へ載せるものが元々無い可能性が高いので、
  **「作業リスト型には Compile Log を求めない」と例外を書くか、「除外のみ1行」で必ず書かせるか**を決める。
- **選手の登録名変更（改名）の対応表が未実装**。`data/players/player-name-aliases.json` と
  `scripts/normalize-player-names.mjs`、林 湧太郎 → 林 佑太郎 の適用が残っている。
  設計は [team-player-identity.md](./team-player-identity.md)。
- **改称した大学を1校にまとめるか**（`神戸松蔭女子学院大学` / `神戸松蔭大学` 等）。どちらの表記も正しいので
  alias では寄せていない。`/teams/` 側は mapping で束ねたが、進路データ（出身高校一覧）側は未解決
  （[university.md](./university.md)）。
- **高校→大学の進路で氏名一致のみの採用が96%**。推定誤マッチ約20件を個別に特定する手段が無い。
  同じ高校から同じ大学へ複数人、などの相互裏付けで `basis` を細かくできるか。
- 2026-05-24 最終更新の4ページ（`backend.md` / `database.md` / `project-overview.md` / `score-analysis.md`）を
  「復元した初期メモ」から「現行仕様」へ昇格させるか、統合して Deprecated にするか。
  内容はほぼ正しく格付けだけが古いが、「内容は正しい」は無条件ではない（`prebuild` の段数がずれていた実例あり）。
- wiki → raw の参照が「バッククォートのパス表記」と Markdown リンクで混在し、到達性を機械チェックできない。
- 中断案件の「再開トリガー」を統一フォーマットで持たせるか（最初の適用先候補は `docs/ui/**` の M5＝トークン導入）。
- docs の lint（リンク切れ・孤立・Compile Log 欠落・ADR Status 記入漏れ）を CI 化するか。
  **2026-09-18 に `scripts/check-wiki-size.mjs` が文字数とリンク切れだけを見る形で入った**ので、これを育てるかも含めて判断する。

## 発展候補アイデア一覧（Idea Backlog・プロジェクト運用/メタ）

プロダクト機能でなく、開発・AI協働の進め方に関するアイデアはここに積む
（score 機能の機能アイデアは [score-general-availability.md](./score-general-availability.md)）。
表の「状況・目的」は**状況と1行の目的・残りだけ**（規則は [idea-backlog.md](./idea-backlog.md)）。

| アイデア | 状況・目的（1行） | 詳細 |
|---|---|---|
| AIが自律的にサービスを改善する仕組み | **方向決着・一部実装**（2026-09-06〜）。検知と検証をAIに任せ、方向の判断は人が持つ。CI と判断台帳まで実装。チーム名寄せは全件人手レビューへ（[ADR-019](../adr/ADR-019-team-merge-human-only.md)） | [アイデア](../raw/2026-09-06-idea-autonomous-improvement-agent.md) |
| AIとの共同探索と探索プロセスの属人性 | 発散フェーズ・中断中（2026-07-11）。**再開は raw 末尾の「再開ポイント」から** | [アイデア](../raw/2026-07-11-idea-ai-co-exploration-context.md) |
| skillのローカルLLM代替（Claude不在時） | **一部実装**（2026-08-14〜）。venue-data・pdf-to-players は実装済み。本命の insight は照合の網の拡張が先。モデル選定は保留 | [アイデア](../raw/2026-08-14-idea-local-llm-skill-replacement.md) |
| wiki の圧縮（読み込みコストの削減） | **完了**（2026-09-18）。全38ページが1ページ12,000字以内（合計47万字→27万字）。以後は `node scripts/check-wiki-size.mjs` を守る（手順は [slim-wiki-page.md](../prompts/slim-wiki-page.md)） | [作業ノート](../raw/2026-09-18-wiki-slimming.md) |

## データの整合・名寄せ

- **ダブルスのペアの境界ずれ**（`林楓|恋荒` ＋ `川|琴美` → `林|楓恋` ＋ `荒川|琴美`）を拾う検出器が無い。
  検出器A（分割衝突）・B（辞書照合）のどちらにも掛からない。
  「同一エントリー内の2人の氏名を連結し直し、別の切り方なら双方が辞書に当たるか」で検出できるはず。
  なお A・B 自体は 0 件で、`check-name-splits.mjs --strict` は prebuild のゲートに入っている。
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
  対応表は大会・年度に依存しない構造で、追記すればハッシュが変わり prebuild が自動でフル再計算する。
- **同姓同名の人物別 id 分離は「当面は融合を許容」で決定**（2026-07-02）。緩和策（H2H/ペアを `playerKey` で分離、
  self-vs-self のスキップ、`homonymRisk` 注記）のみ実装済み。人物別 id の払い出しは、実害が顕在化した段階で再検討。

## 大会データ

- **2段リーグ形式（予選リーグ→準決勝リーグ→優勝決定戦）の2段目の順位が記録されない**。`results[].roundrobin` は
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
  インターハイの他年度（2023〜2026 は男女とも投入済み。2022年以前は様式未確認）/
  **ゲームの成立検査（4点先取・デュースは2点差・3-3 の第7ゲームは7点先取）を
  `check-team-match-details.mjs` に入れるか**——入れると 2023 女子の出典の誤記 `4 － ⑦` で
  落ちるので許可リストが要る（[経緯](../raw/2026-09-19-interhigh-2023-girls-team-match-order.md)）/
  **ゲームごとのポイント（`games`）の見せ方** / 打ち切り時点の途中のゲームを持つか（今は落としている）/
  高校選抜の他年度（2020・2023・2024 は出典が JSTA 以外）/ 学校名の表記違いで結び付かない選手。
- **アジア競技大会2026 の取り込み**（[upcoming-tournaments-runbook.md](./upcoming-tournaments-runbook.md) S11）:
  個人種目で方式B（全試合・外国選手も選手として持つ）をやるかは会期後に判断。
  団体戦の範囲と決勝Tの持ち方は 2026-09-18 に決着（団体は全組・決勝Tも全部持つ）。

## 検査・パイプライン

- **`verify-facts-golden.ts` の golden は `analysis.json` そのもの**なので、データが増えると DIFF が出る。
  再生成された `analysis.json` をコミットすれば green になり、**実際そういう運用になっている**。
  残る判断は「この運用を明文化して終わりにするか、差分しきい値方式へ作り替えるか」の1点。
  なお `playerstats:verify` は prebuild に入っていないのでビルドは落ちない。
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
- **EEA/UK に対する Google 認定 CMP**。AdSense を配信している以上 TCF v2.2 対応の認定 CMP が必要で、自作バナーは満たさない。
  **まず GA4 で EEA/UK のトラフィック量を測る**——ごく少数なら「EEA/UK には広告を出さない」ほうが安い可能性がある
  （[monetization.md](./monetization.md)）。
- **OGP画像の再生成がフォント環境に依存する**（システムフォントを解決するため、データが同じでも別ハッシュになる）。
  決定的に再現するならフォントを同梱するかコンテナ化が要るが、**当面は「全件再生成しない・足りないぶんだけ足す」で回る**。

## score 機能

- **正式な source of truth は Supabase か生成済み JSON か。**
- **死んだ値を型から落とすか**（`matches.status` の `archived`、`processing_status` の `ready` / `processing` は読み書き0箇所）。
- **`result_type` の集合が3箇所に重複定義**されている（`lib/matchLogic.ts` / `lib/matchAnalysis/helpers.ts` /
  `src/pages/beta/matches-results/[matchId]/index.tsx`）。`forced_error` / `unforced_error` を含むかが箇所ごとに違う。
- Supabase の `edit_token` 列をいつ落とすか（落とすなら `docs/sql/` に DDL と [APPLIED.md](../sql/APPLIED.md) の行が要る）。
- **公開/編集権限**（ADR-003 の方針は決定済み）: `visibility` の正式 enum と限定公開の表現 / 認証方式 /
  UGC のモデレーション運用 / `score` mode 以外での API 書き込み制御。
- **公開面・ドメイン分離**: score 側のヘッダー/フッターやブランド表現を分ける正式方針 /
  Phase 2 で UGC 本拠地へ転換する際の既存 score mode ラッパとの整合。
- **成長分析の公開境界**（[ADR-004](../adr/ADR-004-growth-analysis-visibility-consent.md)）: A1 特定グループ限定のアクセス制御方式 /
  A2 撤回の反映タイミングと緊急削除経路 / P1 実名の全体公開を採る場合の同意設計 / P2 `growth_consent` と認証アカウントの統合。
  **再検討トリガーはコンテンツ拡大とユーザー反響。**
- **score 機能の一般公開・ピボット**（[score-general-availability.md](./score-general-availability.md)）: 差別化の核をどれにするか /
  個人かチームか / 顧問・選手への聞き取り検証 / パイロット相関分析の母数拡大後の再検証。
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
- **STリーグ**: Ⅲ部は対戦データを持たない方針（`hasMatchData: false`）/ Ⅱ部女子の順位決定戦・選手別データが未入力
  （公式PDFに選手名簿が無い）/ **結果を `details/` にも入れるか**（入れると Player Statistics Engine に乗るが、
  tie の内訳が落ち・カニバり・順位が二重管理になる。選手DB連携が主目的になった時点で再判断）/
  `promotionRelegation` の裏取り。詳細は [st-league.md](./st-league.md)。
- **地域大会ページ**: `local_index.json` の `officialUrl` を UI で使うか / 大会カードの並び順を明示ソートするか /
  `areaId: "city"` の大会を都道府県ページから分離するか。
- **分析ロジック**: 指標の採用基準 / 研究・現場知見の裏付けをどこまで持たせるか / 成長分析 JSON の更新タイミングと担当。
- **データ生成運用**: tournament details 生成の正式手順 / players 生成の最終入力源 / 手動補正のルールと履歴の置き場所。
