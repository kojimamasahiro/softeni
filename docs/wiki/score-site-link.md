# Score Site Link（試合詳細と本体の相互リンク）

ステータス: 実装済み（2026-06）。掲載大会に紐づく試合詳細を本体ドメインの indexable な
ネスト URL で公開し、大会ページ・選手ページと相互リンクする。

## 実装サマリ（2026-06）

- siteLink 解決: `lib/siteLink.mjs`（`resolveMatchSiteLink`）
- 公開 JSON 生成: `scripts/generate-beta-matches-json.mjs`
  - 50 件上限を撤廃（全件取得）、出力ディレクトリの全削除をやめ追記型に変更
  - 各試合に `siteLink`（`{ tournamentPath, entryNos }`）をベイク（野良は null）
  - Supabase 無し（snapshot 再利用）でも siteLink を再付与するため、`npm run prebuild` で既存試合を移行できる
- 型: `src/types/database.ts` の `MatchSiteLink` / `Match.siteLink`
- URL 振り分け: `lib/siteConfig.ts` `getPublicMatchDetailPath(match)`（siteLink 有無で分岐）
- ネストページ: `src/pages/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]/matches/[matchId].tsx`
  - 試合詳細コンポーネントは `/beta/matches-results/[matchId]` と共通
  - 静的パスは `lib/betaMatchesStatic.ts` `getSiteLinkedMatchPaths()`
- 逆引き表: `scripts/generate-match-reverse-index.mjs` → `public/data/beta-matches/reverse/{by-tournament,by-player}.json`
  - 読み出し: `lib/matchReverseIndex.ts`
  - 表示: 大会ページ・選手結果ページに「スコア詳細のある試合」セクション
- sitemap: `next-sitemap.config.js` の `additionalPaths` でネスト URL を追加
  （深いネストの動的 SSG ルートを next-sitemap が自動列挙しないため）
- 作成 UI のエントリー選択: `src/pages/beta/matches/create.tsx` + dev 専用 API `src/pages/api/tournament-entries.ts`
- prebuild 連鎖: `generate-beta-matches-json` → `generate-match-reverse-index`

野良試合（siteLink なし）は従来どおり `/beta/matches-results/[matchId]`（noindex）に残す。

### 未了（仕様ドラフト §6 との差分・2026-06 時点）

実装が source of truth。下記ドラフト「6. 共有ヘルパーの統一」は**未実施**で、コードと乖離している。

- `generateTournamentUrlFromMatch` は `lib/tournamentHelpers.ts` / `lib/tournamentClientHelpers.ts` に**二重実装のまま残存**し、`src/pages/beta/matches-results/index.tsx` と `.../[matchId]/index.tsx` で現役利用中。
- canonical / ネスト URL は `getPublicMatchDetailPath`（`siteLink` ベース）で生成しており正だが、`/beta/matches-results` 側の大会リンクはまだ旧ヘルパー経由。
- ドラフト §6・影響範囲の「二重実装の削除」「表示側 URL 再構築の廃止」は今後の整理対象（Open Question 扱い）。

設計の意図・決定の経緯は以下を参照。

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

### 7. URL（掲載大会試合と野良試合を分離）

掲載大会に紐づく試合と、どの掲載大会にも紐づかない試合（野良試合: 練習試合・未収録大会）を、別空間として扱う。

#### 掲載大会に紐づく試合（indexable 公開面）

- URL は大会ページ配下にネストする
  - `/tournaments/{generation}/{tournamentId}/{year}/{gameCategory}/{ageCategory}/{gender}/matches/{UUID}`
  - 例: `/tournaments/all/zennihon-mixed/2026/doubles/none/mixed/matches/2157f9e2-9232-4602-86de-a9a24d123eec`
- 末尾は素の UUID（試合 ID）。プレフィックスがパス自体で文脈を語るため、slug 化（可読化）は不要
- このネスト URL は飾りではなく階層そのものなので、間違っていてはいけない。URL プレフィックスは**作成時に大会データから引いた検証済み `siteLink` からのみ生成する**。試合レコードのフリーテキスト由来フィールド（`tournament_gender` 等）からは組まない
- 生成時に `data/tournaments/details/**` に実在するカテゴリかを検証し、解決できない試合はネスト側に出さず警告を出す
- `ageCategory` は大会データ（カテゴリファイル名 例: `singles-none-boys.json`）から取得する。試合レコードの `'none'` 決め打ちは使わない
- canonical / OGP / sitemap / パンくず構造化データはこのネスト URL を正とする
- 実装ルート（案）: `src/pages/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]/matches/[matchId].tsx`。既存の試合詳細コンポーネントを再利用し、getStaticPaths を `siteLink` を持つ試合から生成する

#### 野良試合（当面 noindex）

- 当面 `/beta/matches-results/{UUID}`（noindex）に残す
- score ドメイン戦略が固まった段階で score サイトの `/matches/{UUID}` へ移す方針。本リリースでは急がない
- 責務分離: 掲載大会分は本体サイトの資産、野良試合は記録ツールの出力

#### 大会紐付けを間違えて作成した場合

- ネスト URL はプレフィックスに大会情報を含むため、紐付けを修正すると URL が変わる
- リダイレクトでの URL 引き継ぎは行わない。**既存試合を削除し、内容はそのまま新規作成し直す**運用とする
- エントリー選択式の作成フロー（仕様 3）により誤紐付けの頻度自体を下げる

### 8. URL 解決と振り分け

- `getPublicMatchDetailPath` を `siteLink` の有無で分岐させる
  - `siteLink` あり → ネスト URL
  - `siteLink` なし → 野良試合 URL（`/beta/matches-results/{UUID}`）
- 末尾 UUID がそのままファイルキー（`matches/{UUID}.json`）なので、URL→データの解決は末尾切り出しで済む（slug→UUID の解決表は不要）

## 既存データの移行

- 既存 15 試合は entryNo・tournament_id が揃っているため、移行スクリプトで `siteLink` を一括付与する
- entryNo ペアが大会データ側で解決できない試合は `siteLink` なしのまま残す

## 影響範囲

- `src/pages/beta/matches/create.tsx`（エントリー選択 UI）
- `scripts/generate-beta-matches-json.mjs`（siteLink 付与・追記型化・上限撤廃）
- `src/pages/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]/matches/[matchId].tsx`（新規・掲載大会試合の indexable ページ）
- `src/pages/beta/matches-results/[matchId]/index.tsx` / `src/pages/matches/**`（野良試合表示、URL 振り分け、URL 再構築廃止）
- 大会ページ・選手ページ（逆引き表の表示）
- `lib/tournamentHelpers.ts` / `lib/tournamentClientHelpers.ts` / `lib/players.ts`（ヘルパー統一）

## 決定事項

- 試合詳細 URL の ID は UUID を維持し、slug 化はしない（掲載大会試合はネスト URL がパスで文脈を語るため可読化不要）
- 掲載大会試合と野良試合を別空間に分離する（ネスト URL / `/beta/matches-results`）
- 大会紐付けの誤りは削除→新規作成し直しで対応し、リダイレクトでの URL 引き継ぎはしない

## Open Questions

- 逆引き表の置き場所とファイル分割（全選手 1 ファイルで足りるか）
- 手入力フォールバック（野良）試合に後から `siteLink` を付与して掲載大会試合へ昇格させる導線を作るか
