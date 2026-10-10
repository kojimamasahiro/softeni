# Compile Log

raw ノートのうち、wiki・ADR へ compile したもの（または compile を見送ったもの）の末尾に置く節。
「検討した上で除外した」のか「まだ確認していない」のかを、読み手が区別できるようにするための記録。

## 書式

ノート末尾の `## Compile Log` に、**事実ごとに1行**で「行き先: 内容」を書く。

```markdown
## Compile Log

- wiki:database: `team_rubber_order` 列
- ADR-023: 判断3つと却下した案
- open-questions: 外国選手が勝敗を持った後の扱い
- 落とした(依頼限り): 再生リストの URL が短い件
- 落とした(重複): 〇〇は wiki:data-model に既にある
```

- 行き先は次のいずれか。1行に行き先は1つ。
  - `wiki:<ページ名>` — `docs/wiki/<ページ名>.md`（拡張子は付けても付けなくてもよい）
  - `ADR-<番号>` — `docs/adr/ADR-<番号>-*.md`
  - `open-questions` — `docs/wiki/open-questions.md`
  - `落とした(<理由>)` — wiki に反映しなかったもの
  - それ以外（`AGENTS.md`、`skill:<名前>` など）は自由に書いてよい
- 行き先をバッククォートで囲んでもよい（`` `ADR-024`: … ``）。
- 落とした理由の例: 重複 / 推測の域を出ない / 対象ページのスコープ外 / 新しい情報で置き換え / 依頼限り。
- 旧書式（「wiki（xxx.md）へ: …」「落とした: …」）も有効。新しく書くときは上の書式にする。

## 機械チェック（`npm run check:wiki -- --strict`）

- **`wiki:<ページ名>` と `ADR-<番号>` の行き先が実在するか**（ゲート）。実在しないと落ちる。
  この2つだけを見る。書式に合わない行は見ない。
- **Compile Log の節があるか**（報告）。2026-09-19 以降に作ったノートだけが対象で、次は免除。
  - 先頭の `kind` が `archive`（wiki ページの圧縮前の全文。compile の「先」であって「元」ではない）または
    `worklist`（作業リスト。wiki へ載せる durable な中身が元々無い）。`research` / `idea` / `plan` は免除されない。
  - `kind` を持たない旧ノートは、ファイル名で決める: `*-wiki-archive-*.md` / `*-review.md` / `*-checklist.md` / `*-todo.md`。
  - `README.md` など日付を持たないメタ文書。
- **`kind` の値が語彙の外でないか**（ゲート）と、**2026-10-10 以降の新規ノートに `kind` があるか**（報告）。
  書き方は [docs/raw/README.md](../../../../docs/raw/README.md)。

## 適用範囲

- 2026-07-11 以降に作った raw ノートに付ける。それ以前に Compile Log が無いのは設計どおりで、書き忘れではない。
  「まだ確認していない」と読まないこと。再 compile するとき以外、遡って付けない。
- 書く場所は raw ファイル末尾の「Compile Log」節。raw は追記のみなので、既存の節を書き換えず末尾へ足す。
