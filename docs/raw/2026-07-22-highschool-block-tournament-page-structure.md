# 高校総体 地方（地区）大会 ページ構成・決定事項

日付: 2026-07-22
位置づけ: [2026-07-22-idea-highschool-block-tournament-data.md](./2026-07-22-idea-highschool-block-tournament-data.md) の続き。「どのページを・どんな構造で作るか」だけを決定事項ベースで一覧化する作業メモ。まだ発散フェーズにつき、ここに書いたページ・構造はすべて未確定（要決定）。

## ここまでに固まっている前提

- 地区大会は勝ち上がり式の予選ではない（インターハイ出場に影響しない）。id・文言に `-qualifier` は使わない
- `data/prefectures.json` の `region` を8→9区分に更新する（東海・北信越を分割、関東は東京を含む）。`region` は表示・グルーピング専用と確認済みなので変更自体は安全
- `local_index.json` は **Option B** で進める: 既存 `federationId`（都道府県専用）はそのまま残し、ブロック用に別フィールド（仮 `blockId`）を新設する。既存コードの暗黙の前提（`federationId` = 都道府県）を壊さない
- ルーティングは `/tournaments/block/[blockId]`（`/tournaments/local/[federationId]` とは別の兄弟ルート）

## ページ一覧と決定事項

| ページ | 状態 | 役割 | 決定が必要な点 |
|---|---|---|---|
| `/tournaments/local`（都道府県一覧） | 既存・改修候補 | region見出し＋都道府県カード | region見出し（`<h2>`）を `/tournaments/block/[blockId]` へのリンクにするか。する場合、都道府県カードと見た目でどう区別するか |
| `/tournaments/block`（ブロック一覧） | **新規・要否未定** | 9ブロックへの入口 | `/tournaments/local` の見出しが実質的に入口を兼ねるなら省略できる。SEO上の独立ランディングとして価値があるかどうかで要否が変わる |
| `/tournaments/block/[blockId]`（ブロック別ページ） | 新規 | ブロック単体の大会・年度別結果一覧 | `/tournaments/local/[federationId]` とほぼ同型構造（`TournamentCard`等を流用）を想定。「連盟公式サイト」相当のリンク（都道府県版は`federations.json`）に対応するデータが無い＝地区高体連サイト等を別途持つか、リンク自体を省略するか |
| `/highschool/**`（高校カテゴリ一式） | 既存 | 高校の公開ページ群 | 地区大会を**統合しない**方向に傾いている（後述）。統合しない場合、下記の高校カテゴリ内の機能には一切含めない |
| `/tournaments`（大会一覧トップ）・`TournamentSearchTable` | 既存・要改修 | 大会横断検索。「開催地」フィルタの選択肢は現状47都道府県のみ | ブロックの大会も一覧に出す場合、フィルタの選択肢にブロックを足すか（足さないと一覧には出るが絞り込みでは拾えない） |
| `/tournaments/[generation]/[tournamentId]/[year]/.../[gender]`（年度別結果詳細） | 既存・要改修 | パンくずで `federationId` → 都道府県名 解決 | `blockId` を使う場合はこのページの解決ロジックにブロック名の解決も追加する必要あり（現状は都道府県のみ解決、対応しないと当該部分のパンくずが欠落） |

## データ構造の決定事項

- `data/prefectures.json`: `region` 値を8→9区分に再割当（都道府県ごとの所属変更）
- `data/tournaments/federations.json`: `region` の重複コピーも合わせて更新するか（現状コードからは未参照だが、データの一貫性のため揃えるかどうか）
- **新規データ**: ブロックのマスタ（id・名称・所属都道府県一覧・地区高体連公式URL等）
  - 置き場所が未定: `data/prefectures.json` に統合するか、`data/tournaments/blocks.json` のような別ファイルにするか
- `data/tournaments/local_index.json`: 新フィールド（仮 `blockId`）を追加する。既存47件の `federationId` エントリには影響しない設計
- `data/tournaments/information/{tournamentId}.json` / `details/{tournamentId}/{year}/{categoryId}.json`: 既存フォーマット（全国大会・県予選と同型）をそのまま使う想定。変更不要
- `tournamentId` の命名規則: 「予選」ではないため `-qualifier` は使わない（例: `highschool-tohoku-block` など、要確定）

## 高校カテゴリ統合の決定事項（ここが一番揺れている）

ユーザーは「いっそ分けたほうがいい」方向に傾いている。分ける場合、地区大会は `/tournaments` 配下の汎用機能として完結させ、高校カテゴリ側の以下の機能には一切含めない。

- 強豪校ランキング（`lib/highschoolRanking.ts`）の加点対象 → 含めない（既存方針を維持）
- 都道府県ページの「直近1年の主要大会結果」表示 → 含めない
- 「主な卒業生」集計（`lib/highschoolAlumni.ts`）の在籍判定対象 → 含めない
- 学校ページからの内部リンク → 地区大会結果へは張らない

分けない場合は、上記4点それぞれについて個別に「含める/含めない」を決める必要があり、判断コストが上がる。**分ける方針の方が決定事項が減り、スコープも明確**という点はメリットとして書いておく。

## 未決定の実装詳細（技術メモ）

- 北海道はブロックと都道府県が1対1で重なるため、ブロックID `hokkaido` は都道府県ID `hokkaido` と衝突する。`block-hokkaido` 等の別IDにする
- `/tournaments/block` の index ページを作らない場合、`/tournaments/block/[blockId]` へのサイトマップ登録・内部リンク導線は `/tournaments/local` の見出しリンクのみに依存することになる。それで十分かは要検討

## 優先順位（① SEO → ② UX → ③ 技術的負債を残さない）による決定（2026-07-22）

ユーザーの優先順位指定に基づき、各決定事項を以下の通り確定する。

| 決定事項 | 決定 | 理由（優先順位別） |
|---|---|---|
| `/tournaments/local` のregion見出しをブロックへのリンクにするか | **する** | ①新規ブロックページへの内部リンク経路を増やし、クロール・評価流入を作る。②UXとしても都道府県→地区の関係が直感的に伝わる。③改修コストは低い（`<h2>`を`<Link>`に変えるのみ） |
| `/tournaments/block`（ブロック一覧）を作るか | **作る（`TOURNAMENTS_SUBNAV`にも追加）** | ①「地区大会 結果」系の検索意図に対して`/highschool/tournaments`と同型の専用ハブを与える方が、`/tournaments/local`（都道府県軸）に間借りさせるより意図に一致し評価が集中しやすい（既存の「専用ハブに検索面を寄せる」方針と整合）。②迷わず9ブロックに辿り着ける入口になる。③`/tournaments/local/index.tsx`とほぼ同型で作れるため追加コストは小さい |
| ブロック別ページの「連盟公式サイト」相当リンク | **データ項目としては用意し、値は分かる範囲で埋める（無くてもページは成立する既存パターンを踏襲）** | ①外部権威リンクはSEO上あって困るものではないが必須ではない。②あれば情報源として使いやすい。③都道府県版の`officialUrl?`と同じ「無ければ非表示」の条件分岐を流用すればゼロコスト |
| `/highschool/**`（ランキング加点／都道府県ページの主要大会表示／主な卒業生集計／学校ページ内部リンク）への統合 | **統合しない（分ける）** | ①地区大会はブロックごとにPDF入手状況が揃わない可能性が高く、ランキング等の全国横断集計に混ぜると「収録有無で強豪校判定が歪む」データ品質リスクがあり、既存ページの信頼性（＝SEO評価の土台）を損ないかねない。②ユーザーにとっても「これは何の成績か」の見分けが付きやすくなる。③ランキング・卒業生ロジックへの分岐追加が不要になり、負債が最も残らない選択 |
| `TournamentSearchTable`の「開催地」フィルタにブロックを反映するか | **反映する（ブロックの大会も一覧に出す前提なら、フィルタ選択肢にも必ず追加）** | ①フィルタ自体のSEO影響は小さい。②一覧には出るのに絞り込みだけ効かない状態はユーザー体験として明確な不整合＝直すべき。③直さず放置すると「一見動きそうで動かない」既知のバグとして残ってしまう＝③の観点から見送り不可 |
| 年度別結果詳細ページのパンくずで `blockId` → ブロック名の解決を追加するか | **追加する（必須）** | ①パンくず（`BreadcrumbList`構造化データ）はSEOの評価経路そのもの。②ここが欠けると地区大会ページへの遡上導線が消える。③実装せず放置すると「都道府県だけ効いてブロックは効かない」という不整合が静かに残り続ける＝③の観点からも必須 |

まとめると、①②③のいずれで見ても判断が割れた項目は無かった（`/highschool`統合のみ、①③が特に強く「分ける」を後押しし、②も同じ方向）。北海道のID衝突回避（`block-hokkaido`等）は優先順位に関わらず技術的に必須対応のため、上表には含めていない。

## 次のアクション候補

1. ~~上記の「決定が必要な点」を1つずつ確定させる~~ → 上表で確定済み（2026-07-22）
2. ~~データ構造（`region`8→9区分再割当・ブロックマスタの置き場所・`local_index.json`への`blockId`追加）の実装に着手する~~ → **実装済み（2026-07-22）**、詳細は下記「実施結果」参照
3. まず1ブロック・1年度分のデータで `tournament-pdf-to-players` skill を使った通し確認を行う → **着手（2026-07-22）**。近畿地区・男子ダブルスのPDF（`2026-3 kinnki dan ko.pdf`）を変換中

## 保留アイデア: `/highschool` からのナビゲーションリンク（2026-07-22）

データ統合（ランキング加点・都道府県主要大会表示・卒業生集計・学校ページリンク）はしない方針で確定済みだが、それとは別に「データは混ぜず、単なる案内リンクとして`/highschool`のどこかから`/tournaments/block`へ導線を置くか」は未決定のまま保留にした。

- 既存の県予選（`/tournaments/local`）も現状`/highschool`からリンクしていないため、何もしない場合は既存パターンと一貫性がある
- 追加する場合も、ランキング等のロジックには一切影響しない単純なナビゲーションなので、リスクは低い
- ユーザー判断待ち。次に触るときに要否を決める

## 実施結果（2026-07-22）

上表の決定事項をすべて実装した。

- `data/prefectures.json`: `region` を8→9区分に再割当（中部→東海／北信越に分割、山梨は関東へ、九州・沖縄→九州に統一）
- `data/tournaments/federations.json`: 同様に `region` を9区分に同期（併せて三重県の region 不整合＝旧データでは近畿表記だったものも東海に修正）
- 新規 `data/tournaments/blocks.json`: 9ブロック（`id`/`name`/`prefectureIds`/任意の`officialUrl`）。北海道ブロックは `hokkaido-block`（都道府県ID `hokkaido` との衝突回避）
- `src/pages/tournaments/local/index.tsx`: region見出し配列を9区分に更新し、対応するブロックがあれば見出しを `/tournaments/block/[blockId]` へのリンクにした
- 新規 `src/pages/tournaments/block/index.tsx`: 9ブロック一覧ページ（`/tournaments/local/index.tsx` と同型構造）
- 新規 `src/pages/tournaments/block/[blockId]/index.tsx`: ブロック別ページ（`/tournaments/local/[federationId]/index.tsx` と同型。対象都道府県一覧から `/tournaments/local/{id}` への内部リンクも追加）
- `src/types/tournament.ts`: `TournamentIndexEntry` に `blockId?: string` を追加
- `src/pages/tournaments/index.tsx`: `LocalTournamentIndex` 型に `blockId?: string` を追加（`federationId` は任意化）。`level` 判定に `t.blockId` があれば `'block'` を割り当てるロジックを追加。`prefectureId` は `federationId` が無い場合その年の開催地（`info.location`）から逆引きするフォールバックを追加（フィルタで拾えなくなる問題を回避）。`TOURNAMENTS_SUBNAV` に「地区大会」を追加
- `src/pages/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]/index.tsx`: `blockId`→ブロック名の解決を追加し、パンくずに「地区大会 › {ブロック名}地区」を出す分岐を追加（`federationId`/`prefectureName` の既存ロジックと並列）
- 検証: `tsc --noEmit` でエラー0件、`eslint` で対象ファイルの新規エラー0件（既存の環境依存 warning のみ）、JSON全ファイルの構文検証OK
- 未実施（意図的にスコープ外）: 実際の `local_index.json` へのブロック大会エントリ登録・`information`/`details` データ投入は、実PDFデータが無いため行っていない（架空データを作らない方針）。ブロック別ページは現状すべて「現在登録されている大会はありません。」表示になる

## 関連

- [2026-07-22-idea-highschool-block-tournament-data.md](./2026-07-22-idea-highschool-block-tournament-data.md) — 本件のアイデア本体・経緯
- [../wiki/tournaments-local.md](../wiki/tournaments-local.md) — `/tournaments/local` の既存仕様
- [../wiki/highschool.md](../wiki/highschool.md) — 高校カテゴリの公開ページ方針
