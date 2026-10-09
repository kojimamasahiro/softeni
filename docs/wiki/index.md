---
type: index
scope: 汎用
status: current
summary: "wiki の入口。全ページを type 別に並べた説明つきの一覧。npm run wiki:index で生成する"
---
<!-- 生成物。npm run wiki:index で作り直す（手で直さない。コンフリクトしたら作り直す）。元は各ページ先頭の frontmatter。設計は ADR-024。 -->
# Wiki Index

> **適用範囲: 汎用**。この wiki の入口。

Softeni Pick の現在の仕様・設計・運用の一覧。各行の説明は、そのページ先頭の frontmatter の `summary`。

読み方:

1. **意図で選ぶ** — 下の一覧から説明で選ぶ。
2. **触るコードで選ぶ（補助）** — `npm run wiki:for -- <パス>` で、そのパスを `code:` に持つページと、本文でそのパスに触れているページを引く。
3. **語で選ぶ** — `grep -rn "<語>" docs/wiki`。
4. 選んだページは全文を読む。「なぜ」が要るときだけ [ADR](../adr/README.md)、証拠が要るときだけ [raw](../raw/README.md)。

印: `汎用` どの競技でも使える／`学校` 日本の学校スポーツに共通／`固有` ソフトテニス固有／`混在` 節によって違う
（背景は [raw/2026-09-18-idea-multi-sport-expansion.md](../raw/2026-09-18-idea-multi-sport-expansion.md)）。
`draft` は検討中で未確定、`deprecated` は古くなった記述。

## overview — 全体の構成と基盤

- [Android](./android.md) `汎用` — Android アプリの実装はこのリポジトリに無い。無関係な別アプリ AdInsight の紹介・法務サイトを adinsight.softeni-pick.com で間借りしている（Play 登録済みのパスは変えない）
- [Architecture](./architecture.md) `汎用` — Next.js Pages Router＋静的データ＋一部 Supabase の全体構成（フロント・score 公開ページ・データ層・API 層・生成スクリプト・デプロイ）と、hydration を避けるレンダリングの決定性の規則
- [Backend](./backend.md) `汎用` — 本番にサーバーは無い（静的 export）という実行モデル。試合データ・動画レビューの API はローカル開発時だけ動く。静的 JSON 配信、モード切替、認可（ユーザー認証なし）
- [Deployment](./deployment.md) `汎用` — 静的 export の Cloudflare Pages ビルド設定と prebuild のゲート、GitHub Actions のゲートと報告の分け、ビルド時間の守ること、ビルドキャッシュ。動的機能の選択肢は未実装の検討
- [Project Overview](./project-overview.md) `固有` — サイト全体の地図。本体サイトの主要領域（大会・選手・チーム・高校・ランキング・STリーグ・ニュース）と score 系機能の導線を示し、詳細は各ページへ案内する

## entity — データの対象（定義・識別子・置き場）

- [Data Model](./data-model.md) `混在` — 静的 JSON と Supabase の2系統のうち、どのファイルが何の正か。大会情報の拡張（代表名簿・競技日程・競技方式・中止・会場）の規約、入力メモ note を公開しない規則、選手名・団体戦の表示と団体戦オーダーの持ち方
- [Database](./database.md) `固有` — score 機能の Supabase テーブル（matches・games・points と動画レビュー用の2つ）の列とリレーション。スキーマ全体の定義は repo に無く、型と差分 DDL から復元した推定
- [大会データ JSON の構造（リファレンス）](./tournament-data-structure.md) `混在` — data/tournaments/** の JSON の構成・フィールド・語彙のリファレンス。カテゴリID・参加者IDの命名規約、rank.kind、entries[].type（ドローの席）の判定規約、打ち切りの語彙。型の正は src/types/tournament.ts

## concept — 規則・判定のしかた

- [選手の名寄せと識別（氏名）](./player-name-identity.md) `混在` — 選手を氏名で一意に識別する規則。姓名の分割ゆれ、別人判定、pid の4区切り、改名の対応表（設計のみ）
- [ランキング仕様](./ranking.md) `混在` — 年度ランキング（シーズンポイント制）の現行仕様。計算式（tier重み×順位係数、上位3大会を合算）、除外・特殊ルール、パイプライン、バックテストでの較正、内部利用の Elo 副指標と金星（giant-killing）検知
- [SEO カニバリゼーション / 重複制御](./seo.md) `混在` — ページ種別の間で検索語が重なるカニバリの制御ルール。重複マップ、title の字数予算、構造化データ、sitemap の運用
- [チーム・選手の名寄せと識別](./team-player-identity.md) `混在` — チーム名・都道府県の正準化と名寄せの運用、チームの一意な識別。機械は提案まで、統合は人が決める
- [TournamentBracket ロジック概要](./tournament-bracket-logic.md) `汎用` — 試合のつながり（nextMatchId）を決勝から逆にたどり、表示用のトーナメント表を組み立てる TournamentBracket のロジック。開催前の席順復元（lib/bracketLayout.ts）は別物
- [UX Writing（UI文言ルール）](./ux-writing.md) `汎用` — 公開ページの日本語 UI 文言のルール。文体、句点、記号、用語、空状態、注記、リンクテキスト

## feature — 機能・ページ群の仕様

- [beta/matches-results / score 公開 保守ガイド](./beta-matches-results.md) `混在` — score 公開面（/beta/matches-results・/matches）の保守ガイド。1つのコアを2モードで使う構成、ルーティング、公開 JSON の生成と除外項目、ラリー共有リンク、埋め込み動画の規則、改修時の確認箇所。score モードの公開面は未デプロイで、一部は当時のまま
- [Highschool Pages（高校カテゴリ）](./highschool.md) `学校` — 高校カテゴリの公開ページ方針と現行仕様。学校ページ（年度別メンバー・主な卒業生）、全国大会の歴代記録、開催中の全国大会の表示、強豪校ランキング
- [Monetization](./monetization.md) `汎用` — 収益化の現行仕様。AdSense の読み込みと手動広告枠、GA4 の計測、プライバシー・法務。アフィリエイトは使っていない
- [文脈ブロック / 速報・プレビュー機能](./news-context-blocks.md) `混在` — 速報・プレビュー記事を、決定的に出せる文脈ブロックから組む機能。設計原則と実装状況、milestone の判定規約、プレビュー記事の6ブロックと照合規約、直近の対戦（priorMeetings）、ブラケット復元
- [Players Pages（選手ページ）](./players-pages.md) `混在` — 選手ページの現行仕様。slug 系と id 系の URL の2系統、選手一覧、結果ページの表示、SEO（noindex 選別・所属歴）、選手統計エンジンと集計ルール、勲章カードと全国大会優勝 SEO、セクション階層
- [Primary School Pages（小学生カテゴリ）](./primaryschool.md) `学校` — 小学生カテゴリ（/primaryschool）の仕様。「小学校」と呼ばない、対象は全日本小学生選手権だけ、性別を URL に入れない、teamId（地名部分の読みの上書き）、都道府県の全国大会成績、進路（小→中）
- [Public Pages](./public-pages.md) `混在` — 公開ページの構成と共通の作り。ルーティング、/teams・大会ハブ・年度別結果ページの規則、開催前の大会と中止回の見せ方、トップページ、パンくず・ナビ・llms.txt、サイトモード切替
- [希少イベント検知（この試合の名場面）](./rare-events.md) `固有` — score のポイント列から希少なプレー（名場面）を検知し、試合詳細の「見どころの場面」とサイト記録一覧（/matches/highlights）に出す仕組み。判定スコープ、6カテゴリ、データフロー、運用、パターン発見ハーネス
- [Score Analysis](./score-analysis.md) `固有` — score のデータを使った分析の仕様。試合分析と成長分析の責務境界、分析観点と指標、試合詳細の上段（この試合で分かったこと・ポイントの並び・ゲームスコア・見どころ）と下段グラフ、成長記録の比べ方、ビルド時の生成
- [Score Feature](./score-feature.md) `固有` — score 機能の記録・入力側の現行仕様。画面と導線、ポイント記録（ショートカット・ピック・再生速度・入力時の自動推定・修正導線・ゲーム単位のやり直し）、YouTube 連携、共有 URL。編集 URL とドメイン分離は Draft
- [Score 一般公開・新機能ピボット検討](./score-general-availability.md) `固有` `draft` — score 機能を一般ユーザーにも広げる検討（未決定の発散フェーズ）。差別化の核（成長のヒントが主軸）、収益化オプション、需要調査、パイロット相関分析、score 関連アイデアの状況一覧
- [Score Site Link（試合詳細と本体の相互リンク）](./score-site-link.md) `混在` — score の試合詳細を本体のネスト URL で公開し、大会・選手ページと相互リンクする仕様。結合キーは entryNo ペア（団体戦は＋team_rubber_order）、公開 JSON の siteLink、野良試合は noindex、逆引き表。共有ヘルパーの統一は未了
- [Secondary School Pages（中学カテゴリ）](./secondaryschool.md) `学校` — 中学カテゴリ（/secondaryschool）の仕様。高校と違い性別を URL に入れず「チーム」と呼んで順位づけをしない。ルーティング、teamId の作り方、掲載閾値、都道府県・チームページ、進路（中学→高校）と出身クラブ
- [SNS 1日目投稿画像（sns-images / day1）](./sns-day1-images.md) `混在` — 2日制の大会の1日目終了時に X へ投稿する画像・キャプションを内部データから自動生成するツールの仕様（1日目・完結報告・CLI）。年度別結果ページの OGP 画像（ベスト16のトーナメント表）の生成と運用も含む
- [SNSストーリー生成基盤](./sns-story-platform.md) `汎用` `draft` — SNS 向けストーリー生成基盤（構造化データ→LLM 入力）の要件。要件定義まで完了・設計は未着手の Draft。既存の近縁の取り組みとの関係、大会インサイトで使う5分類の決着、展望記事などのアイデア状況
- [STリーグ ページ / データモデル](./st-league.md) `固有` — STリーグ（実業団リーグ）の公開ページとデータ構造。ディレクトリ構成、共有モジュール、データ追加手順
- [大会インサイト（結果ページの「注目ポイント」）](./tournament-insights.md) `汎用` — 年度別結果ページの「注目ポイント」を LLM 執筆＋機械照合で公開する仕組みの、サイト側の運用。データの置き場、4つの工程、prebuild の公開ゲート、照合が守らない範囲、進行中と完了の書き分け。kind 一覧は docs/story-yaml が正
- [Tournaments Local](./tournaments-local.md) `混在` — 地方大会（都道府県単位）の結果への導線ページ群と掲載運用。/tournaments/local の仕様
- [大学カテゴリ（/university）](./university.md) `学校` — 大学カテゴリ（/university）の仕様。中身は高校→大学の進路だけで、都道府県→チームのツリーは持たない。進路の採用条件（年差4年）、高校ページの進路節、大学の個別ページは /teams/[teamId] 型に寄せる

## procedure — 繰り返す手順と検算

- [回遊検証ランブック（GA4 / AdSense）](./circulation-verification.md) `汎用` — 回遊施策が効いたかを GA4 と AdSense で判定する検証ランブック。指標の定義、手順、判定の表
- [Data Import](./data-import.md) `混在` — 大会・選手・score 公開 JSON の生成運用。prebuild のゲートと鮮度チェック、データの正と派生の向き、品質チェック、決勝Tの席順（knockoutDraw）、名寄せの取り込み側ルール、国際大会・SPA の読み方、入力ツール
- [高校SEO M4検証ランブック（GSC事後検証）](./highschool-seo-m4-verification.md) `学校` — 高校カテゴリの SEO 施策が検索で効いたかを Google Search Console で事後検証する手順書
- [PDF からの取り込み](./pdf-import.md) `汎用` — 大会 PDF から details や入力ツール用 JSON を作る道具と、姓名の分割、独立した経路での検算、スキャン・アウトライン化 PDF の落とし穴、表記と tempId の扱い
- [団体戦のオーダーの取り込み](./team-match-order-import.md) `混在` — 団体戦のオーダーを公式記録または score 機能から details の matches に入れる手順と、検算・様式の知見
- [開催前の大会・国際大会の露出 実行ランブック](./upcoming-tournaments-runbook.md) `混在` — 開催前の大会・国際大会（アジア競技大会・世界ジュニア・国スポ）の露出の残作業を、順番に実行するための一覧

## index — 索引・集約

- [Idea Backlog 索引](./idea-backlog.md) `汎用` — Idea Backlog（発展候補アイデア）の所在地インデックスと一言サマリ。詳細は各エリアページの表が正
- [Open Questions](./open-questions.md) `混在` — wiki 全体の未解決の問いの唯一の置き場。各ページの Open Questions 節はここへのリンク1行

## wiki の外

- [docs/README.md](../README.md) — docs の運用ガイド（層の定義、置き場所）
- [adr/README.md](../adr/README.md) — 重要な決定の記録
- [raw/README.md](../raw/README.md) — 生の記録（追記のみ）
- [prompts/README.md](../prompts/README.md) — 定型プロンプト
