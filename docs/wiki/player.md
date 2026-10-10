---
type: entity
scope: 固有
status: current
summary: "選手（Player）の定義と識別子。選手マスタは無く、参加者 id・数値 id・slug・playerKey の4種を用途で使い分ける。結果ページの有無を決める count>=5 と、各識別子の置き場・作り方"
code:
  - "data/players/index.json"
  - "scripts/extract-players.mjs"
  - "lib/playerStats/identity.ts"
  - "src/types/player.ts"
---
# Player（選手）

> **適用範囲: 固有**。ソフトテニスの大会データの選手。識別の規則は [player-name-identity.md](./player-name-identity.md)、
> 画面は [players-pages.md](./players-pages.md)、チームは [team.md](./team.md)。

## 定義

大会に出場して記録された人。**選手マスタは無い**。氏名（姓・名）と所属が大会ファイルごとに書かれ、識別子は用途ごとに別々の方法で作る。
同一人物かどうかを機械で確定する手段は無いので、**氏名が同じなら同一人物として扱い、確実な別人だけ記録する**。

## 識別子（4種）

| 名前 | 形 | 作り方・範囲 | 使い道 |
|---|---|---|---|
| 参加者 id（`pid`。PDF 取り込み中は `tempId`） | `姓_名_所属_都道府県`。例 `金子_凌_松本市役所_長野`（形の正は [tournament-data-structure.md](./tournament-data-structure.md#命名規約)） | 大会の details ごとの `participants[].id`。同じ人でも大会・年・所属の表記で変わる | `entries[].playerIds`・試合の参照・高校パイプライン（`_` で割った [2] を学校とみなす） |
| 数値 id（`playerId`） | 整数 | `data/players/index.json` の1行＝1つの**氏名**（所属を含まない）。`extract-players.mjs` が既存を保って末尾に採番する | `/players/{id}/results/` の URL。details には持たず、ページ生成時に姓名で引く |
| slug | `ando-kesuke` | `data/players/{slug}/information.json`。手で選んだ選手だけ | `/players/{slug}/`（プロフィール） |
| `playerKey` | `名前@所属`（NFKC・空白除去） | 実行時に作る | 選手統計エンジンの集計で、同姓同名を所属で分ける |

- 団体戦の参加者は選手ではなくチームで、氏名が `null`、id は `チーム名[_県]`。メンバー一覧からは除く。
- 数値 id の引き方は先勝ち（同姓同名は `index.json` で先にある id）。`lib/playerStats/identity.ts` の `resolveNumericId`。
- score の Supabase（`matches`）は選手を ID ではなく氏名・所属・地域の文字列で持つ。本体との結合は entryNo ペア（[score-site-link.md](./score-site-link.md)）。

## 置き場

| 何 | どこ |
|---|---|
| 参加者（氏名・所属・参加者 id） | `data/tournaments/details/**` の `participants[]`（形は [tournament-data-structure.md](./tournament-data-structure.md)） |
| 数値 id の台帳（`id` / `lastName` / `firstName` / `count`） | `data/players/index.json` |
| プロフィール・分析 | `data/players/{slug}/`（`information.json` / `analysis.json`） |
| 姓名の分割ゆれの補正・同姓同名の記録 | `data/players/name-split-aliases.json`・`homonyms.json` |
| 統計エンジンの中間・成果物 | リポジトリ直下の `.playerstats/`（`data/` の外） |

型は `src/types/player.ts`（`PlayerInfo`）と `src/types/tournament.ts`（`TournamentParticipant`）。

## 形（要点）

- **結果ページが実在するのは `count>=5` の行だけ**。`/players/{id}/results/`・内部リンク・名前からの解決（中学・小学・STリーグ・news）が同じ閾値を使う。
  リンクを張る前に `count>=5` を確かめる（無いと 404）。
- **`count` は `extract-players.mjs` を最後に流した時点の延べ出場数**。prebuild では数え直さない。
  姓名の切り位置を直したときは `normalize-name-splits.mjs` が該当氏名の分だけ数え直す。
- **`homonyms.json` に載っても数値 id は分かれない**。載った氏名の選手統計に「同姓同名の別選手の成績が含まれている可能性」の注記（`homonymRisk`）が出るだけ。
- 切り位置がぶれると同じ人が別の数値 id になり、両方が `count>=5` を割ると結果ページが消える。
- `index.json` を `extract-players.mjs` で丸ごと再生成しない（注意と理由は [player-name-identity.md](./player-name-identity.md)）。

## 関連

[player-name-identity.md](./player-name-identity.md)（氏名で同一視する規則・別人判定・改名）／
[players-pages.md](./players-pages.md)（slug 系と id 系の URL・選手統計エンジン）／
[team-player-identity.md](./team-player-identity.md)（チーム名の名寄せ）／[team.md](./team.md)
