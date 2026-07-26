# アイデア: 高校総体 地方（地区）大会結果の掲載

## 状況

Idea Backlog。発散フェーズ（2026-07-22）。ユーザーが高校総体の各地方における組み合わせ（ドロー表）PDFを発見し、高校カテゴリへの掲載方法を検討中。大会一覧（`/tournaments`）側の設計も合わせて考慮したい。

## 目的

高校カテゴリに、都道府県予選と全国大会（インターハイ本大会）の間にある「地方（地区）大会」の結果を追加したい。

## ユーザーが興味を持った点

- 「地区大会はインターハイの予選ではなく、おそらく国体に少しつながると思われるので、予選としては違うと思う」— 地区大会の位置づけについて、当初の想定（インターハイ予選）と異なる可能性があるという指摘。ユーザー自身「おそらく」と留保しており未確定情報
- 「これを機に`data/prefectures.json`を分けてもいいと思う。そうすると、地方大会にしてもいいか検討したい」— `prefectures.json`の地域区分を見直すことで、地区大会をfederation的な仕組みに乗せられないか、という発展の方向性

## わかっていること

既存の掲載構造を確認済み。現状は2層＋空白1層:

- **全国大会**（`highschool-championship` / `highschool-senbatsu` / `highschool-japan-cup`）: `data/tournaments/index.json`（`generationId: "highschool"`）に登録し、`data/tournaments/details/{tournamentId}/{year}/{categoryId}.json` に内部結果を持つ。`/highschool/tournaments` の元データ（`lib/highschoolNationalTournaments.ts`）
- **県予選**: `data/tournaments/local_index.json` に `federationId`（都道府県単位）で登録し、`sourceUrl` のみを持つ半自動パイプラインが既にある（`scripts/crawl-local-tournaments.mjs` → `scripts/apply-accepted-qualifiers.mjs`。id規則は `highschool-{prefectureSlug}-interhigh-qualifier`）。ただし現状 `local_index.json` に該当エントリは0件（未反映）
- **地方（地区）大会**: 対応する層が存在しない

その他の関連事実:

- `data/prefectures.json` は都道府県ごとに `region`（8区分: 北海道/東北/関東/中部/近畿/中国/四国/九州・沖縄）を持ち、`/tournaments/local` の表示順・グルーピングに使われている（`docs/wiki/tournaments-local.md`）
- `tournament-pdf-to-players` skill で組み合わせPDF → `initialPlayers` 形式JSONへの変換に対応済み（個人戦ダブルス／団体戦の両方）

### 追記（2026-07-22、ユーザー確認＋調査）

- **地区大会の性質が判明**: 高校総体（インターハイ）の一部ではあるが、地区大会で勝ち上がってもインターハイ出場には影響しない（ユーザー確認）。県予選とは異なり「勝ち上がり式の予選」ではない。国体との関連は引き続き未確定
- **区分数を確認**: 高校総体の地区大会区分は **9ブロック**（北海道／東北／関東〈東京・山梨を含む〉／北信越／東海／近畿／中国／四国／九州〈沖縄を含む〉）。中部が東海・北信越に分かれ、関東と東京は分かれない。zutto-sports.com の地区大会組み合わせページで確認（ユーザーの「9区分」認識と一致。全国高体連の一次資料での裏取りは未実施）
- **`region` フィールドの利用箇所を全数確認**（表示・グルーピング専用、データ結合や集計には未使用）:
  - `src/pages/tournaments/local/index.tsx`（8区分の表示順を**ハードコード配列**で保持し、都道府県をグルーピング）— 主要な参照元
  - `src/pages/highschool/[gender]/index.tsx`（`region` で都道府県をグルーピング表示。ハードコード配列は無く `prefectures.json` の並び順に依存）
  - `data/tournaments/federations.json` に `region` の重複コピーがあるが、コード上どこからも読まれていない（未使用）
  - `[federationId]/index.tsx` 系のページでは型定義に `region` はあるが本文で未使用
  - → 8→9区分への変更自体は安全（表示専用）だが、`prefectures.json` の値・`federations.json` の重複値・`tournaments/local/index.tsx` のハードコード配列の**3箇所**を同期させる必要がある
- **`/tournaments/local/[blockId]` 案のルーティング制約**: 現状 `src/pages/tournaments/local/` 配下の動的セグメントは `[federationId]` のみ（Pages Router）。Next.js の Pages Router は同一階層に異なる名前の動的セグメントを共存できない仕様のため、`[federationId]` と `[blockId]` を兄弟フォルダとして追加することはできない（ビルド時エラーになる）。回避策:
  - a) パラメータ名を共通化（例 `[scopeId]`）し、値が都道府県IDかブロックIDかをコンポーネント内で分岐する
  - b) 1階層ネストする（例 `/tournaments/local/block/[blockId]`）。既存 `[federationId]` に触れず追加できる
  - c) 別のトップレベルルートにする（例 `/tournaments/block/[blockId]`）
  - ユーザーの「都道府県ごとの大会と区分ごとの大会の区切りにする」という意図には b) が最も素直に沿う

## 課題・未解決

- ~~地区大会の性質が未確定~~ → **一部判明**（2026-07-22）: インターハイの出場可否には影響しない（勝ち上がり式の予選ではない）。国体との関連は引き続き未確定
  - 「予選ではない」という前提に立つなら、命名は `-qualifier` サフィックスを避け、単に大会名ベースの id にすべき
- **掲載方式の方向性が固まりつつある**: `region` を8→9区分に更新した上で、`data/prefectures.json` の地域区分を県予選と同じ「federation的な仕組み」に載せ、`/tournaments/local` 配下に地区大会用のページを追加する方向（ユーザー案）
  - `region` は表示・グルーピング専用と確認済みなので8→9化自体は安全。ただし `prefectures.json` / `federations.json`（重複コピー）/ `tournaments/local/index.tsx` のハードコード配列の3箇所同期が必要
  - `/tournaments/local/[blockId]` はNext.js Pages Routerの制約（同一階層に異なる動的セグメント名を共存できない）で `[federationId]` と兄弟にできない。ネスト（`/tournaments/local/block/[blockId]`）等の代替案が必要（詳細は上記追記）
- 大会一覧（`/tournaments`）側の見せ方・データ登録方式（`local_index.json` を地区大会にも使うか、専用の仕組みにするか）は上記のルーティング方針が決まってから設計する

## 目指したい方向性

発散フェーズから収束方向へ移行中。次の一歩の候補:

1. `data/prefectures.json` を8→9区分に更新する方針を確定する（`region` 値の再割り当て＋3箇所の同期）
2. ルーティング方式（a: 共通パラメータ名 / b: `/tournaments/local/block/[blockId]` ネスト / c: 別トップレベルルート）を決定する
3. 地区大会のデータ登録方式（`local_index.json` の `federationId` にブロックIDを許容するか、専用フィールドを設けるか）を決める
4. 決まった方式で、まず1ブロック・1年度分を `tournament-pdf-to-players` skill で変換して通し確認する

## 関連

- [2026-07-22-highschool-block-tournament-page-structure.md](./2026-07-22-highschool-block-tournament-page-structure.md) — ページ構成・決定事項の一覧（2026-07-22 追加）
- [Tournaments Local](../wiki/tournaments-local.md) — 県予選の federationId ベースの掲載方式・半自動パイプライン
- [Highschool Pages](../wiki/highschool.md) — 高校カテゴリの公開ページ方針、全国大会歴代記録ページ
- `tournament-pdf-to-players` skill — ドロー表PDF → initialPlayers JSON変換

## 参考文献

(なし、次の一歩で地区高体連公式サイト等を調査予定)
