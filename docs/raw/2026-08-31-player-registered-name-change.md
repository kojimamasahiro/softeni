# 選手の登録名変更（改名）をどう名寄せするか

2026-08-31。発端はユーザーからの指摘:
**高田商の「林 湧太郎」と NTT西日本の「林 佑太郎」は同一人物**で、2020年ごろに登録名を変更した。

## 事実確認

| 表記 | 所属 | 県 | 出現 | 年 |
|---|---|---|---|---|
| 林 湧太郎 | 高田商 | 奈良県 | 2件 | 2017, 2018（インターハイのみ） |
| 林 佑太郎 | NTT西日本 | 広島県 | 22件 | 2022〜2026 |

- **現行の登録名は「佑太**郎**」**（`郎`）。NTT西日本 公式メンバー紹介
  <https://www.ntt-west.co.jp/symbol/softtennis/member/> で確認（2026-08-31）。
  掲載データ22件も全て `佑太郎` なので、**名の誤字修正は不要**。
- `data/players/index.json`: `林|佑太郎` = id 473 / count 22。**`林|湧太郎` は不在**。
  つまり高田商時代の2件はどの選手ページにも紐づいていない（結果ページは `count>=5` が条件）。
  統合すると count 24 になり、キャリア年表が 高田商 → NTT西日本 で繋がる。
- 年の重複ゼロ・同一大会での同時出場ゼロで、同一人物説と矛盾しない。
  ただし **2019〜2021 は大学・実業団のデータ自体が未収録**（`zennihon-university` は2023〜、
  `zennihon-workers` は2022〜）なので、「空白期間がある」ことは改名の裏付けにはならない。

## 現状の仕組みと、そこに無いもの

「同一人物 × 別表記」を扱う仕組みは**存在しない**。近いものは3つあるが、いずれも使えない。

| 既存 | 何をするか | なぜ使えないか |
|---|---|---|
| `data/players/homonyms.json` | 同姓同名の**別人**を記録 | 逆方向。しかも id を分けず警告フラグを出すだけ |
| `data/players/name-split-aliases.json` | 姓名の**切り位置**ゆれ（`谷\|明日里` / `谷明\|日里`） | 適用側が `alias姓+alias名 === canonical姓+canonical名` を assert（`scripts/normalize-name-splits.mjs`）。文字が変わる改名は原理的に通せない |
| `data/tournaments/team-name-aliases.json` | チーム名の改称・略称 | チーム専用 |

## 設計案: `data/players/player-name-aliases.json`

チーム名 alias／姓名分割と同じ運用（機械検出 → 人手判断を表に蓄積 → データ本体へ適用）に揃える。

```json
{
  "canonical": ["林", "佑太郎"],
  "aliases": [
    { "name": ["林", "湧太郎"],
      "scope": { "team": ["高田商"], "prefecture": ["奈良県"], "yearMax": 2021 } }
  ],
  "kind": "registered-name-change",
  "note": "2020年頃に登録名を変更。高田商(奈良)時代=湧太郎 / NTT西日本=佑太郎",
  "source": "user-confirmed + NTT西日本公式メンバー紹介",
  "verifiedAt": "2026-08-31"
}
```

### 決めたこと / その理由

1. **`scope` は任意ではなく必須**にする。
   チーム名 alias（[ADR-013](../adr/ADR-013-scoped-team-name-aliases.md)）では `scope` は任意だが、
   人名はチーム名より「別の場所に居る同名の別人」に当たる確率が高い。無条件適用は誤マージ
   （`homonyms.json` が防ごうとしているもの）を自分で作ることになる。`team` / `prefecture` /
   年レンジで囲う。

2. **アプリ層（id 解決）でのマージにはしない。データ本体を書き換える。**
   姓名の完全一致で人を引く箇所が独立に5系統ある:
   `participants[].id`（`姓_名_チーム_県`）／`index.json` の数値 id／`playerKey`（名前@所属）／
   進路照合（[ADR-014](../adr/ADR-014-pathway-name-match.md)）／story 照合。
   1箇所直しても残りが割れたままになる。リポジトリはチーム名と姓名分割で既に2回
   「データ本体を書き換える」を選んでおり、そこに揃える。
   なお「人物別 id の払い出し」は 2026-07-26 に見送り済み
   （[homonym-measurement](./2026-07-26-homonym-measurement.md)）で、その判断は今回も動かさない。

3. **正準は現行の登録名（＝改名後）に寄せる。**
   チーム改称と同じ方針（掲載データは改名後）。旧名は alias 表に残るので情報は失われない。
   ただし公開面では **旧登録名を併記する**（下記タスク）。

### 適用手順（`scripts/normalize-name-splits.mjs` を雛形に新スクリプト）

`scripts/normalize-player-names.mjs`（仮）:

1. 対象2ファイル（`highschool-championship/2017/doubles-none-boys.json`,
   `.../2018/doubles-none-boys.json`）で3箇所をピンポイント置換。JSON 再シリアライズはしない
   （整形を壊さないため。既存の normalize 系と同じ方針）。
   - `participants[].lastName` / `firstName`
   - `participants[].id`: `林_湧太郎_高田商_奈良県` → `林_佑太郎_高田商_奈良県`
     （**チーム・県は当時のまま**。変わるのは名だけ）
   - `entries[].playerIds`
2. `data/players/index.json` は該当氏名の `count` のみ更新（22 → 24）。
   `extract-players.mjs` での丸ごと再生成はしない（閾値未満の数千名を新規採番してしまう）。
3. 再実行: `scripts/build-player-homonyms.py` → `scripts/check-identity-health.mjs`。
4. `--dry-run` と冪等性は既存 normalize 系と同じ契約にする。

### 公開面のタスク

- `data/players/{slug}/information.json` に `formerNames`（旧登録名）を持たせ、選手ページに
  「旧登録名: 林 湧太郎」を併記する。掲載データを改名後に寄せる以上、これが無いと
  インターハイ2017の出場者名が当時のプログラムと食い違ったまま説明が付かない。
  ※ 林 佑太郎は現在 curated プロフィール（`data/players/{slug}/`）を持っていないので、
  この対応は curated 選手が改名していた場合に効く。今回は先送り可。

## 検出は自動化できない（正直な結論）

今回のケースは同音異字（ゆうたろう）＋所属も県も年も全部変わっており、既存の検出器 D/E/F は
どれも原理的に引っかからない。読み仮名データも無い（[players-pages.md](../wiki/players-pages.md)）。
ペア継続・進路チェーンでの補助検出も、2019〜2021 が空白なので効かない。

**一次ソースは人の知識**。この表の価値は「見つける」ことではなく
**一度分かった判断を失わずに全系統へ効かせる**ことにある。
機械側でやるとしたら「同姓＋同音の名＋年レンジが排他」程度の弱いレビュー候補生成が上限で、
自動適用は不可。

## 副次: 全日本インドア2025 の都道府県が全件「秋田県」だった → 修正済み（2026-08-31）

林 佑太郎の県が1件だけ `秋田県`（他21件は `広島県`）だったのが発端。調べると
**`zennihon-indoor/2025` の boys / girls 両ファイル計48人が全員 `秋田県`** だった。
2025年の全日本インドアの**開催地が入っていた**もので、
`primaryschool-championship 2024`（全3,244人が開催地の秋田県）と同型のデータバグ
（[team-player-identity.md](../wiki/team-player-identity.md)）。2022〜2024 の同大会は正常。

修正: 他大会から**同一人物（姓・名・チーム）の県の最頻値**で復元。全48人が一意に決まった。
`prefecture` / `id` / `entries[].playerIds` の3箇所を置換（各ファイル 24人 × 3 = 72箇所）。
検証: 参照切れ0 / id重複0 / `matches`・`results` は無変更 / `秋田県` の残存0。

- 大学は `日本学連`（データ全体の大学所属の慣習に一致）、実業団・高校は実県。
- **Assumption**: `神戸松陰大学`（2名）は他大会に一度も出ないため人物・チーム由来の実績が無く、
  大学の慣習に従って `日本学連` とした。

### この修正で分かった別件（未対応）

- **`神戸松陰大学`（陰）は `神戸松蔭大学`（蔭）の異体字**。全データ中この2件のみ。
  正しくは `team-name-aliases.json` で名寄せし `normalize-team-names.mjs` を回す案件
  （`米子松陰`→`米子松蔭` と同型）。`data/teams/teams.json` に id 3878 として
  独立エンティティで残ってしまっている（本体 id 65 `神戸松蔭大学` は count 150）。
- `data/teams/teams.json` は今回の県修正の前に生成されたもので、id 3878 の `prefecture` が
  `秋田県` のまま。上の alias を入れてから `build-team-master.mjs` を回せば、この行ごと消える。
  （なお teams.json は 2017年インターハイの新規取り込み分も未反映で、元から再生成待ちの状態）

## 残タスク

- [ ] `data/players/player-name-aliases.json` と `scripts/normalize-player-names.mjs` の実装
- [ ] 林 湧太郎 → 林 佑太郎 の適用（index.json の count 22 → 24 を含む）
- [ ] `神戸松陰大学` → `神戸松蔭大学` の alias 追加 → `normalize-team-names.mjs` → `build-team-master.mjs`
- [ ] docs/wiki/team-player-identity.md への書き戻し（新しい名寄せ軸として「改名」の節を追加）
- [ ] `formerNames` の公開面対応（curated 選手に改名が出てきたら）

## 関連

- [docs/wiki/team-player-identity.md](../wiki/team-player-identity.md) — 名寄せの本体ページ
- [docs/wiki/players-pages.md](../wiki/players-pages.md) — 選手 URL 2系統・id 解決の規約
- [ADR-013](../adr/ADR-013-scoped-team-name-aliases.md) — alias への scope 導入
- [2026-07-26-homonym-measurement.md](./2026-07-26-homonym-measurement.md) — 同姓同名（逆方向）の実測
- [2026-08-29-name-split-audit.md](./2026-08-29-name-split-audit.md) — 姓名分割ゆれの運用

---

## Compile Log

2026-09-02 の [LLM Wiki lint](./2026-09-02-llm-wiki-lint.md) で、このノートの残タスク
「docs/wiki/team-player-identity.md への書き戻し」を実施した時点の記録。

wiki に載せたもの:

- 「改名」が既存3仕組み（`homonyms.json` / `name-split-aliases.json` / `team-name-aliases.json`）の
  どれでも扱えない理由の対比表 → `wiki/team-player-identity.md`「選手の登録名変更（改名）」
- 決めたこと3点（`scope` 必須 / アプリ層でなくデータ本体を書き換える / 正準は改名後）とその理由
- 「検出は自動化できない・対応表の価値は判断を全系統へ効かせること」という結論
- 林 湧太郎 ⇄ 林 佑太郎 の実例（count 22 → 24 になること）— 唯一の実例で、
  `scope` を必須にする判断の根拠そのものなので残す価値がある
- `神戸松陰大学`（陰）→ `神戸松蔭大学`（蔭）の未対応 alias → 同ページ「既知の残課題」
- 未実装の残タスク → `wiki/open-questions.md`「ドキュメント運用」

意図的に載せなかったもの:

- 事実確認の表（出現件数・年の内訳）と NTT西日本 公式ページでの確認手順 — 一度きりの調査。
  結論（現行登録名は `佑太郎`・名の誤字修正は不要）だけを wiki に持ち込んだ。
- `scripts/normalize-player-names.mjs` の適用手順4ステップ — **未実装のため**。
  wiki は現状仕様のページで、実装していない手順を書くと確定事項に見える。実装時に書き戻す。
- 全日本インドア2025 の都道府県48人一括修正の詳細（復元方法・検証内容）— 同型のデータバグは
  既に `wiki/team-player-identity.md` に `primaryschool-championship 2024` の例で載っており、
  個別ケースの積み増しは読み手の判断を助けない。`神戸松陰大学` の件だけ未対応なので拾った。
- `data/teams/teams.json` が再生成待ちである件 — 一時状態。alias 追加時に解消する。
- `formerNames` の公開面対応 — 「curated 選手に改名が出てきたら」という条件付きの先送りで、
  現時点で該当者がいない。wiki には決めたこと3の但し書きとして1行だけ残した。
