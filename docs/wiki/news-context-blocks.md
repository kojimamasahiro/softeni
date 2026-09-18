# 文脈ブロック / 速報・プレビュー機能

> **適用範囲: 混在**。「文脈ブロックを一次成果物にする」「言えないことは書かない」「照合キーの結合度で
> 安全性が決まる」は汎用。種目・ペアの扱いはソフトテニス固有。
> **2026-09-18 に現在の仕様だけへ圧縮した。** 実測値・監査ログ・決着の経緯は
> [raw/2026-09-18-wiki-archive-news-context-blocks.md](../raw/2026-09-18-wiki-archive-news-context-blocks.md)。

## 概要

時事系（速報・プレビュー）流入を、運用負荷を上げずに獲得するための機能群。
本質的価値は「記事生成」ではなく **「文脈ブロック生成」**——テンプレ SEO サイトでも結果記事は作れるが、
大会・選手・試合データを横断した文脈は再現が難しい。よって**文脈ブロックを一次成果物**とし、
記事はその再利用先の一つとして扱う（[ADR-005](../adr/ADR-005-news-context-block-architecture.md)）。

```
大会データ → イベント抽出（初優勝/連覇/王者撃破 など） → 文脈ブロック生成（一次成果物）
          → 再利用先: 大会ハブ / 年度別結果ページ / 選手ページ / 記事
```

**`/news` は大会前の preview 専用**。結果記事（result）は [ADR-010](../adr/ADR-010-retire-result-articles-consolidate-to-hub.md) で廃止し、
結果・優勝・歴代まとめは大会ハブ（高校全国大会は高校歴代ページ）に一本化した（[seo.md](./seo.md) #8）。
旧 result URL は `public/_redirects` で 301。記事ツリーを `/tournaments/.../preview` に置かないのは、
既存大会ページとのカニバリ距離が近いため。

## 設計原則

- データ取得は**完全手動入力**のまま。自動化するのは生成だけで、外部速報元の自動クロールはしない。
- 本文は LLM を使わず**テンプレートのみ**で決定的に生成する（誤り混入ゼロ・低コスト・鮮度シグナル安定）。
  **例外は大会インサイトだけ**——機械照合を通った LLM 執筆の散文は載せてよい
  （[ADR-012](../adr/ADR-012-llm-authored-insights-with-machine-verification.md)、仕様は
  [tournament-insights.md](./tournament-insights.md)）。バッジ・文脈ブロック本体はテンプレートのみ。
- 記事の公開は **human-in-the-loop**。生成スクリプトは `state: "draft"` を作り、人が
  `data/news/<articleId>.json` の state を `published` に変えると公開される（承認 UI は未実装）。
- 既存ページへのブロック差し込みは決定的生成なのでビルド時に自動。
- **`articleId` は `{tournamentId}-{year}`**（`scripts/generate-news-drafts.mjs` が生成）。`type` は含めない。

## 実装状況

**実装済み**: `historical-winners` / `milestone`（`repeat-title` / `first-title` / `champion-defeat` /
`giant-killing`）/ `career-record` / preview 記事 / 大会ハブ・年度別結果ページ・選手ページへの差し込み /
`priorMeetings`（直近の対戦）。

**未実装**: `head-to-head`（優先度C）、`career-wins` / `best4-first` / `first-appearance`
（型と `MILESTONE_PRIORITY` の席はあるが、キャリア通算の判定なので名寄せ未整備がブロッカー）、承認 UI、
`seed-vs-result`（優先度B）。

| 何 | どこ |
|---|---|
| 歴代優勝者・連覇判定 | `lib/tournamentRecords.ts` |
| 節目イベント | `lib/milestones.ts` |
| 通算成績 | `lib/careerRecord.ts` |
| 直近の対戦 | `lib/priorMeetings.ts` |
| 記事レコード・ビュー | `lib/newsArticle.ts` / `src/pages/news/*` / `scripts/generate-news-drafts.mjs` |
| 差し込み | `TournamentContextBlocks.tsx` / `ResultContextBlocks.tsx` / `PlayerCareerHighlights.tsx` |

`historical-winners` は既存の高校歴代ロジック（`lib/highschoolNationalTournaments.ts`）を大会非依存に
一般化したもの。ゼロから作らない。

## milestone の判定規約

- **個人戦（シングルス/ダブルス）は「選手個人」単位**で判定する。ダブルスはペア単位ではなく各選手を
  それぞれ主役にし、パートナーが替わっても本人が連続開催で優勝していれば連覇、本人が掲載範囲で優勝歴
  ゼロなら初優勝（同じ年に「A 連覇」と「B 初優勝」が並ぶ）。**団体戦は校（`championKey`）単位**。
- 比較は `championIncludesPlayer()`＝`playerKeys`（正規化済み「名前@所属」）一致 **または**
  `players`（フルネーム）一致。**連覇判定と first/nth 判定で同一の述語を使うこと**——
  片方だけ名前フォールバックを持っていた結果、所属変更を挟んだ連覇が「1年ぶり2回目の優勝」という
  矛盾ラベルになる不具合が起きた（2026-09-05 修正）。
  残リスク: 同一種目の歴代優勝者に同姓同名の別人がいると同一視する（1年1ペアと対象が狭いため許容）。
- **`label` / `shortLabel` に「性別＋種目」を前置する**（同一選手がシングルスとダブルスで別々に連覇する
  ため）。表記は `categoryId` から決定的に組み立てる（`genreGenderLabel()`）。
  `information` の `categoryLabel` は種目が落ちる揺れがあるので**使わない**。
- `champion-defeat`（王者撃破）は、前回王者が対象年に**出場し試合で敗退した**場合だけ、撃破した側を
  subject にする。不出場・無敗（連覇）では出さない。confidence は `confirmed` だが「前回王者」認定は
  掲載範囲依存なので scopeNote を添える。
- `giant-killing`（金星）は `data/ratings/upsets.json`（Elo 事前レートで期待勝率0.15以下の勝利）。
  **数字なしの定性表現のみ・実力指標は非公開**、scopeNote 必須。champion-defeat と同一試合なら金星を優先。
- 差し込み側の重複排除キーには主役（`subject.display`）を含める。選手ページは主役名で当該選手のイベントのみ採用。

## プレビュー記事の構成

curated 注目選手は**廃止**（curated が少なく実質ゼロ件で見出しと中身が乖離していた）。
掲載エントリー＋前年/直近データの照合だけで決定的に出せる6ブロックを `lib/newsArticle.ts` で算出する。

| # | ブロック | 中身 |
|---|---|---|
| ① | 連覇・防衛ウォッチ（`titleDefense`） | 前回王者の出場可否。`intact` / `partial`（片方のみ継続）/ `split`（双方が別ペアで継続）/ `absent` |
| ② | 前回入賞者の再登場（`returningPlacers`） | 前年の準優勝〜ベスト8で今大会も出場（優勝は①が扱う） |
| ③ | 過去の優勝者の再挑戦（`returningFormerChampions`） | 前々回以前の歴代優勝者で今大会も出場 |
| ④ | 直近大会の好成績者（`recentAchievers`） | 直近の他大会でベスト4以上。個人・団体の両方 |
| ⑤ | 出場規模・勢力図（`fieldOverview`） | エントリー数・都道府県別・複数エントリー校 |
| ⑥ | 直近の対戦（`priorMeetings`） | 出場者どうしが直近の他大会で既に対戦しているカード |

> **①②③④はすべて `buildFieldIndex`（`participants` / `entries` 由来の出場者集合）に依存する。
> `participants` が欠けると4ブロックが同時に沈黙する。** 実際、ドロー入力で不戦勝を `matches` に
> 出さない運用にしたところシードと足長が丸ごと欠落し、注目の選手が激減した。
> **これらが急に減ったら、ロジックより先に `participants` の件数を疑うこと**（個人＝エントリー数×2 / 団体＝エントリー数）。
> 入力側の扱いは [data-import.md](./data-import.md)「ドロー入力（結果を入れる前）の扱い」。

### 照合まわりの規約

- **所属変更のフォールバック**: 「名前@所属」照合が外れると partial 誤判定になるため、
  **今大会のエントリー内でフルネームが一意のときに限り**名前だけで entryNo を解決する
  （`uniqueEntryNoByName` / `resolveFieldEntryNo`）。同名が複数いればフォールバックしない。
  残リスク: 本人不在で同名別人だけが出場していると誤マッチする。
- **混成ペア（所属が異なるダブルス）**: 照合は `ChampionEntry.playerTeams` を使い「名前@本人の所属」で突合する
  （ペアのどちらかの所属と一致すれば継続、という旧実装は同名別人の誤マッチ要因だった）。
  表示は `teamDisplayOf` が null を返し、UI が選手ごとに「名前（所属）」を付ける。
- **所属校の表記揺れ吸収（`normalizeTeam()` / `cleanDisplay()`）は現在発火しない防御コード**。
  データ側が `scripts/normalize-team-names.mjs` ＋ `team-name-aliases.json` で正規化されるようになったため。
  コストがゼロなので撤去はせず、未正規化データの再流入に備えて残す。
- **ピックアップ選手の今大会の状況**（`EntryStanding`）: 進行中なら途中経過、敗退済みなら敗退を
  「今大会: ◯◯」バッジで出す（alive / eliminated / champion / runnerup）。データ源は当年・種目の
  `detail.results`（`rank.kind`。ADR-007）。**results 未掲載なら何も出さない**（graceful）。
- **前回ペアが分かれた場合**は `resolvePairFate()` が継続選手を entryNo 単位で解決し、
  partial / split では**今大会の実在ペアを主役にする**（前回ペアと解消の事実は注記へ）。
  ①は前回王者ヒーローカード（`TitleDefenseHero`）で主役化し、敗退・不在なら灰に落とす。
  同じ今大会ペアが複数の前回主役に由来する場合は1枚にまとめ、理由を複数行で持つ。

### ④直近大会の好成績者

- 窓は**開催日から3ヶ月以内・同一 `generationId`・最大2大会**で、**`isMajorTitle` を優先**
  （`findRecentTournaments`）。自大会は除外（前回入賞は②）。閾値は `lib/newsArticle.ts` の定数
  （`RECENT_WINDOW_MONTHS` / `RECENT_TOURNAMENT_LIMIT` / `RECENT_ACHIEVERS_PER_CATEGORY`=8）。
- 候補大会は `index.json` と `local_index.json` の**両方**を読む（地区大会は `local_index` にしか無い）。
- **`generationId` フィルタは必須**。外すと一般カテゴリの major が高校大会のプレビューを独占し、
  さらに世代跨ぎの同名別人（over65 の選手と高校生）が結びつく。
  **トレードオフ**: 高校生が一般大会で入賞した事実は拾えなくなる。名寄せ整備後に再検討する。
- 索引は個人=`playerMatchKey`・団体=`teamMatchKey` で分岐。**団体戦のキーには性別を含める**
  （校名だけだと男女の成績が同一キーに潰れ、反対の性別のセクションに出る。2026-09-07 修正）。
  キー生成は `buildMatchKeyBody()` に統合済み（二重実装の直し忘れを構造的に潰すため）。

### ⑥直近の対戦（`priorMeetings`）

**プレビュー記事と年度別結果ページが同じ索引を共有する**（一次成果物の再利用）。

- **ペア（名前セット）単位で照合するのが設計の肝**。選手単位の照合は同姓同名の汚染が約3%あり
  スコープを狭めても下がらないが、ダブルスのペア単位なら実測で曖昧性ゼロ。
  **誤マッチ率を決めるのはスコープの狭さではなく照合キーの結合度**（[team-player-identity.md](./team-player-identity.md)）。
- 照合キーは種目ごとに3種類（`entryKeyOf`）:

  | 種目 | キー | 性質 |
  |---|---|---|
  | ダブルス | 選手2名の名前セット | 最も安全。**所属が変わっても追跡できる** |
  | シングルス | `名前@所属` | 名前1つでは一意性が無いため所属を足す |
  | 団体 | `校名@都道府県` | 選手名を持たないため |

  **シングルスは構造的な保証が無い**（所属が変わると取りこぼす／同姓同名かつ同一所属は誤って同一視する）。
  これは許容する運用判断。所属不明のエントリは対象外。キーを作れないエントリは静かに落とす（graceful）。
- **再戦の状態**（`rematchStatus`）: `scheduled`（対戦カードあり・琥珀）/ `possible`（進行中で両者勝ち残り・緑）/
  `gone`（一方が敗退・灰）/ `pending`（まだ1試合も行われていない＝**バッジ無し**）/ `unknown`（結果未掲載）。
  - `pending` を分けるのは、開催前は `results` が `ongoing` で全ペアが alive になるため
    （そのまま「両者勝ち上がり中」と出すと事実に反する）。判定は `matches[].winnerEntryNo` の有無。
  - **`pending` にバッジを出さないのは、再戦が起こる可能性を計算できないから**。大会前は2回戦以降の
    試合レコードも `nextMatchId` も無く、`entryNo` をブラケット位置とみなす近似は的中率17〜42%だった。
    **言えないことは書かない。**
- **再戦が決着したら勝敗まで出す**（`currentResult`）。前回敗れた側が勝ったら**「雪辱」バッジ**を添える。
- **絞り込み**: ドロー上「**3回戦までに当たる**」組だけを載せる（`PRIOR_MEETING_MAX_ROUND_INDEX`）。
  地区大会で対戦した相手は全国のドローで意図的に離されるため、決勝でしか当たらない組を並べるのは誇大。
  **ただし実際に対戦カードが組まれた／決着したものは何回戦でも残す**。ドローを復元できない大会は絞り込まない。
- **候補の窓は「開催日から1年以内＋同一 `categoryId`」**（mixed は mixed としか照合しない）。
  **同一大会の前回開催は1年より前でも必ず含める**（開催日が年ごとにずれ、371日空いて落ちた実例がある）。
  件数は絞らない（地区大会が9件同時に該当するのが正常）。`index.json` と `local_index.json` の両方を読む。
- **`generationId` は完全一致のみ**。「同じ土俵の直近の対戦」に絞る運用判断で、世代跨ぎ（進学など）は許容して捨てる。
  解決できない大会は絞り込まない（候補ゼロより安全側）。
- 表示は `scheduled` → `possible` → `pending` → `unknown` → `gone` の順。`gone` を消さないのは
  「地区大会で対戦していた」事実自体が文脈として有効なため。常時表示は `PRIOR_MEETING_CARDS`(=6) 件、
  残りは `<details>`、配列は `PRIOR_MEETING_CARDS_MAX`(=50) で打ち切る（HTML 肥大を避ける。総数は `totalCards`）。
- **規模のサマリ文は出さない**（分母と分子が対応せず読み取れないため）。規模を語るのは大会ハブの役割。
- **見出しは「直近の対戦」**。供給元が今大会より格上のことがあるので「前哨戦」とは書かない。
- **出力先ごとに粒度を変える**（カニバらせない。[seo.md](./seo.md) #4 / #8）:
  プレビュー記事＝起こりうるカード＋カバレッジ／年度別結果ページ＝**実際に組まれた対戦だけ**／
  大会ハブ＝最新年度の**規模だけ**（詳細は年度別へ内部リンク）／選手結果ページ＝対戦相手の下に
  「◯◯大会 ◯年 ◯回戦の再戦（前回は勝利/敗戦）」の注記。
- **性能**: 選手ページ用の全大会横断索引は `loadAllPriorMeetings()` がプロセス内で1度だけ構築してキャッシュする
  （ページごとに `buildPriorMeetingIndex` を呼ばない）。`readEditions` も**必ずキャッシュする**。
- **meta description**: 前哨戦が算出できたときだけ一文足す（`defaultDescription`。分岐1箇所で戻せる）。

#### ブラケット復元（`lib/bracketLayout.ts`）

当たるラウンドは `entryNo`（ドロー順）と `entries[].type` から512枠のブラケットを復元して求める
（`matches` の `nextMatchId` は開催前には付かないため）。検証は `npm run bracket:verify`。

- **復元できない大会ではラウンド算出を諦める**（`null` を返す）。`entries[].type` の入力ミスで
  `packing` が奇数個になっている大会では席が1つずつずれ、後半のラウンドが丸ごと誤るため。
  検出は「パディング前のスロット数が2冪か」。入力側の検出は `tools/shared/validate-entries.js` の
  `bracket-slot-parity`（severity=`warn`。表示が graceful に諦めるのでビルドは止めない）。
- **`seed` / `extra` が0件でも、全件 `packing` かつ出場数が2冪なら復元できる**（bye が不要な大会）。
  **2冪チェックは必須**——無いと予選リーグ→決勝トーナメントの大会を誤復元する。
- **予選リーグを含む大会は `knockoutDraw`（(組, 組内順位) の並び）を情報源にする**
  （決勝Tの席はエントリーではなく組に属するため。[ADR-015](../adr/ADR-015-knockout-draw-by-group.md)）。
  完了済み大会の `knockoutDraw` は `npm run bracket:draw -- --apply` で `matches` から生成できる
  （書き込み前に合流ラウンドの検算を通す）。
- **本戦前に予選を1試合だけ持つ形式**は `entries[].type` の `preliminary`（枠を消費しない）で表す。
  予選敗者は本戦に席が無いので「◯回戦で当たる」を出さない。
- 「1回戦は隣接同士」は全データで例外なく成立している。

## その他の表示規約

- **選手名のリンクは id 系の結果ページ `/players/{id}/results/`**（`resolvePlayerId` が
  `data/players/index.json` を姓名一致・`count>=5` で解決。無ければ名前のみ）。
  **curated の slug プロフィールは使わない**（網羅できないため。[players-pages.md](./players-pages.md)）。
- **結果ページへのリンクは実在するときだけ張る**（`readYearDetail` があるときのみ `resultHref` を非 null に）。
- **OGP 画像**は `tools/sns-images/news_og.py` が**ローカル生成**し `public/og/news/` に git コミットする
  （本番ビルドに依存を増やさない）。`ogImage` のある記事だけ `summary_large_image` を出し、無ければ既定にフォールバック。
  ~~対象は result 記事~~ → result 廃止により**現状 preview の OGP は未対応**。
- **JSON-LD**: 記事の `NewsArticle` に、本文が実名言及する選手を `mentions`（`Person[]`）で載せる。
  ソースは `titleDefense.players` と `pickPlayers[].players`（`collectArticleMentions()`）。
  結果ページを持つ選手だけ `url` を付ける。

## Open Questions

いずれも**同じ根（同一人物を確実に同定できるか＝名寄せ）**に帰着する。

- `head-to-head` の導入可否。**ペア（ダブルス）単位に限れば現在の名寄せ水準でも安全**で、危険なのは
  (a) 選手単位に降ろしたとき (b) 世代を跨いだとき。**粒度ごとに個別に解禁可否を判断できる。**
- **世代をまたいだ選手照合の解禁条件**。目安は「`homonyms.json` の未登録が0になること」ではなく、
  **`homonyms.json` が id 分割としてアプリの選手解決に統合されること**（現状は1名前=1id のまま）。
- 未実装 milestone（`best4-first` / `career-wins` / `first-appearance`）の語彙確定。
  3種ともキャリア通算の判定なので、名寄せが前提として揃っていない。

## 決着済み

- **`articleId` の命名規約** → `{tournamentId}-{year}`。result 廃止で「昇格時に共有する安定 ID」の問い自体が消滅。
- **所属校名の表記統一** → データ側（`normalize-team-names.mjs` ＋ `team-name-aliases.json`）で解消済み。
- **大会改称をまたぐ歴代結合** → **`tournamentId` 単位で割り切る**。実データに改称事例が無く、
  年度間のラベル差はすべて回次。エイリアス table は実際に改称が起きた時点で作る
  （Assumption: 改称は `information[].label` の差分で検知できる）。

## 関連

- [ADR-005](../adr/ADR-005-news-context-block-architecture.md)（文脈ブロックを一次成果物にする判断）/
  [ADR-007](../adr/ADR-007-in-progress-tournament-standing.md)（途中経過を `results` に持つ）/
  [ADR-010](../adr/ADR-010-retire-result-articles-consolidate-to-hub.md)（result 廃止）/
  [ADR-012](../adr/ADR-012-llm-authored-insights-with-machine-verification.md)（LLM 執筆の例外）/
  [ADR-015](../adr/ADR-015-knockout-draw-by-group.md)（予選リーグの席順）
- [tournament-insights.md](./tournament-insights.md) / [sns-story-platform.md](./sns-story-platform.md)（展望記事の拡充アイデア）
- [data-model.md](./data-model.md) / [data-import.md](./data-import.md) / [seo.md](./seo.md) /
  [team-player-identity.md](./team-player-identity.md) / [ranking.md](./ranking.md)（Elo と金星）
- 設計の一次ソース: [親仕様](../raw/2026-06-21-news-auto-draft-design.md) /
  [Step1](../raw/2026-06-21-historical-winners-logic.md) / [Step2](../raw/2026-06-21-milestone-logic.md) /
  [Step3](../raw/2026-06-21-career-record-logic.md)
