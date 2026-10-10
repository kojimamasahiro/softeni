---
type: entity
scope: 固有
status: current
summary: "チーム（Team）の定義と識別子。チームに単一の ID は無く、結合キーはチーム名の文字列。teams.json の連番 id は安定しない。teamId はページ群ごとに別の名前空間で、出どころが違う"
code:
  - "data/teams/teams.json"
  - "data/teams/team-name-mappings.json"
  - "data/highschool/teams.json"
  - "scripts/highschool/01team/team_id_map.json"
---
# Team（チーム）

> **適用範囲: 固有**。ソフトテニスの大会データの出場主体（学校・クラブ・企業・大学・国）。名寄せの運用は
> [team-player-identity.md](./team-player-identity.md)、選手は [player.md](./player.md)。

## 定義

大会に出場した所属。**チームに単一の ID は無い**。データ上の結合キーは**チーム名の文字列**で、`teamId` は URL のページ群ごとに別々に作る
スラッグ。団体戦では参加者がチームそのもの（氏名が `null`）になる。

## 識別子

| 名前 | 形 | 作り方・範囲 | 使い道 |
|---|---|---|---|
| チーム名 | `participants[].team` の文字列 | 表記ゆれは `data/tournaments/team-name-aliases.json`（大会スコープつき）で正準名へ寄せる。参加者 id の第3要素にも入る | データ上の結合キー。年度別メンバー・成績はこの名前で details から集める |
| `teams.json` の `id` | 整数の連番 | `build-team-master.mjs` が**位置で振る**（`teams.length + 1`）。**作り直すと総入れ替わり** | 名寄せのレビュー画面と候補の突き合わせだけ。**外から参照しない** |
| `teamId`（URL） | ローマ字スラッグ | ページ群ごとに出どころが別（下表） | URL とそのページ群の内部リンク |

`teams.json` の `id` がずれると別チームの経歴が表示されるので、`check-team-id-alignment.mjs` が候補ファイルとの一致を検査する。

### `teamId` の出どころ

| ページ | `teamId` |
|---|---|
| `/teams/[teamId]` | `data/teams/team-name-mappings.json` のキー（手で付けたスラッグ → 同一チームの表記の配列）と、STリーグ出場チームの teamId。名前は NFKC と異体字の畳みで照合し、先に載っているものが勝つ |
| `/highschool/[gender]/[prefectureId]/[teamId]` | `data/highschool/teams.json` の `id`。`entries-to-teams.py` がローマ字化し、既存の id は保つ。手動の上書きは `scripts/highschool/01team/team_id_map.json` |
| `/secondaryschool/…`・`/primaryschool/…` | 県内で一意なローマ字スラッグ（`team-id-overrides.json` などの上書き表あり）。作り方は各ページ |

ページ群が違えば teamId は互いに独立で、同じ綴りでも別の団体を指しうる。大学は個別ページを持つとき `/teams/[teamId]` に寄せる。

## 置き場

| 何 | どこ |
|---|---|
| 出場主体の表記 | `data/tournaments/details/**` の `participants[].team` |
| 表記ゆれの正準化 | `data/tournaments/team-name-aliases.json` |
| チームマスタ・名寄せの候補と判断台帳 | `data/teams/`（`teams.json` / `merge-candidates.json` / `review-decisions.json` など） |
| `/teams` の teamId と表記の対応 | `data/teams/team-name-mappings.json` |
| 高校・中学・小学の teamId | `data/highschool/teams.json`・`data/secondaryschool/`・`data/primaryschool/` |

年度別メンバーや成績は保存せず、details から名前で集めて作る（`generateTeamInfo()`）。

## 形（要点）

- **名寄せで統合するのは人が決める**。機械は候補までで、判断は台帳に残る（ADR-019）。
- 名寄せでチーム名を書き換えると `participants[].id` と `entries[].playerIds` も追従する（[player.md](./player.md)）。
- 同じ学校が、男女・年度・大会で別の表記になっていると別チームに見える（名寄せの取りこぼし）。
- `/teams` の一覧への掲載は `teams.json` の `count>=2`（[public-pages.md](./public-pages.md)）。

## 関連

[team-player-identity.md](./team-player-identity.md)（名寄せの運用）／[public-pages.md](./public-pages.md)（`/teams`）／
[highschool.md](./highschool.md)・[secondaryschool.md](./secondaryschool.md)・[primaryschool.md](./primaryschool.md)（teamId の作り方）／
[st-league.md](./st-league.md)（STリーグのチーム）／[player.md](./player.md)
