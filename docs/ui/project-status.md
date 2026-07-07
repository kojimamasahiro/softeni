# project-status.md — プロジェクト状態

> このファイルだけ読めば現在の状態が分かるように維持する。
> 更新は作業単位ごと・セッション終了時に必ず行う。

最終更新: 2026-07-04

## 現在フェーズ

**プロジェクト完了**(全成果物 approved・D-010, 2026-07-04)→ **移行実施中**
- M1(清掃): 実施済み(2026-07-04)
- M2(ナビ・入口): 実施済み(2026-07-04)。/teams 新設・/highschool 入口化・SubNav・ナビ改訂
- M3(記録試合 URL 正規化): コード変更実施済み(2026-07-04)。/matches 両モード公開・_redirects 301・canonical 統一
- M4(ページ構造の統一): 実施済み(2026-07-04)。PageLayout+パンくずを growth 系・matches 系へ適用、h1 点検済み
- **残タスク(オーナー環境)**: `npm run build` → デプロイ → 表示・301疎通確認(O-004 の実表示確認を含む) → GSC を2週間監視(M3 完了条件)
- 次: M5(トークン導入)。実装方式は CSS 変数方式に決定済み(O-013 解消・D-022)。着手可

## フェーズ進捗

| Phase | 状態 |
|-------|------|
| 0 プロジェクト計画 | approved(D-002) |
| 1 現状調査 | approved(D-005) |
| 2 課題分析 | approved(D-006) |
| 3 ドメインモデル | approved(D-008) |
| 4 サイト構造設計 | approved(D-010) |
| 5 ページ構造設計 | approved(D-010) |
| 6 デザイン原則 | approved(D-010) |
| 7 コンポーネント体系 | approved(D-010) |
| 8 移行計画・運用ガイド | approved(D-010) |

## 完了済み成果物

- Phase 0 一式(approved, D-002)
- deliverables/01-inventory.md(approved, D-005)
- deliverables/02-issues.md(approved, D-006)

## レビュー待ち

- (なし)

## 承認済み

- Phase 0 一式: project-plan.md / PROJECT.md / project-status.md / rules.md / templates/phase-report.md / decisions.md / glossary.md(D-002, 2026-07-04)
- deliverables/01-inventory.md(D-005, 2026-07-04)
- deliverables/02-issues.md(D-006, 2026-07-04)
- deliverables/03-domain-model.md + glossary.md ドメイン用語23件(D-008, 2026-07-04)
- deliverables/04〜09 の6成果物(D-010, 2026-07-04)

## 決定事項

decisions.md を参照。現時点の登録: D-001〜D-022(D-010 = Phase 4〜8 成果物の一括承認)

## 未決事項

| ID | 内容 | 起票日 | 状態 |
|----|------|--------|------|
| O-001 | Phase 1 のインベントリ記載テンプレートの合意 | 2026-07-03 | 解消(D-003) |
| O-002 | 対象サイトへのアクセス方法 | 2026-07-03 | 解消(D-004) |
| O-003 | /tournaments/major・/tournaments/local・/highschool/tournaments へのナビ導線の実配置確認 | 2026-07-04 | 解消(D-015: 導線新設なし) |
| O-004 | 各ページの実表示確認(スクリーンショットベース) | 2026-07-04 | 解消(D-017: 独立調査せず、デプロイ検証に統合) |
| O-005 | adinsight-site/ ディレクトリの位置づけ | 2026-07-04 | 解消(D-016: 削除) |
| O-006 | Supabase 側スキーマ詳細の要否 | 2026-07-04 | 解消(D-018: 不要・対象外) |
| O-007 | 高校チーム(文字列 id)とチームマスタ(連番 id)の統合要否 | 2026-07-04 | 未決(D-019: 当面着手しない。高校チーム個別ページ具体化時に再検討) |
| O-008 | 選手の所属変遷(進学・移籍)のモデル上の扱い | 2026-07-04 | 未決(D-020: 当面着手しない。経歴集約機能具体化時に再検討) |
| O-009 | 「試合記録」のナビ露出可否 | 2026-07-04 | 解消(D-011: 出さない) |
| O-010 | /teams 一覧の検索仕様 | 2026-07-04 | 解消(D-014: count>=2、リンクは当面STリーグチームのみ) |
| O-011 | /rankings のページタイプ扱い(将来のデータボード型独立) | 2026-07-04 | 未決(D-021: 現行の発火条件を維持。該当ページ3つ以上で再検討) |
| O-012 | ダークモード方針 | 2026-07-04 | 解消(D-012: 将来対応・dark: は置換。ダーク値・ステータストークンは D-023 で確定、M5-3 で機械置換実施) |
| O-015 | M5-3 後に残った約430箇所の `dark:` 直書きの扱い | 2026-07-07 | 当面据え置き(2026-07-08 方針確定: 一括自動移行はせず opportunistic 移行。08-migration-plan.md §5 参照) |
| O-013 | トークン実装方式(tailwind.config or CSS 変数) | 2026-07-04 | 解消(D-022: CSS 変数方式) |
| O-014 | AffiliateLink の採否 | 2026-07-04 | 解消(D-013: 削除) |

## 保留事項

- O-007(id 統合)・O-008(所属変遷モデル化): 当面着手しない。再検討トリガーは decisions.md D-019/D-020 参照

## 次回開始位置(プロジェクト完了後の運用)

1. 移行の実施: 08-migration-plan.md の M1(清掃)から着手。各単位の着手前に該当する未決事項(O-009〜O-014)をオーナーへ確認
2. 以降の運用は 09-operation-guide.md に従う(新ページ追加手順・ドキュメント更新ルール)
3. 残る未決事項(O-007・O-008・O-011)は、それぞれの再検討トリガー(decisions.md D-019/D-020/D-021)が成立した時点で扱う

## プロジェクト完了条件の充足確認

- Phase 1〜8 の全成果物 approved: ✅(D-005, D-006, D-008, D-010)
- 移行計画・運用ガイド承認済み: ✅
- 成功基準 S1〜S4: 09 §5 で検証記録済み(S1 ウォークスルー含む)

## 更新履歴

| 日付 | 内容 | 更新者 |
|------|------|--------|
| 2026-07-03 | Phase 0 成果物一式を作成、レビュー待ちに設定 | Claude |
| 2026-07-04 | Phase 0 承認(D-002)、O-001/O-002 解消(D-003/D-004)、Phase 1 開始 | Claude |
| 2026-07-04 | 01-inventory.md 作成・in-review 化、O-003〜O-006 起票 | Claude |
| 2026-07-04 | Phase 1 承認(D-005)、Phase 2 開始、02-issues.md 作成・in-review 化 | Claude |
| 2026-07-04 | Phase 2 承認(D-006)・解決範囲記録(D-007)、Phase 3 開始、03-domain-model.md 作成・glossary.md 更新・O-007/O-008 起票 | Claude |
| 2026-07-04 | Phase 3 承認(D-008)、一括作業指示(D-009)、04〜09 の6成果物を作成・in-review 化、O-009〜O-014 起票 | Claude |
| 2026-07-04 | 04〜09 一括承認(D-010)、プロジェクト完了に更新 | Claude |
| 2026-07-04 | O-009/O-012/O-014 をオーナー判断で解消(D-011〜D-013)、04/06/07/08 へ反映 | Claude |
| 2026-07-04 | M1 実施(Header.tsx 削除 / md 移動 / robots 修正 / generations.json 改名 / AffiliateLink 削除)。tsc・lint 検証済み | Claude |
| 2026-07-04 | O-010 解消(D-014)。M2 実施(/teams 新設・/highschool 入口化・SubNav 新設・ナビ改訂・llms.txt 更新)。tsc・lint 検証済み | Claude |
| 2026-07-04 | M3 実施(/matches 両モード公開・_redirects 301・canonical 統一)。M1/M2 取りこぼし修正(_redirects 旧 /highschool 301 撤去、next-sitemap robots・除外設定)。tsc・lint 検証済み | Claude |
| 2026-07-04 | M4 実施(PageLayout+パンくず: growth 系2ページ・試合一覧/詳細/成長分析の共有実装。h1 点検)。tsc・lint 検証済み | Claude |
| 2026-07-04 | O-013 解消(D-022)。M5-1 実施(globals.css に色トークン10種)+T7・新設コンポーネントのパイロット置換 | Claude |
| 2026-07-04 | O-003 解消(D-015: ナビ導線新設なし)。O-005 解消(D-016: adinsight-site/ 削除)。adinsight-site/・wrangler.adinsight.toml・scripts/build-adinsight-site.mjs・package.json build:adinsight を削除、関連 wiki 更新 | Claude |
| 2026-07-04 | 推奨案をオーナー承認: O-004 解消(D-017)、O-006 解消(D-018)、O-007 は当面保留(D-019)、O-008 は当面保留(D-020)、O-011 は現行条件維持(D-021)、O-013 解消(D-022: CSS変数方式)。M5 着手可能に | Claude |
