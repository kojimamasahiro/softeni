# アイデア: 地区大会結果とインターハイnewsプレビューの連携

## 状況

Idea Backlog。発散フェーズ。2026-07-26に着想。

## 目的

地区大会（ブロック大会）の個人戦結果は、そのままでは強豪校ランキングや都道府県ページの
「直近1年の主要大会結果」に混ぜるには収録が薄い（保留中）。しかし別の切り口として、
全国大会（インターハイ）の`/news`プレビュー記事に「地区大会での好成績」を文脈情報として
出せないか、という着想。地区大会→全国大会という物語の連続性を活かせる可能性がある。

## ユーザーが興味を持った点

> 結果が充実していないため、現時点ではランキングや主要大会結果は含めるかは保留としたい。
> ただ、アイデアとして、インターハイのnewsページには何かしら連携できないか検討したいと思っている

## わかっていること

- `news-context-blocks`の④「直近大会の好成績者」(`recentAchievers`)が、まさにこの用途に
  近い既存機構としてすでにある。`lib/newsArticle.ts`の`findRecentTournaments()`が
  `data/tournaments/index.json`（`local_index.json`とは別の、全国・主要大会用マスタ）を
  横断し、プレビュー対象大会の開催日から遡って3ヶ月以内に開催された大会を拾い、
  そこでベスト4以上だった選手を「直近大会の好成績者」として出す設計。
- 9地区大会の2026開催日は関東(5/29)〜近畿(7/18)まで、すべてインターハイ(2026-07-31〜)の
  3ヶ月ウィンドウに収まる。時期的な相性はよい。
- この機構は`highschoolRanking.ts`の`RANKING_TOURNAMENTS`、`highschoolAlumni.ts`の
  `HS_TOURNAMENTS`、`highschool.ts`の`HIGHSCHOOL_TOURNAMENT_PRIORITY`（いずれも別ファイル・
  別allowlist）とは完全に独立している。よってランキング/卒業生集計への統合を保留する判断とは
  無関係に検討を進められる。
- 制約: `RECENT_TOURNAMENT_LIMIT = 2`で「直近大会は最大2件」に絞る設計。`isMajorTitle`優先→
  新しい順で選ぶため、9地区とも`isMajorTitle:false`想定だと開催日が最も遅い2地区
  （近畿・中国あたり）しか候補に上がらず、残り7地区の好成績は拾われない。この定数は
  「全国規模の主要大会が数個ある」世界を想定しており、「同格の地区大会が9個同時にある」
  状況は想定されていなかった。
- `bestPlacement()`は`kind==='winner'`/`'runnerup'`/(`'best'`かつ`bestLevel===4`)のみを
  好成績とみなし、ベスト8は対象外（既存の閾値。地区大会を足しても変わらない）。
- `data/tournaments/index.json`に地区大会9件はまだ未登録（`local_index.json`のみ登録済み）。
- **団体戦も登録予定**（2026-07-26追記）。現状の個人戦ダブルスに加えて団体戦
  （`team-none-boys`/`team-none-girls`）も各地区で登録していく方針。近畿は
  `kinki_boys_team.json`/`kinki_girls_team.json`まで変換済みで未登録。この連携アイデアの
  設計は個人戦だけでなく**団体戦も考慮できる形にする**必要がある。
- `recentAchievers`（④）は「団体は per-player 不可のため対象外」と明記されている
  （`docs/wiki/news-context-blocks.md`）。つまり現状の仕組みは個人戦専用で、団体戦の
  地区大会結果をそのまま流し込んでも拾われない。団体戦を文脈情報として出すなら、
  `historical-winners`/milestoneが団体戦を`championKey`（校単位）で扱っている既存パターンを
  参考に、選手単位とは別の校単位の仕組みを設けるか、`recentAchievers`自体を校単位にも
  対応させる拡張が要る。

## 課題・未解決

- `RECENT_TOURNAMENT_LIMIT=2`の制約をどう扱うか、方向性が未確定。
  - 案A: 既存の「直近大会」枠を地区大会向けに拡張する（例: 主要大会2件＋該当する地区大会は
    別枠で追加）
  - 案B: 地区大会専用の新しい文脈ブロックを作る（選手の出身地区に対応する地区大会結果だけを
    ピンポイントで引く。地区をまたいだノイズが出ない一方、新規実装になる）
  - いずれの案も**団体戦を含む形で設計する**（個人戦のみの`recentAchievers`をそのまま
    流用すると団体戦が構造的に漏れるため、校単位の扱いを別途組み込む必要がある）
- インターハイ2026のプレビュー記事自体が`data/news/`に存在するか未確認（要確認）。
- 地区大会の成績を全国大会の文脈内でどう見せるのが適切か。地区大会は全国出場に直結しない
  （インターハイ出場は都道府県予選が別途決める）ため、「地区大会で好成績＝強い」という
  文脈情報としての伝え方に一定の工夫が要るかもしれない。

## 目指したい方向性

まだ発散フェーズ。案A/Bのどちらが良いか、あるいは他の切り口があるかは未定。

## 関連

- [docs/wiki/news-context-blocks.md](../wiki/news-context-blocks.md)
- [docs/adr/ADR-007-in-progress-tournament-standing.md](../adr/ADR-007-in-progress-tournament-standing.md)
- [2026-07-22-idea-highschool-block-tournament-data.md](./2026-07-22-idea-highschool-block-tournament-data.md)
- [2026-07-22-highschool-block-tournament-page-structure.md](./2026-07-22-highschool-block-tournament-page-structure.md)
- [2026-07-26-abandoned-tournament-ui-design.md](./2026-07-26-abandoned-tournament-ui-design.md)
- `lib/newsArticle.ts`（`findRecentTournaments` / `buildRecentAchieverIndex`）

## 参考文献

(なし)
