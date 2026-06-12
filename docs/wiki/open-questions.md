# Open Questions

## 公開面 / ドメイン分離

- `score.softeni-pick.com` 分離の正式方針は何か
- `softeni-pick` mode と `score` mode を今後どこまで別プロダクトとして扱うか
- score 側のヘッダー/フッターやブランド表現を分ける正式方針はあるか

## 試合詳細の beta 昇格（検討中 2026-06）

- 試合詳細の公開面を `/beta/matches-results/*` から本体ドメインの indexable な URL（候補: `/matches/*`）へ移設するか
- 移設する場合、`generate-beta-matches-json.mjs` の最新 50 件上限を撤廃するか、アーカイブ方式にするか（上限から漏れた試合の公開 URL が 404 になるため、インデックス開始前に決める必要がある。docs/wiki/data-import.md 参照）
- `source_site_tournament_id` を大会ページへのリンク用に安全な形で公開 JSON に出すか（内部項目除外ルールとの整合）

## score データモデル

- score 機能の正式な source of truth は Supabase か、それとも生成済み JSON か
- `edit_token` / `edit_token_hash` はどの画面・API で使う想定か
- `matches.status` / `processing_status` の正式な状態遷移は何か
- `points.result_type` の正式な enum 一覧はあるか

## 公開/編集権限

- 公開 / 非公開 / 限定公開の権限設計はあるか
- 編集可能 URL をトークン方式で残すのか、別の認可に寄せるのか
- `score` mode 以外の本番環境で API 書き込みをどのように制御しているか

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

## 高校カテゴリ

- 高校カテゴリの学校名表記揺れは、`data/tournaments/index.json` に載る大会を横断して、同年度・同姓同名選手が別学校名で出た場合に同一校として寄せる暫定ルールを採用している
- 上記ルールは誤結合を許容した暫定運用であり、別校を同一校として結合するリスクがある
- `scripts/highschool/03list/inferred-team-aliases.json` の確認頻度と、手動補正ルールの置き場所をどうするか
