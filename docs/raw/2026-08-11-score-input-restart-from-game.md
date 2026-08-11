# score 入力: 指定ゲーム以降を削除してやり直す

日付: 2026-08-11
状態: 実装済み（`/beta/matches/[matchId]/input`）

## きっかけ

原文: 「途中のゲームが間違っていた場合にそのゲームを丸ごと最初から登録できるようにしたい。
難しいようだったら指定したゲーム以降はクリアしてそのゲームからやり直しができればいい」。

## 採用した方式と理由

**指定ゲーム以降をまとめて削除**する方式（＝本人の言う代替案）を採った。

「そのゲームだけを丸ごと入れ直す」方式を採らなかったのは、ゲームが独立していないため:

- ファイナルゲーム判定は「勝ちゲーム数が要求勝利数−1で並んだか」で決まる
  （`lib/matchRules.ts` の `isFinalGame`）。途中ゲームの勝者が変われば、以降のゲームが
  ファイナルかどうかが変わり、サーブ交代規則（2ポイントごとの交代）も変わる。
- ゲーム開始時のサーブ権はゲーム番号の偶奇で決まる（`determineInitialServeTeam`）。
- 試合終了判定・`status = completed` も勝ちゲーム数に依存する。

つまり途中ゲームを差し替えると、以降の記録済みポイントが「そのとき正しかったサーブ」と
食い違う状態になり得る。一貫性を保つには以降を作り直すのが結局同じことになるため、
最初からその形にした。

## 実装

1. `DELETE /api/matches/[matchId]/games`（`games/index.ts` に追加）
   - body: `{ from_game_number: number }`
   - 対象ゲームの points を先に明示削除 → games を削除。
     外部キーの `ON DELETE` 設定に依存しないようにした。
   - `match.status === 'completed'` なら `in_progress` に戻し `completed_at` を null にする
     （削除で試合終了の条件が崩れるため）。
   - レスポンスに `deletedGameCount` / `deletedPointCount` を返す。
2. `useMatchInputController.restartFromGame(game)`
   - 実行前に `window.confirm` で削除ゲーム数・ポイント数を提示。
   - 成功後は編集モード解除・手動サーブ選択解除・`currentGame` クリア → `fetchMatch()`。
3. `fetchMatch`: 第1ゲームが無くなった場合に `initialServeTeam` を null に戻すよう修正。
   従来は「第1ゲームがあるときだけ set」だったため、第1ゲームごと削除すると
   **古いサーブ権が state に残り**、次に第2ゲーム以降を開始したときの
   サーブ権の自動決定（`determineInitialServeTeam`）が誤る恐れがあった。
4. `GameHistorySection`: 各ゲームのヘッダに「ここからやり直す」ボタンを追加
   （`canEditMatches` のときのみ、送信中は無効）。

## 削除後の画面遷移

`fetchMatch()` 後は該当ゲームが存在しないので `currentGame` が null になり、
入力ページは「第Nゲームを開始」ボタンを出す（`match.games.length + 1` が N になる）。
開始するとサーブ権・レシーブ順の選択画面に入り、そこから記録し直せる。
第1ゲームから消した場合は「試合開始前」表示に戻る。

## 未解決 / 今後

- 削除は取り消せない（ゴミ箱・論理削除は無し）。confirm のみ。
- 動画レビューの候補（`match_point_candidates`）は削除対象に含めていない。
  該当ゲームのポイントを消しても候補セッションは残る。実害は未確認。
- 「そのゲームだけ入れ直す」方式は未実装のまま（上記の理由で見送り）。

## Compile Log

`docs/wiki/score-feature.md` に `### ゲーム単位のやり直し` を追加した（2026-08-11）。

反映したもの:

- 「ここからやり直す」＝指定ゲーム以降の一括削除であること、API と引数
- points を先に消す・completed を戻すという実装上の約束
- 削除後は「第Nゲームを開始」に戻ること
- そのゲームだけ入れ直す形にしなかった理由（要約＋raw への参照）

意図的に載せなかったもの:

- 判断理由の詳細（`isFinalGame` の条件、`determineInitialServeTeam` の偶奇）— wiki には要約を置き、
  根拠は raw を参照する形にした。
- `fetchMatch` の `initialServeTeam` リセット修正 — 内部状態の取りこぼし修正で、
  外から見える仕様ではない。
- 動画レビュー候補が残る件・削除が取り消せない件 — 未確認の残課題。確認できたら書く。
