# Score Site Link（試合詳細と本体の相互リンク）

ステータス: Draft（2026-06）。未実装の設計仕様。実装後に本文の Draft 表記を外す。

## 目的

試合詳細（score 系）と本体サイト（大会ページ・選手ページ）を相互リンクさせる。
方針は「表示時に名前や entryNo で突合する」のではなく、**「作成時点で大会データから参照して、リンクを構造的に正しくする」**。

## 背景（2026-06 調査結果）

- `src/pages/beta/matches/create.tsx` の getStaticProps は既に `data/tournaments/**` を走査して大会選択 UI を作っている。一方、選手名・所属・entryNo はフリーテキスト手入力で、二重入力かつ不整合の発生源になっている
- 大会詳細 JSON（`data/tournaments/details/**`）の `matchId` は `tools/shared/normalize-core.js` で `match-${i+1}` と連番採番される。再生成で番号がずれるため**外部キーには使えない**
- entryNo は公式プログラム由来で安定。同じ 2 エントリーは 1 大会カテゴリ内で 1 回しか対戦しない（トーナメント・リーグとも）ため、**entryNo ペアで試合行を一意に特定できる**
- 試合詳細→大会ページのリンクは `generateTournamentUrlFromMatch` で実装済み。ただし `ageCategory='none'` 決め打ち・`tournamentHelpers.ts` / `tournamentClientHelpers.ts` の二重実装という脆さがある
- 現行スナップショットの全 15 試合に `tournament_id` / `tournament_year` / entryNo が入っており、新方式への一括移行が可能（実データで entryNo+round の一致を検証済み）

## 仕様ドラフト

### 1. ジョインキー規約

試合詳細と大会データの試合行の対応付けは以下を正式キーとする。

- 大会カテゴリの特定: `tournament_generation` / `tournament_id` / `tournament_year` / `gameCategory` / `ageCategory` / `gender`
- 試合行の特定: entryNo ペア（順不同）
- `round_name` はキーに含めず、不一致検出（検証）にのみ使う

大会側の連番 `matchId`（`match-N`）は外部キーとして使わない。

### 2. 公開 JSON の `siteLink` フィールド

公開 JSON（`public/data/beta-matches/**`）にリンク専用の整形済みフィールドを追加する。

```json
"siteLink": {
  "tournamentPath": "/tournaments/all/zennihon-singles/2026/singles/none/boys",
  "entryNos": [156, 271]
}
```

- `tournamentPath` は生成時に確定させる。表示側での URL 再構築（`generateTournamentUrlFromMatch`）は廃止する
- 内部 ID（`source_site_match_id` 等）は従来どおり公開 JSON に出さない
- 大会データに紐づかない試合（練習試合・未収録大会）は `siteLink` なしとして扱い、相互リンクを出さないだけで他の表示は変えない

### 3. 試合作成フロー

- 大会→年→カテゴリ選択（現状のまま）の後、その大会のエントリー一覧から対戦カードを選択する方式に変更
- 選手名・所属・地域・entryNo は `data/tournaments/details/**` から自動補完する
- フリーテキスト手入力はフォールバックとして残す（その場合 `siteLink` なし）

### 4. 公開 JSON 生成（追記型へ変更)

`scripts/generate-beta-matches-json.mjs` を変更する。

- `ensureCleanDir`（出力ディレクトリ全削除）を廃止し、追記・更新型にする
- 最新 50 件上限（`LATEST_BETA_MATCH_LIMIT`）を撤廃する
- git にコミットされた JSON を公開面の正本とし、Supabase は記録ツールのバックエンドと位置づける

これにより docs/wiki/data-import.md に記載した「50 件上限による公開 URL 消失リスク」が構造的に解消される。

### 5. 逆方向リンク（本体→試合詳細）

- prebuild で逆引き表を 1 ファイル生成する
  - 大会ページキー（generation/tid/year/gameCategory/ageCategory/gender）→ 試合詳細リスト（entryNos、round、詳細 URL）
  - playerId → 試合詳細リスト
- 大会ページ・選手ページの getStaticProps が逆引き表を読み、該当箇所にリンクを表示する
- 選手 ID の解決は大会データの `participants` 経由とし、既存規約（`data/players/index.json`、count>=5、同姓同名は最初の ID）に従う

### 6. 共有ヘルパーの統一

- `generateTournamentUrlFromMatch` の二重実装（`lib/tournamentHelpers.ts` / `lib/tournamentClientHelpers.ts`）は `siteLink` 導入で削除する
- 選手名→playerId の解決規約は lib に共有ヘルパーとして集約する（現状は大会ページ・next-sitemap.config.js などに重複実装）

### 7. URL

- 試合詳細はフラットな `/matches/{id}` 系を維持する。大会 URL 配下へのネストは不採用（大会に紐づかない試合の置き場がなく、大会 URL 構造の変更に巻き込まれるため）
- 移設先（本体ドメインで indexable にするか）は別判断（docs/wiki/open-questions.md「試合詳細の beta 昇格」参照）

## 既存データの移行

- 既存 15 試合は entryNo・tournament_id が揃っているため、移行スクリプトで `siteLink` を一括付与する
- entryNo ペアが大会データ側で解決できない試合は `siteLink` なしのまま残す

## 影響範囲

- `src/pages/beta/matches/create.tsx`（エントリー選択 UI）
- `scripts/generate-beta-matches-json.mjs`（siteLink 付与・追記型化・上限撤廃）
- `src/pages/beta/matches-results/[matchId]/index.tsx` / `src/pages/matches/**`（siteLink 表示、URL 再構築廃止）
- 大会ページ・選手ページ（逆引き表の表示）
- `lib/tournamentHelpers.ts` / `lib/tournamentClientHelpers.ts` / `lib/players.ts`（ヘルパー統一）

## Open Questions

- 試合詳細 URL の ID を UUID のまま使うか、読める slug にするか（インデックス開始前が最後の変え時）
- 逆引き表の置き場所とファイル分割（全選手 1 ファイルで足りるか）
- 手入力フォールバック試合に後から `siteLink` を付与する導線を作るか
