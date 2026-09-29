# 差分DDL 適用台帳

このリポジトリには migration runner が無く、`docs/sql/*.sql` は **Supabase に手で適用する**
運用になっている（各SQLの冒頭コメントにも同趣旨の記載あり）。
適用したかどうかがコードから分からないため、ここを唯一の記録場所とする（2026-08-12 新設）。

## ルール

- SQL を新しく追加したら、**同じコミットでこの表に行を足す**（適用日は空でよい）。
  行の無い SQL は `npm run check:wiki -- --strict`（CI の checks.yml）で落ちる（2026-09-30〜）
- 本番 Supabase に適用したら、適用日と適用者を書き込む
- 適用は冪等に書く（`add column if not exists` 等）。再適用しても壊れないこと
- テスト用プロジェクト（`NEXT_PUBLIC_SUPABASE_TEST_URL`）にも適用する場合は備考に書く

## 適用状況

| SQL | 内容 | 追加日 | 本番適用日 | 備考 |
|---|---|---|---|---|
| [growth-analysis.sql](./growth-analysis.sql) | 成長分析メタデータ | 2026-05-19 | 適用済み（日付不明） | 2026-09-30 に列の存在を確認 |
| [video-review.sql](./video-review.sql) | `match_video_sessions` / `match_point_candidates` | 2026-05-22 | 適用済み（日付不明） | 2026-09-30 にテーブルの存在を確認 |
| [point-youtube-review.sql](./point-youtube-review.sql) | `matches` の YouTube 列、`points` の動画時刻列 | 2026-05-22 | 適用済み（日付不明） | 2026-09-30 に列の存在を確認 |
| [receive-order.sql](./receive-order.sql) | `games.initial_receive_player_index` | 2026-08-11 | 適用済み（日付不明） | 2026-09-30 に列の存在を確認 |
| [point-pick.sql](./point-pick.sql) | `points.is_pick` / `pick_note`（記録中のピック） | 2026-09-29 | 適用済み（日付不明） | 2026-09-30 に列の存在を確認。台帳の行が漏れていたのを同日の lint で補った |

## 確認のしかた

本番（`.env.local` の `NEXT_PUBLIC_SUPABASE_URL`）の REST に **anon キーで列だけを select** する。
RLS で行は返らない（`[]`）が、**列が無ければ 400（`42703 ... does not exist`）、あれば 200** になるので、
読み取りだけで適用の有無が分かる。対照として存在しない列名を1本混ぜ、400 が返ることも確かめる。

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/points?select=id,is_pick,pick_note&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

## 関連

- [wiki/database.md](../wiki/database.md) — 推定スキーマ
- [wiki/score-feature.md](../wiki/score-feature.md) — `receive-order.sql` / `point-pick.sql` を使う機能
