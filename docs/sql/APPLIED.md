# 差分DDL 適用台帳

このリポジトリには migration runner が無く、`docs/sql/*.sql` は **Supabase に手で適用する**
運用になっている（各SQLの冒頭コメントにも同趣旨の記載あり）。
適用したかどうかがコードから分からないため、ここを唯一の記録場所とする（2026-08-12 新設）。

## ルール

- SQL を新しく追加したら、**同じコミットでこの表に行を足す**（適用日は空でよい）
- 本番 Supabase に適用したら、適用日と適用者を書き込む
- 適用は冪等に書く（`add column if not exists` 等）。再適用しても壊れないこと
- テスト用プロジェクト（`NEXT_PUBLIC_SUPABASE_TEST_URL`）にも適用する場合は備考に書く

## 適用状況

| SQL | 内容 | 追加日 | 本番適用日 | 備考 |
|---|---|---|---|---|
| [growth-analysis.sql](./growth-analysis.sql) | 成長分析メタデータ | 2026-05-19 | 未記録 | 成長分析の書き込みUIは稼働しているため適用済みと推定（Assumption） |
| [video-review.sql](./video-review.sql) | `match_video_sessions` / `match_point_candidates` | 2026-05-22 | 未記録 | 動画レビューが稼働しているため適用済みと推定（Assumption） |
| [point-youtube-review.sql](./point-youtube-review.sql) | `matches` の YouTube 列、`points` の動画時刻列 | 2026-05-22 | 未記録 | 公開ページで動画リンクが出ているため適用済みと推定（Assumption） |
| [receive-order.sql](./receive-order.sql) | `games.initial_receive_player_index` | 2026-08-11 | **未確認** | 未適用だとレシーブ選手の自動推定が働かない（`games.initial_receive_player_index` が常に null）。適用したらここに日付を記入する |

「未記録」は台帳を作る前に適用されたもので、稼働している機能から適用済みと推定している。
確認できたら「未記録」を実際の日付に置き換える。

## 関連

- [wiki/database.md](../wiki/database.md) — 推定スキーマ
- [wiki/score-feature.md](../wiki/score-feature.md) — `receive-order.sql` を使う機能（入力時の自動推定）
