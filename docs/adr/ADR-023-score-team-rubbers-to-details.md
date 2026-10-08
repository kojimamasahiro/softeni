# ADR-023: 団体戦の対戦を score 機能で記録し、details のオーダーへ書き戻す

## Status

Accepted

## Context

- 実業団リーグ 2026（`zennihon-business-group`）の団体戦は、公式の記録PDFが無く、試合動画（YouTube の再生リスト）しかない。
  動画からスコアを機械で読む手段は無いので、人が見て入力する。
- 団体戦の対戦ごとの記録（オーダー）は details の `matches[].matches`（[ADR-020](./ADR-020-team-match-rubber-details.md)）に持つ。
  これまでの元資料は記録PDFと公式リザルトサイトだけだった。
- score 機能（`/beta/matches/create`）には動画を見ながらゲーム・ポイントを記録する画面がすでにある。
  2026-10-07 にユーザーが「score 機能で入力し、それを大会結果へ反映する」形を選んだ。
- score の試合と大会データの紐付けは「エントリー番号の組で試合が1つに決まる」前提だった
  （[score-site-link.md](../wiki/score-site-link.md)）。団体戦では同じ組（学校・チーム同士）の記録が対戦の数だけ並ぶ。
- 作成画面は、種目「団体」を選ぶと選手を1人しか送らない（ダブルスのときだけ2人目を送る）。

## Decision

1. **1対戦＝score の1試合**として記録する。`tournament_category='team'`・`game_type='doubles'`、
   両側の `entry_number` は**チームのエントリー番号**、選手は対戦に出た2人ずつ。
2. **第何対戦かは `matches.team_rubber_order`（1〜3）に持つ**（`docs/sql/team-rubber-order.sql`）。
   `round_name` に埋め込む案はユーザー判断で却下（表記ゆれで壊れる）。
   紐付けのキーは「エントリー番号の組＋`team_rubber_order`」になる。
3. **details への反映はスクリプトで書き込む**（`npm run score:team-matches`）。ビルドのたびに合成はしない。
   元は score の公開スナップショット（`public/data/beta-matches/matches/*.json`）で、Supabase には触らない。
   書いた結果は PDF 由来の記録と同じ形・同じ検査（`check-team-match-details.mjs`）に乗る。
4. **1試合の対戦が揃うまで反映しない**。`completed` の対戦が第1対戦から欠けずに並び、
   勝ち数が親の `scores` と一致したときだけ書く。揃っていなければ理由を表示して飛ばす。
5. **既に `matches` を持つ試合は上書きしない**。中身が同じなら何もせず、違えば止める（`--replace` で置き換え）。
6. 選手の持ち方は ADR-020 と同じ（同じ氏名・同じチームの個人戦の記録があれば姓・名、無ければ名前だけ）。
   作成画面は、チームを選ぶとそのチームの個人戦の出場選手を候補に出す。

## Alternatives

- **入力をテキストで受け取り、手で JSON にする**: score の画面が要らず早いが、ポイント単位の記録・動画との対応が残らない。
  ユーザー判断で score 機能を選んだ。
- **`round_name` に「決勝 第1対戦」と書く**: DB 変更が要らないが、表記ゆれで解析が壊れる。却下。
- **ビルド時に score のスナップショットから毎回合成する**: 手間は減るが、大会データの正しさが Supabase の
  スナップショットに依存し、PDF 由来の記録と置き場所が分かれる。却下。
- **記録済みの対戦だけを先に反映する**: 途中経過が見えるが、「勝ち数＝親の本数」の検査に例外が要る。却下。

## Consequences

- 作成画面で団体を選ぶと、ダブルスとして2人ずつ送り、第何対戦かを必須で選ぶ。
- 団体戦の1試合に対して score の試合（＝試合詳細ページ）が対戦の数だけできる。`siteLink` は従来どおり団体のファイルへ解決され、
  大会ページの「スコア詳細のある試合」に並ぶ。
- 反映の順序は「score で記録（完了）→ `node scripts/generate-beta-matches-json.mjs`（スナップショット更新）→
  `npm run score:team-matches -- --write` → prettier → `npm run check:team-match-details`」。
- **SQL を本番に適用するまで、作成画面で団体の対戦は作れない**（列が無いと insert が 400 になる）。

## Related Files

- `docs/sql/team-rubber-order.sql`（列の追加）
- `src/pages/beta/matches/create.tsx` / `src/components/matches/create/TeamPlayersFieldset.tsx`（作成画面）
- `src/pages/api/tournament-entries.ts`（チームの選手候補）
- `scripts/score-team-matches.py`（反映スクリプト）/ `scripts/pdf/team_match_details.py`（書き戻しの共通部分）
- `src/types/database.ts`（`Match.team_rubber_order`）
- 実施記録: [raw/2026-10-07-score-team-rubbers.md](../raw/2026-10-07-score-team-rubbers.md)

## Open Questions

- 対戦（`TeamMatchDetail`）から score の試合詳細ページへ直接リンクするか（いまは大会ページの一覧から辿る）。
- シングルスを含む団体戦（`S`）への対応。今回は3ダブルス（D1〜D3）だけ。
