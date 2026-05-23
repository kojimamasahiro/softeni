# Open Questions

## 公開面 / ドメイン分離

- `score.softeni-pick.com` 分離の正式方針は何か
- `softeni-pick` mode と `score` mode を今後どこまで別プロダクトとして扱うか
- score 側のヘッダー/フッターやブランド表現を分ける正式方針はあるか

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
