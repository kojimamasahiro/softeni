# ADR-003: score の「閲覧公開（メディア）」と「ツール公開（UGC）」の分離方針

## Status

Accepted（高レベル方針）。データモデルの詳細仕様は Open Questions に残す。

## Context

score 機能は本体（`softeni-pick` mode）に組み込んで作り始め、公開面だけ
`score` mode（`/matches*`、`score.softeni-pick.com` 想定）として後から切り出してきた。
さらに 2026-06 の score-site-link 実装（ADR 化前提の設計は `docs/wiki/score-site-link.md`）で、
掲載大会の試合詳細を本体ドメインの `/tournaments/.../matches/{UUID}` にネストし、
大会・選手ページと相互リンクさせた。

結果として現行コードは「本体に深く統合する（siteLink）」方向と
「score として分離する」方向の両方に同時に引っ張られている。

分析機能を一般公開したいが、UX を詰める前提でまず「サイト用」として作り込んだため、
公開用の位置づけが定まっていない。やりたいことは次の両方:

- 閲覧公開（メディア）: 運営が記録した掲載試合の分析を、一般ユーザーが閲覧する
- ツール公開（UGC）: 一般ユーザー自身が自分の試合を記録・分析する

特に懸念しているレイヤーは **データ/権限** と **UX/導線**。

## Decision

「閲覧公開」と「ツール公開」を別プロダクトとして扱い、**一律の完全分離はしない**。
分離する軸を選ぶ。

### 1. 役割の割り当て

- 閲覧公開（メディア）= 本体 `softeni-pick.com` に統合する。掲載試合の分析閲覧は
  siteLink によるネスト URL（実装済み）を正とする。ビルド時生成の静的 JSON・認証なし・SEO 重視。
- ツール公開（UGC）= `score.softeni-pick.com` を本拠地とする。一般ユーザーの記録・分析。
  認証必須・ランタイム DB・private 既定・データ分離が前提。
- これにより「閲覧公開＝本体に統合」「ツール公開＝score として分離」と役割で割り切り、
  現行コードの二方向の綱引きを解消する。

### 2. コードベースは分けない

別リポジトリ化はしない。同一コードベース内で公開面と取得層を分ける。
特に分析エンジン（`lib/matchAnalysis.ts` / `lib/growthAnalysis.ts`）は
**1 つのまま両方で再利用する**（分割しない共有資産）。

### 3. データ/権限を「完全分離」する

試合を所有と可視性で 3 クラスに分ける。

- 掲載大会試合: 所有者＝運営、`visibility=public`、`siteLink` 付与、SEO 対象。本体メディア資産。
- ユーザー UGC 試合: `owner_user_id` を持つ、`visibility=private` 既定、認証必須。
- 共有資産: 分析ロジック（`lib/`）。

静的 JSON 生成は「public / siteLink あり」のものだけを対象にし、
private な UGC はランタイムでしか出さない。これで公開データと記録データが構造的に分離する。

宙に浮いている `edit_token` / `edit_token_hash`（トークン方式）は、UGC を入れる前提では
廃止し、**認証ユーザー所有モデル（`owner_user_id`）に置き換える**方針とする。

### 4. UX/導線を 3 面として設計する

- 本体メディア（`softeni-pick.com`）: 大会・選手・掲載試合の分析閲覧。
- 分析ツール（`score.softeni-pick.com`）: ログイン後の自分専用空間。UGC 記録・分析のホーム。
- 共有: ユーザーが明示的に「公開」したものだけ共有 URL で見える。

既存の作り込み（サイト用前提の記録 UI / 閲覧 UI）は捨てない。閲覧 UI はメディア側の資産として
そのまま活かし、ツール側は記録 UI（`beta/matches` 系）を認証付きで再利用する。
本質は「所有者と可視性の概念を足す」こと。

### 5. 段階リリース

- Phase 1: 閲覧公開を確定（siteLink で概ね完了）。残りは野良試合を score 側
  `/matches/{UUID}` に移すかの方針決定。
- Phase 2: ツール公開は MVP を別ルート / サブドメインで新規に立てる。
  認証＋private 既定＋ランタイム DB。既存の静的 JSON 公開面は温存する。

## Alternatives

- **完全分離（別リポジトリ / 別プロダクト）**: 分析エンジンが二重化し、保守コストが高い。却下。
- **完全統合（すべて本体メディアに寄せる、静的 JSON のまま）**: UGC は認証・ランタイム書き込み・
  データ分離が必須で、ビルド時静的 JSON の延長では実現できない。却下。
- **`edit_token` 方式を UGC でも継続**: 所有・可視性・本人編集の表現が弱く、なりすまし・
  権限管理が破綻しやすい。認証所有モデルに寄せる方が後戻りコストが低いと判断。

## Consequences

- メリット: 既存の静的メディア面とロジック資産を捨てずに、UGC を別ランタイムとして
  追加できる。二方向の綱引きが役割分担として整理される。
- デメリット / 新たに必要になるもの: 認証基盤、`owner_user_id` と `visibility` を持つ
  データモデル、private データのランタイム取得経路、静的 JSON 生成の「公開分のみ」絞り込み、
  UGC のモデレーション方針。
- `score` mode の位置づけが「公開閲覧の薄いラッパ」から「UGC 分析ツールの本拠地」へ変わる。
- 静的 JSON 生成（`scripts/generate-beta-matches-json.mjs`）は公開対象の抽出条件を
  `visibility` ベースに見直す必要がある。

## Related Files

- `docs/wiki/project-overview.md`, `docs/wiki/score-feature.md`, `docs/wiki/score-analysis.md`
- `docs/wiki/score-site-link.md`（siteLink 設計）
- `lib/siteConfig.ts`（`SITE_MODE` / URL 振り分け）
- `lib/matchAnalysis.ts`, `lib/growthAnalysis.ts`（共有分析エンジン）
- `scripts/generate-beta-matches-json.mjs`（静的 JSON 生成・公開対象の絞り込み）
- `src/types/database.ts`（`Match` への `owner_user_id` / `visibility` 追加が対象）
- `src/pages/beta/matches/**`（UGC 記録 UI の認証付き再利用）

## Open Questions

- UGC 用データモデルの具体仕様（`owner_user_id` / `visibility` の enum / 静的生成の絞り込み条件）。
- 認証方式（プロバイダ・セッション・Supabase Auth を使うか）。
- UGC のモデレーションと公開審査の運用。
- 野良試合（既存 `/beta/matches-results/*`）を UGC モデルに寄せるか、別扱いのまま残すか。
- `score` mode を Phase 2 で UGC 本拠地に転換する際の既存 score mode ラッパとの整合。
