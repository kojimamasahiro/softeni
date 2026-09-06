# 調査メモ: highschool パイプラインの鮮度チェックが空振りで赤くなる（2026-09-06）

## 状況

ユーザー報告: **毎回この判定でエラーになり、そのたびに再ビルドすることになる**。

```
❌ 高校ソフトテニス データパイプラインの生成物が古い可能性があります:
  - 元データの内容が、最後に記録されたパイプライン実行時（2026-09-05T21:55:03.191Z）から変わっています

👉 次を実行してください: npm run highschool:pipeline
Failed: build command exited with code: 1
```

直近の実例は [ブラケット復元の調査](./2026-09-06-bracket-verify-250-mismatches.md) の PR で、
`highschool-championship/2013/doubles-none-boys.json` の重複した `matches` を 2 件消しただけで
Cloudflare Pages と Vercel の両方がこのチェックで落ちた。

## 真因: 「読まない項目」までハッシュに混ぜていた

`scripts/highschool/lib/source-hash.mjs` は、パイプラインが読む
`data/tournaments/details/<大会>/<年>/*.json` を列挙して、**ファイル全体のバイト列**を
sha256 に流し込んでいた。

ところがパイプラインの python 3 本が実際に読む項目はごく一部で、
`matches` は**1 バイトも読んでいない**。

| スクリプト | details から読む項目 |
|---|---|
| `01team/entries-to-teams.py` | `participants[].team` / `participants[].prefecture` |
| `02result/extract.py` | 上記＋`entries[].entryNo` / `entries[].playerIds` / `results[].entryNo` / `results[].tournament.label` / `results[].roundRobin\|roundrobin.rank` |
| `03list/summary.py` | `entries[].playerIds` |

（`grep -rn "tournaments/details" scripts/highschool/` で details を読むのはこの 3 本だけ。
`04summry` と `analysis` は中間生成物しか読まない。）

つまり `matches` / `knockoutDraw` / `entries[].type` / スコアを直すと:

1. ハッシュが変わる → 鮮度チェックが赤 → ビルド失敗
2. 言われたとおり `npm run highschool:pipeline` を回す
3. **生成物は 1 バイトも変わらない**（読んでいない項目なので当然）
4. マーカーのハッシュだけが動いたコミットが 1 つ増える → 再ビルド

**空振りのために毎回コミットとビルドが 1 往復増えていた**。しかも「生成物が変わらない」ので、
本当に必要な再実行だったのか空振りだったのかが後から見分けられない。

大会結果の取り込みは `matches` を大量に触るので、これが「毎回」の体感になる。

## 対応: ハッシュを「読む項目だけ」の射影にする

`computeSourceHash` を、ファイル全体ではなく**パイプラインが読む項目だけを取り出した射影**の
ハッシュに変えた。読まない項目をいくら直しても緑のままになる。

あわせて、これまで**取りこぼしていた**入力も対象に入れた:

- `data/tournaments/index.json` の `(tournamentId, generationId)`。
  `generationId` は `03list/summary.py` の対象大会を決めるので、これが変わると
  details が 1 バイトも変わらなくても生成物は変わりうる。日程などの無関係な項目は混ぜない。
- `scripts/highschool/lib/pipeline-sources.json`（除外する大会の一覧）。

マーカー（`data/highschool/.pipeline-source-hash.json`）には 2 つのハッシュを記録する。

```json
{
  "sourceHashKind": "projection-v1",
  "sourceHash": "…",        // 射影。鮮度判定はこれだけを見る
  "rawSourceHash": "…",     // ファイル全体。参考値
  "sourceFileCount": 319,
  "generatedAt": "…"
}
```

`rawSourceHash` は判定に使わない。射影が一致して raw だけ違うときに

```
ℹ️  元データは変わっていますが、パイプラインが読む項目は変わっていないため再実行は不要です。
```

と理由を出すためだけに持つ。「なぜ緑なのか」が読めないと、次に本当に赤くなったときに
チェックを信用できなくなるため。

旧マーカー（`sourceHashKind` が無い）は**旧方式で照合する**。切り替えの過渡期に、
他ブランチのマーカーが一斉に赤くなるのを避けるため。次に `npm run highschool:pipeline` を
回した時点で新方式に載る。

## 射影が漏れていないことの確認

「読む項目を1つでも書き漏らすと、元データが変わったのに緑のまま生成物が古くなる」＝
このチェックが防ぎたかった状態そのものになるので、静的な読み合わせだけでは不安が残る。
そこで**実物で検算した**:

1. 対象 319 ファイルすべてを、射影に残る項目だけに削って上書きする
   （`participants` は team/prefecture のみ、`entries` は entryNo/playerIds のみ、
   `results` は entryNo/tournament.label/roundrobin.rank のみ。`matches` 等は丸ごと削除）
2. その状態で `npm run highschool:pipeline` を完走させる
3. 生成物（`01team/teams.json` / `02result/results.json` / `03list/prefecture-summary.json` /
   `data/highschool/**`）のハッシュを削る前と比べる

結果は **`e5d5cf674a15c8c499a7e6d5b440487ccad618c2` で完全一致**。
射影に残っていない項目は生成物に一切影響していないことが実データで確認できた。
（確認後、`git checkout` で全ファイルを復元済み。）

## 挙動の確認

| 変更 | 期待 | 実測 |
|---|---|---|
| `matches[].retired` / スコアだけ変える | 緑（＋理由の1行） | 緑 |
| `participants[].team` を変える | 赤 | 赤 |
| `results[].tournament.label` を変える | 赤 | 赤 |
| `index.json` の `generationId` を変える | 赤 | 赤（**従来は緑だった**） |
| 対象ディレクトリにファイルを増やす | 赤 | 赤 |

冒頭の 2013 の修正（`matches` 2 件削除）でも検算した。射影ハッシュは
`232b67d3…` で前後**同一**、raw だけが `8e5eaf79…` → `4f911711…` と変わる。
この変更が入っていれば、あの PR は最初の push で緑だった。

## 残る限界

- **python 側が読む項目を増やしたときに、射影の更新を忘れると気付けない。**
  `source-hash.mjs` の `projectDetail` に「3 本が読む場所はここだけ」と列挙し、
  増やしたら足すよう明記した。機械的な担保は無い。
- **パイプラインのスクリプト自体を変えても鮮度チェックは反応しない**（これは従来から同じ）。
  スクリプトを直したら生成物が変わりうるので、本来は再実行が要る。
  スクリプトの内容もハッシュに混ぜれば閉じられるが、今度は「コメントを直しただけで赤くなる」
  ノイズが増える。今回は手を付けず open-questions に送る。

## Compile Log（2026-09-06）

書き戻したもの:

- 射影方式に変えたこと・マーカーの新形式・旧形式の扱い
  → **docs/wiki/data-import.md**（prebuild ゲートの説明がそこにあり、
  「元データを触ったら何をするか」は取り込み手順そのものなので）。
- 「読まない項目だけの変更なら再実行不要」という運用上の結論
  → 同上。ここが変わらないと、今後も空振りの再実行が続く。
- スクリプト変更が鮮度チェックに反応しない件 → **docs/wiki/open-questions.md**。

意図的に書き戻さなかったもの:

- 319 ファイルを削って検算した手順の詳細 — 一度きりの検証で、再実行する手順としては
  重すぎる（データを全書き換えするため）。結論（生成物が完全一致）だけ wiki に要らないと判断し raw に残す。
- 挙動確認の表 — 実装のふるまいそのもので、コード側のコメントとこのメモで足りる。
- 具体的なハッシュ値（`232b67d3…` 等）— すぐ陳腐化する。
