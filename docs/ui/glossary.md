# glossary.md — 用語集

> サイト・ドキュメントで使う用語の正式定義。Phase 3 で本格的に整備する。
> 未定義の用語を使う前に、ここへ draft として追加すること(rules.md R14)。

## 記録フォーマット

| 用語 | 定義 | 表記ゆれ(使用禁止) | ステータス |
|------|------|----------------------|------------|

## プロジェクト用語

| 用語 | 定義 | 表記ゆれ(使用禁止) | ステータス |
|------|------|----------------------|------------|
| オーナー | 本プロジェクトの承認者(masahiro) | 管理者, 依頼者 | approved |
| 成果物 | deliverables/ 配下のフェーズ出力ドキュメント | アウトプット | approved |
| 承認 | オーナーの明示的な承認発言 + decisions.md への記録 | OK, 確認 | approved |

## ドメイン用語(定義の詳細は 03-domain-model.md が正)

| 用語 | 定義 | 表記ゆれ(使用禁止) | ステータス |
|------|------|----------------------|------------|
| 世代(generation) | 大会の大分類軸(国際/国際予選/総合/実業団・社会人/大学/高校/ジュニア/シニアの8種) | カテゴリ, 区分 | approved(D-008) |
| 大会(tournament) | 年度を持たない大会の系列 | — | approved(D-008) |
| 大会年度(tournament edition) | 1大会の1回の開催(year・開催地・日程を持つ) | 大会(年度の意味で), 開催回 | approved(D-008) |
| カテゴリ(category) | 大会年度内の競技区分。種目×年齢区分×性別の組 | 種別, 部門 | approved(D-008) |
| 種目(discipline) | singles / doubles | category, 競技 | approved(D-008) |
| 年齢区分(age) | none(一般)ほか | — | approved(D-008) |
| 性別(gender) | boys / girls / mixed。mixed は大会カテゴリにのみ存在 | 男女(値としては) | approved(D-008) |
| 連盟(federation) | 地域大会の主催団体(都道府県連盟) | — | approved(D-008) |
| 出場選手(participant) | 1大会年度カテゴリに出場した選手のその大会での姿(所属・県つき) | — | approved(D-008) |
| エントリー(entry) | 出場単位(ペア/個人)。トーナメント表の1枠 | — | approved(D-008) |
| 対戦(match・大会結果) | 大会内の1試合(勝敗・スコア。ポイント記録なし) | 試合(記録試合との混同文脈で) | approved(D-008) |
| 成績(result) | エントリーの最終成績(優勝等) | 戦績(表示名としては可) | approved(D-008) |
| 選手(player) | 名寄せ済み選手マスタ(数値 id) | プレイヤー | approved(D-008) |
| 選手プロフィール(player profile) | 手動整備した選手詳細(slug・curated 約23名) | — | approved(D-008) |
| チーム(team) | 名寄せ済みチームマスタ(連番 id。学校・実業団・クラブを包含) | 学校, 実業団(エンティティ名として) | approved(D-008) |
| 高校チーム(highschool team) | 高校特集で使う学校サブセット(文字列 id) | 学校(エンティティ名として) | approved(D-008) |
| 都道府県(prefecture) | 47都道府県マスタ(+連盟・外国等の例外値) | — | approved(D-008) |
| ランキング(ranking) | 年度×種目×性別の選手順位表 | — | approved(D-008) |
| 記事(article) | ニュース記事(現行は大会展望 preview 専用) | ニュース(エンティティ名として) | approved(D-008) |
| 成長記録(growth report) | 運営キュレーションの選手成長ショーケース | — | approved(D-008) |
| STリーグ回(ST league edition) | STリーグの1年度開催(第N回) | — | approved(D-008) |
| 記録試合(recorded match) | ポイント単位で記録した試合(score/beta 面・Supabase) | ベータ試合, スコア試合 | approved(D-008) |
| ゲーム(game) / ポイント(point) | 記録試合内のゲーム / 最小記録単位 | — | approved(D-008) |
