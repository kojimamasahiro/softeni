# ADR-020: 団体戦の対戦ごとの記録（オーダー）を試合の中に持つ

## Status

Accepted（2026-09-18）

## Context

団体戦・対抗戦のデータ（`data/tournaments/details/**/team-*.json` / `versus-*.json`、118ファイル・4,371試合）は
学校対学校の本数（`scores`、2-0 など）しか持たず、**どの対戦に誰が出て何ゲームだったか**が無かった。

- X では大会のたびに「決勝のオーダーは？」「第1対戦は誰と誰？」という問いが出ており、当サイトは答えられない
  （[X投稿から見たユーザーの課題](../raw/2026-09-17-x-posts-user-problem-findings.md)）。
- 団体戦の `participants[]` は学校単位（`校名_都道府県`）で選手を持たないため、選手ページに団体戦の出場・勝敗が出ない。
- 元資料には載っている: 全日本高校選抜の JSTA 記録 PDF は**全試合**の対戦別のペアとゲーム数を持つ
  （2022・2025 で確認）。インターハイの記録はベスト8以降だけで、ゲームごとのポイントまで載る。
- リポジトリ内に先行実装がある: STリーグ（`data/st-league/<年>/matches.json`）は1試合の中に
  `matches: [{ type, winner, scoreA, scoreB, playersA, playersB }]` を持つ（ADR-008）。

ユーザーの判断（2026-09-18）: 「STリーグの形に合わせる」「対戦の状態はできれば3種類を区別したい」
「記録がない選手は名前だけ持つ」。

## Decision

details の試合オブジェクトに、任意の `matches`（対戦ごとの記録の配列）を足す。型は `src/types/tournament.ts` の
`TeamMatchDetail`。

```json
{
  "entries": [2, 3],
  "scores": { "2": 3, "3": 0 },
  "matchId": "match-1",
  "...": "既存のフィールドはそのまま",
  "matches": [
    {
      "type": "D1",
      "status": "completed",
      "winner": "A",
      "scoreA": 4,
      "scoreB": 0,
      "playersA": [{ "lastName": "百目木", "firstName": "來杜" }, { "lastName": "秋山", "firstName": "想太" }],
      "playersB": [{ "lastName": "鈴木", "firstName": "瑛太" }, { "name": "川波 悠馬" }]
    }
  ]
}
```

- **形は STリーグの `MatchDetail` に揃える**（`type` / `winner` / `scoreA` / `scoreB` / `playersA` / `playersB`）。
  A は親の `entries[0]`、B は `entries[1]`。`type` は対戦の順（`D1` `D2` `D3`、シングルスは `S`）。
- **`status` で3種類を区別する**。STリーグ側は「必ず決着」前提なので、ここだけ広げる。

  | status | 意味 | winner | scoreA / scoreB |
  |---|---|---|---|
  | `completed` | 決着 | `'A'` か `'B'` | 本数（勝者が多い） |
  | `unfinished` | 団体の勝敗が決まって途中で打ち切り | `null` | 途中の本数（例 3-3） |
  | `not_played` | 未実施（オーダーだけ出ている） | `null` | `null` |

- **選手の持ち方**: 同じ氏名・同じ学校の**個人戦の出場記録がある選手は姓と名**（`{ lastName, firstName }`。選手ページと
  同じ識別）、**無い選手は名前だけ**（`{ name }`）。名前だけの選手は `participants` に足さない
  （足すと `extract-players.mjs` が新しい選手として採番する）。STリーグは数値 ID だが、details の選手は
  氏名ベースで識別されるので ID は持たない。
- **勝者の数は親の `scores` と一致させる**（`completed` の A の数＝`scores[entries[0]]`）。
- **持つのは元資料にある試合だけ**。大会によっては一部の試合だけが持つ（インターハイはベスト8以降など）。
- 整合性は `scripts/check-team-match-details.mjs`（prebuild）で検査する。姓名の分割修正
  （`normalize-name-splits.mjs`）はこの記録の姓・名も書き換える。

## Alternatives

- **別ファイル（サイドカー）に持つ**: 入力ツールで details を作り直しても消えない利点があるが、
  details を走査する多数のスクリプトが `*.json` を拾うため、置き場所と形の取り決めが増える。
  STリーグと同じく試合の中に持つほうが読み手に素直。却下。
- **名前だけの選手も `participants` に足す**: 選手ページが作れるが、1回しか出ない名前が選手一覧に
  大量に採番され、分割ゆれの点検対象も増える。ユーザー判断で却下。
- **状態を持たず、打ち切り・未実施を省く**: STリーグと完全に同じ形になるが、「オーダーは出ていた」
  （未実施の第3対戦のペア）という情報が消える。ユーザー判断で却下。
- **数値の選手 ID を持つ**: `data/players/index.json` の id は氏名で引かれ、同姓同名の分割
  （`homonyms.json`）もあるため、氏名で持つほうが既存の識別と食い違わない。却下。

## Consequences

- 高校選抜 2025 の男女70試合・210対戦に記録が入った。選手は延べ 792 人を姓・名で、48 人を名前だけで持つ。
- **ページ表示はまだ無い**。`lib/packedPageData.ts` は必要な項目だけを詰めるので、この項目は現状ページに届かない。
  表示するときに詰め方を足す。（2026-09-18 同日に対応。末尾の追記を参照）
- **入力ツール（`tools/`）で details を作り直すと消える**。ツールは `matches` の中身を知らない。
  作り直した場合は取り込みスクリプトを再実行する（冪等・既存の記録は置き換え）。
- 選手の姓・名が分割修正から取り残されると、`check-team-match-details.mjs` が prebuild を止める。
- 名前だけの選手は、後で個人戦に出れば姓・名に置き換えられる（取り込みスクリプトの再実行で反映）。

## Related Files

- `src/types/tournament.ts`（`TeamMatchDetail` / `TeamMatchPlayer`）
- `scripts/pdf/highschool_senbatsu_team_matches.py`（高校選抜 JSTA 記録からの取り込み）
- `scripts/check-team-match-details.mjs`（整合性チェック・prebuild）
- `scripts/normalize-name-splits.mjs`（分割修正の対象に追加）
- `src/utils/st-league.ts`（元になった `MatchDetail`）
- `data/tournaments/details/highschool-senbatsu/{2022,2025}/team-none-{boys,girls}.json`
- `lib/packedPageData.ts` / `src/components/Tournament/MatchResults.tsx`（表示。2026-09-18 追記）
- `lib/__tests__/packedTeamMatches.test.ts`（圧縮の往復。`npm run bracket:test`）

## Open Questions

- 表示の場所と形（試合詳細・学校ページ・選手ページのどこに出すか）。
- インターハイのゲームごとのポイント（`4 - ⑥` など）をどう持つか。
- 高校選抜の他年度（2022 は同じ様式。2020・2023・2024 は出典が JSTA 以外）。
- 名前だけの選手のうち、学校名の表記違い（`近大高専` / `近畿大学高専`）で結び付かなかった6人の扱い。

---

## 追記（2026-09-18・同日）: 表示の場所と選手の成績集計

Decision 本文は変えず、同日のユーザー判断をここに記録する。

- **表示は試合詳細（`MatchResults`）**。各組のカードの試合行の下に、その組から見た向き
  （左が自分の組、右が相手）で「第N対戦・ペア・本数」を並べる。勝った側を太字、打ち切りは「打ち切り」、
  未実施は「未実施」と出す。並びは STリーグの対戦詳細（ADR-008）に揃えた。
  ページへは `lib/packedPageData.ts` が詰めて渡す（**記録がある試合にだけ**要素を足し、他のページの転送量は変えない）。
- **選手の成績集計は STリーグに合わせる**＝**Player Statistics Engine（ADR-011）には入れない**。
  STリーグの対戦も選手の通算成績には入っておらず、STリーグ内のページでだけ扱っている
  （[st-league.md](../wiki/st-league.md)「details に結果を複製しない理由」）。団体戦の対戦ごとの記録も、
  選手ページの勝敗・勝率・ランキングには数えない。選手名は、ほかの表示と同じく姓・名の完全一致
  （`count>=5`・同姓同名は先勝ち）で選手ページへリンクするだけ。
- データの誤り2件（高校選抜 2022）を公式記録どおりに直し、2022 年度も取り込んだ（計 140 試合・420 対戦）。

Open Questions のうち「表示の場所と形」は上記で決着。
