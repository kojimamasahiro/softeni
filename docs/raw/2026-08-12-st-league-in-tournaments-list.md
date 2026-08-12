# 2026-08-12 STリーグを大会一覧／大会結果ページに載せられるか

## 発端

「大会一覧ページや大会結果ページにSTリーグの結果を載せることはできる？」

## 調べたこと

- 一覧（`/tournaments`）の `getStaticProps` は `index.json` + `local_index.json` +
  `information/{id}.json` だけで instances を作る。`details/` は
  「`hasInternalResult`」「`firstCategoryPath`」の判定に使うだけ。
  → **結果データが無くても一覧には出せる**。
- STリーグは `data/tournaments/index.json` に未登録なので、一覧に一切出ていなかった。
  実業団カテゴリ（`corporate`）は `zennihon-business-group` / `zennihon-workers` /
  `zennihon-club` の3件のみ。
- ハブ `/tournaments/[generation]/[tournamentId]` の `getStaticPaths` は
  「details のディレクトリ ∪ index.json/local_index.json の登録ID」で生成するので、
  details が無い大会を登録しても404にはならない（空状態になる）。
- 結果ページ（details）側のスキーマは round-robin 対応済み（`stage:"roundrobin"` + `group`、
  `results[].roundrobin`）。団体戦の前例もある
  （`details/highschool-championship/2025/team-none-boys.json` は participants の氏名が null で
  チーム行のみ）。つまり **STリーグを details 形式へ変換すること自体は可能**。

## 判断

A（一覧に載せる）を実施、B（details へ結果を複製）は見送り。

B を見送った理由:

1. tie の内訳（D1・S・D2の本数と出場選手）が details の `matches[].scores`
   （エントリー単位の数値）に収まらず、`/st-league/[year]/matches` より情報が薄くなる。
2. `/st-league/[year]/matches` と検索面がカニバる（年度ハブ vs matches で既にやった intent 分離と同型）。
3. 順位は `computeRanking()`（勝数→直接対決→得失点差）の算出値なのに、details 側は
   `results[].roundrobin.rank` を手で持つ形になり二重管理になる。

B の唯一かつ大きな利点は **Player Statistics Engine に乗ること**。現状 STリーグの
`matches.json` は選手DBに流れておらず（逆に `/st-league/[year]/teams` の選手成績は
一般大会 details から逆引きしている）、details に入れれば選手ページに「STリーグ戦績」が出せる。
選手DB連携が主目的になったら、公開URLを増やさない形（ハブを noindex）で改めて判断する。

## 実装

- `data/tournaments/index.json`: `st-league`（`corporate`、`featurePath: "/st-league/"`）を追加。
- `data/tournaments/information/st-league.json`: 2023・2024・2025 を新規作成。
  各年度に `resultPath: "/st-league/{year}/matches/"`。
  会場は `league.json` の `venue` / `location` から転記し、`prefecture` / `city` / `name` /
  `aliases` のみ（住所・電話・コート数は出典が無いので入れない）。
  `location` は都道府県名だけにする（一覧の `prefNameToId` 逆引きが都道府県名一致のため。
  `league.json` の "愛知県豊橋市" のままだと開催地フィルタから漏れる）。
- `src/types/tournament.ts`: `TournamentIndexEntry.featurePath?`、
  `TournamentInformationEntry.label?` / `resultPath?` を追加。
- `src/pages/tournaments/index.tsx`: `resultPath` があれば `firstCategoryPath` に採用し
  `hasInternalResult` も true にする（2つのループ＝全国系・地域系の両方）。
- `src/pages/tournaments/[generation]/[tournamentId]/index.tsx`:
  `featurePath` を props に追加し、(a) 誘導バナー、(b) `noindex, follow`、
  (c) yearGroups が空なら `information[].resultPath` から年度カードを合成、
  (d) 文脈ブロック（milestone / 優勝者通算 / 前哨戦）は details 由来なので作らない、を実装。

## 検証

- `npx tsc --noEmit` … パス。
- `next lint` … 対象3ファイルで rule 違反なし（`Resolve error: Failed to load native binding` の
  警告は環境側の `unrs-resolver` の問題で、変更とは無関係）。
- ノードで `information` × `index.json` の突き合わせを実測:
  2023/2024/2025 の3インスタンスが `corporate` / `hasInternalResult: true` /
  `prefectureId`（aichi・aichi・tochigi）で解決されることを確認。
- **未実施**: `npm run build` によるページ生成の確認。作業環境（サンドボックス）では
  `next build` も `next dev` も完走しなかった（プロセスが落ちる／コンパイルが時間切れ）。
  以下は手元で要確認:
  - `/tournaments/` に「第1回〜第3回STリーグ」の3行が出て、リンク先が
    `/st-league/{year}/matches/` になっていること
  - `/tournaments/corporate/st-league/` が生成され、`<meta name="robots">` が
    `noindex, follow` で、誘導バナーと年度カード（2023〜2025）が出ること
  - `out/sitemap-*.xml` に `/tournaments/corporate/st-league/` が**含まれない**こと
    （`postbuild` の `filter-noindex-from-sitemap.mjs` が HTML の meta を見て落とす想定）

## Compile Log

- docs/wiki/st-league.md に「大会一覧との連携」節として採用（実装内容・B を見送った理由・
  選手DB連携の Open Question）。
- docs/wiki/public-pages.md に `resultPath` の仕様と、ハブの `featurePath` 挙動を採用。
- docs/wiki/seo.md #3 に `featurePath` による横展開を1項目として採用。
- **除外**: サンドボックスで `next dev` / `next build` が落ちた顛末（環境固有で再利用価値が低い。
  本 raw に残すのみ）。
- **除外**: details のスキーマ調査の細部（`entries` / `matches` / `results` の具体形）
  … 既に data-model.md にあるため重複。
- **除外**: B を実施する場合の具体的な変換手順（まだ採用していない案の実装詳細で、
  先に書くと確定事項に見えるため。判断が変わった時点で書く）。
