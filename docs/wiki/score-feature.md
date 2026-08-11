# Score Feature

## 概要

score 機能は、試合作成、ゲーム/ポイント記録、動画レビュー、公開ページ、成長分析までを含む一連の機能群です。

主要ファイル:

- `src/pages/beta/matches/create.tsx`
- `src/pages/beta/matches/[matchId]/input.tsx`
- `src/pages/beta/matches/[matchId]/video-review.tsx`
- `src/pages/beta/matches-results/**`
- `src/pages/matches/**`
- `src/pages/api/matches/**`

## 実装済みの画面と導線

### 管理/入力側

- `/beta/matches`
- `/beta/matches/create`
- `/beta/matches/[matchId]`
- `/beta/matches/[matchId]/input`
- `/beta/matches/[matchId]/video-review`

補足:

- `isDebugMode()` と `hasLiveMatchApi()` による利用制限があります
- `score` mode では編集系ページ・書き込み API を閉じる実装があります

### 公開側

- `/beta/matches-results`
- `/beta/matches-results/[matchId]`
- `/beta/matches-results/growth`（内部ツール面・`noindex`。対象は公開試合の参加者）
- `/matches`
- `/matches/[matchId]`
- `/matches/growth`（同上・score モード）
- `/growth`（成長記録ハブ・公開/インデックス対象。2026-06 追加）
- `/growth/[slug]`（選手の成長記録ショーケース・公開/インデックス対象。対象は `data/growth-featured.json`。詳細は ADR-004）

## 試合詳細ページで確認できる要素

- match 基本情報
- ゲームごとのスコア
- ポイント列
- サーブ/レシーブ/重要局面/ラリー系の分析表示
- YouTube 埋め込みまたは外部リンク
- 成長分析への導線

確認根拠:

- `src/pages/beta/matches-results/[matchId]/index.tsx`
- `lib/matchAnalysis/`
- `lib/siteConfig.ts`

## ポイント記録

`points` は少なくとも以下の情報を持ちます。

- `winner_team`
- `serving_team`
- `serving_player`
- `rally_count`
- `first_serve_fault`
- `double_fault`
- `result_type`
- `winner_player`
- `loser_player`
- `point_note`
- `shot_type`
- `shot_course`
- `video_start_ms`
- `video_end_ms`

確認根拠:

- `src/types/database.ts`
- `src/pages/api/matches/[matchId]/points/index.ts`
- `docs/sql/point-youtube-review.sql`

### キーボードショートカット

`/beta/matches/[matchId]/input` のショートカット（`useMatchInputController` の keydown ハンドラ）。
テキスト入力中（input / textarea / select / contenteditable）と、Meta / Alt 併用時は無効。

| キー | 操作 | 条件 |
| --- | --- | --- |
| `s` / `Ctrl+S` | 動画の開始時刻を記録 | 動画あり |
| `e` / `Ctrl+E` | 動画の終了時刻を記録 | 動画あり |
| `a` | サービスエース | 入力フォーム表示中 |
| `d` | ダブルフォルト | 入力フォーム表示中 |
| `f` | 1stフォルト | 入力フォーム表示中 |
| `g` | ポイント記録（編集中は更新） | 入力フォーム表示中・勝者チーム選択済み・送信中でない |
| `Ctrl+D` | 動画を再生 | 動画あり |
| `Ctrl+F` | 動画時刻をクリア | 動画あり |
| `←` / `→` | 5秒シーク | 動画あり |

`d` / `f` は単キーと Ctrl 併用で意味が異なる（単キー＝ポイント入力、Ctrl＝動画操作）ことに注意。
ポイント入力系のキーは動画が無い試合でも使えます。
対応するボタンには割り当てキーを併記しています（`ShortcutKeyHint`）。

サービスエース / ダブルフォルト / 1stフォルトの更新処理は、ボタンとショートカットで共有するため
コントローラ側（`selectServiceAce` / `selectDoubleFault` / `toggleFirstServeFault`）にあります。

確認根拠:

- `src/components/matches/matchInput/useMatchInputController.ts`
- `docs/raw/2026-08-11-score-input-keyboard-shortcuts.md`

### 入力時の自動推定

ポイント入力フォームでは、入力済みの内容から一意に決まる項目を自動で埋めます
（`lib/pointInference.ts` の `inferPointData`、2026-08-11 追加）。

- **空欄のみ埋める**設計で、手で選んだ値は上書きしません。埋めた値は通常の選択と同じ見た目で、
  記録／更新ボタンを押すまで確定しません。
- 補完対象: 結果タイプ＋関与選手→勝者チーム / サービスエース / ダブルフォルト /
  **レシーブ失敗→サーブ側の得点・レシーブ選手・ラリー数2** /
  **シングルスの関与選手**（1チーム1人なら結果タイプ＋勝者チームで一意）
- 編集モードでは「次のポイント」ではなく**編集対象ポイント**のサーブ／レシーブを文脈に使います。

レシーブ選手の特定には `games.initial_receive_player_index`（第1ポイントのレシーバー）を使い、
ゲーム開始時の `ServeSelection` で選択します。適用 SQL は `docs/sql/receive-order.sql`。

Assumption: ダブルスではゲーム開始時にレシーブ順が決まり、そのチームがレシーブするポイントごとに
2人が交互に受ける、というルールで算出しています（`getCurrentReceivingPlayerIndex`）。
ファイナルゲームは2ポイントごとにチームが入れ替わるため、そのチームがレシーブした回数で数えます。

確認根拠:

- `lib/pointInference.ts`
- `lib/serveHelpers.ts`
- `src/components/ServeSelection.tsx`
- `docs/raw/2026-08-11-score-input-auto-inference.md`

### 記録済みポイントの修正導線

- ゲーム履歴（`GameHistorySection`）の各ポイントカードの「編集」ボタン
- **直前ポイントのクイック修正カード**（`LastPointQuickEdit`、2026-08-11 追加）。
  入力フォーム直上（フォーム非表示時はゲーム履歴の直上）に直前ポイントの要約を常時表示し、
  「直前を修正」ボタン1つで同じ編集モードに入る。ゲーム履歴まで探しに行かずに済む。
  - 現在のゲームにポイントが無い場合は前のゲームの最終ポイントまで遡るため、
    ゲームを決めたポイントも直後に修正できる
  - 楽観的更新中の仮ID（`temp-`）と送信中は編集不可
- どちらも `startEditPoint(game, point)` → `updatePoint()` の同一経路。編集開始時に
  動画は「1つ前のポイントの終了時刻」へシークする（`getEditPointSeekTimeMs`）。

### ゲーム単位のやり直し

ゲーム履歴の各ゲームに「ここからやり直す」があり、**指定ゲーム以降をまとめて削除**します
（`DELETE /api/matches/[matchId]/games` に `{ from_game_number }`、2026-08-11 追加）。

- 対象ゲームの points を先に明示削除してから games を削除します（FK の `ON DELETE` に依存しない）。
- `status = completed` の試合は `in_progress` に戻し `completed_at` を null にします。
- 削除後は `currentGame` が無くなるため、入力ページは「第Nゲームを開始」を表示し、
  サーブ権・レシーブ順の選択からやり直せます。

「そのゲームだけ入れ直す」形にしていないのは、ファイナルゲーム判定・ゲームごとのサーブ交代・
試合終了判定がいずれも勝ちゲーム数とゲーム番号に依存しており、途中ゲームを差し替えると
以降の記録済みポイントと前提が食い違うためです（詳細は
`docs/raw/2026-08-11-score-input-restart-from-game.md`）。

確認根拠:

- `src/components/matches/matchInput/LastPointQuickEdit.tsx`
- `src/components/matches/matchInput/useMatchInputController.ts`
- `docs/raw/2026-08-11-score-input-last-point-quick-edit.md`

## YouTube 連携

実装で確認できること:

- `matches` に `youtube_video_id`, `youtube_url`, `youtube_embed_allowed` を保持
- `points` に `video_start_ms`, `video_end_ms` を保持
- 動画レビューセッションを `match_video_sessions` と `match_point_candidates` で管理
- 候補ポイントをレビュー後に `points` へ反映できる

確認根拠:

- `docs/sql/video-review.sql`
- `docs/sql/point-youtube-review.sql`
- `src/pages/api/matches/[matchId]/video-sessions/**`
- `src/pages/beta/matches/[matchId]/video-review.tsx`

## 共有 URL

実装済みとして確認できる共有 URL:

- `softeni-pick` mode: `/beta/matches-results/[matchId]`
- `score` mode: `/matches/[matchId]`

URL の組み立ては `lib/siteConfig.ts` に寄せられています。

## 編集可能 URL

Draft / Open Question:

- `scripts/generate-beta-matches-json.mjs` では `edit_token` / `edit_token_hash` を公開 JSON から除外しています
- ただし、今回確認した画面・API では編集 URL トークンを消費する処理までは確認できていません

## Draft

- `score.softeni-pick.com` を本体とどこまで分けるかの正式運用
  → 方針決定済み（2026-06）: [ADR-003](../adr/ADR-003-score-media-tool-separation.md)。
  「閲覧公開＝本体に統合」「ツール公開（UGC）＝score に分離」。
- 共有 URL と編集可能 URL を別権限で扱う正式設計
  → ADR-003 で `edit_token` 廃止・認証所有モデル（`owner_user_id` / `visibility`）へ寄せる方針
- 本体サイト（大会・選手ページ）との相互リンク設計: [score-site-link.md](./score-site-link.md)（2026-06 Draft）
- 一般ユーザーへの公開・課金展開の方向性: [score-general-availability.md](./score-general-availability.md)（2026-07 Draft）

## Assumption

- 現時点の score 機能は「記録管理は beta 側、閲覧公開は score 側」という分離を進めている途中段階

## Open Questions

- `edit_token` / `edit_token_hash` の正式な利用箇所
- 試合編集権限を今後どの方式で渡すか
- 公開用 `matchId` を恒久的にそのまま使う方針か
