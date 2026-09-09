# 決着した種目の OGP 画像生成を skill の工程に入れる（2026-09-09）

## きっかけ

ユーザーから「og画像の生成も可能かどうか。可能であれば skill に試合が終了している場合は
og画像の生成までするように更新してほしい」。

[インカレ2026 ダブルスのインサイト](2026-09-09-incare-2026-doubles-insight.md)を出した直後で、
同じ「決着した種目」に対してもう1つやることがあるのでは、という問い。

## 可能か: 可能。ただし既存の生成器がそのまま使える

`tools/sns-images/tournament_og.py` が 2026-07-31 から存在し、年度別結果ページの OGP を
**ベスト16のトーナメント表**（1200×630 / `summary_large_image`）で生成する。
索引は `data/tournaments/og-images.json`、参照側は `lib/tournamentOgImage.ts`。
設計は [public-pages.md](../wiki/public-pages.md)「大会 年度別結果ページの OGP 画像」。

**新規実装は不要で、必要だったのは「いつ走らせるか」を決めることだけだった。**
生成器は決勝が未確定の種目に対して `render()` が None を返す（出力の
「対象外（決勝が未確定）」に計上される）ので、**走らせられる条件が
「完了版インサイトを出せる条件」と完全に一致する**。同じタイミング・同じ種目単位で回すのが自然。

実際、インカレ2026 は OGP 索引に 2023〜2025 の16件しか無く、**2026年分が丸ごと抜けていた**。

## 実行して分かった落とし穴2つ

### 1. `python3` 直打ちと `npm run og:tournaments` は落ちる

```
$ python3 tools/sns-images/tournament_og.py --only zennihon-university
ModuleNotFoundError: No module named 'PIL'
```

Pillow は `.venv` にしか入っていない（`tools/sns-images/README.md` が前提として書いている）。
一方 `package.json` の `og:tournaments` は `python3 tools/sns-images/tournament_og.py` のままで、
**そのまま叩くと必ず落ちる**。`.venv/bin/python` を使うか `source .venv/bin/activate` が要る。

`package.json` は直していない。`.venv` のパスをスクリプトに焼くと venv を別の場所に置く環境で
壊れるため。代わりに skill と wiki の両方に「`npm run og:tournaments` は落ちる」と書いた。

### 2. `--only` の `tournamentId` は前方一致

```python
if only_tid and not tid.startswith(only_tid):
```

`--only zennihon-university` は `zennihon-university-indoor` / `zennihon-university-ouza` まで
巻き込む。実測で dry-run の対象が26件になった（インカレ 4年×6種目 − 未決着2 = 22、
ouza 2026 の2、indoor 2025 の2）。`<tid>/<year>/<categoryId>` まで書くと1件に絞れる。

種目まで絞る運用にすると、**versus（対抗戦）まで意図せず生成してしまう事故も防げる**
（インカレは 2023〜2026 のどの年も versus の OGP を持っていない。今回は依頼がダブルスだったので
そこは触っていない）。

## 生成した2件

```
.venv/bin/python tools/sns-images/tournament_og.py --apply --only zennihon-university/2026/doubles-none-boys
.venv/bin/python tools/sns-images/tournament_og.py --apply --only zennihon-university/2026/doubles-none-girls
```

- `public/og/tournaments/zennihon-university-2026-doubles-none-boys-fe240255.png`
- `public/og/tournaments/zennihon-university-2026-doubles-none-girls-0baae889.png`
- 索引 335 → 337 件

PNG を目視確認: 男子は左上に川﨑康平・黒坂卓矢が太字、決勝5-2で植田璃音・安達宣。
女子は前田梨緒・中谷さくらが太字、決勝5-4で吉木理彩・岩田愛美。
**同日に書いたインサイト本文と一致**（本文は story YAML 経由、画像は `matches` から直接なので、
一致は独立した2経路の検算になっている）。

dev サーバでの反映確認:

| ページ | `twitter:card` | og:image |
|---|---|---|
| 2026 男子ダブルス（決着済み） | `summary_large_image` | 生成した PNG |
| 2026 男子シングルス（進行中） | `summary` | 既定の `twitter-card-summary.png` |

フォールバックも設計どおり動いている。

## skill の更新

skill `tournament-insight` に **工程5「決着した種目は OGP 画像も生成する」** を追加した。
frontmatter の description にも OGP を含む旨を追記（発火語として拾えるように）。

あわせて、前段の作業で踏んだ**照合の主語引き継ぎ**（工程3）も追記した。
[別ノート](2026-09-09-incare-2026-doubles-insight.md)に詳細があるが、skill 側にも
書いておかないと次に同じ順序で書いて同じ ERROR を踏むため。

**注意: この skill はリポジトリの外にある。**
`~/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/.../skills/tournament-insight/SKILL.md`
に実体があり、git で追跡されていない。一方 `tournament-pdf-to-results` は
`.claude/skills/` にあってリポジトリ内。**同じプロジェクトの skill が2箇所に分かれている**。
今回の更新は前者なので、**他のマシン・他の人には反映されない**。
`.claude/skills/` へ移すかは未判断（→ [open-questions](../wiki/open-questions.md)）。

## Compile Log

| 項目 | 扱い | 理由 |
|---|---|---|
| 決着した種目では OGP 生成をインサイト公開と同じタイミング・同じ種目単位で回すこと | wiki `tournament-insights.md`「進行中→完了の差し替え」節に採用 | 差し替えが種目単位という既存の記述の直後が置き場所として正しく、取りこぼしを防ぐ運用則 |
| `python3` / `npm run og:tournaments` が落ちること・`--only` が前方一致であること | wiki `public-pages.md` の OGP 節に採用 | 生成器の実行方法はこの節が正。誤った実行方法が書かれたままだったので訂正にあたる |
| skill 工程5の本文（コマンド・確認手順・目視確認の理由） | skill `tournament-insight` に採用（wiki には置かない） | 「作業手順そのものは skill にある」が既存の分担（`tournament-insights.md` 冒頭）。wiki には設計と運用則だけ置く |
| 照合の主語引き継ぎを skill 工程3にも書いたこと | skill に採用（wiki には前段の作業で反映済み） | 同上。wiki＝なぜ、skill＝どう書くか |
| skill がリポジトリ外にあり2箇所に分かれている問題 | `open-questions.md` に新項目として採用 | 未判断の運用課題。今回の更新が他の人に届かないという実害が既にある |
| 生成した2件のファイル名・索引の件数・目視確認の内容 | 採らない（この raw に残す） | 生成物そのものが実体で、wiki に転記すると二重管理になる |
| dry-run が26件になった内訳 | 採らない（この raw に残す）。前方一致の注意だけ wiki に採用 | 内訳は一時点の値。durable なのは「前方一致だから絞れ」の一点 |
| `package.json` の `og:tournaments` を直さなかった判断 | 採らない（この raw に残す）。「落ちる」事実だけ wiki に採用 | 判断の理由は raw で足りる。wiki の読者に必要なのは「使うな／こう使え」だけ |
| versus（対抗戦）の OGP が全年度で未生成であること | 採らない（この raw に残す） | 依頼の範囲外で未着手。着手するなら別途 |

---

## 追記（同日）: skill をリポジトリへ移し、`npm run og:tournaments` も直した

ユーザーから「repo内に移してほしい / ogの方も治せそうであれば直してほしい」。

### skill の移動

個人 skill 側の4件を `.claude/skills/` へ移した（内容は変えず、`diff -r` で同一を確認してから
個人側を削除）。以降、skill の変更は PR に載る。

| skill | 移動前 | 移動後 |
|---|---|---|
| `tournament-insight` | 個人 skill ディレクトリ | `.claude/skills/tournament-insight/` |
| `tournament-pdf-to-players` | 同上 | `.claude/skills/tournament-pdf-to-players/` |
| `tournament-venue-data` | 同上 | `.claude/skills/tournament-venue-data/` |
| `idea-backlog` | 同上 | `.claude/skills/idea-backlog/` |

個人 skill 側に残したのは汎用のもの（docx / pdf / pptx / xlsx / skill-creator / morning /
schedule / consolidate-memory / import-memory / explain-usage / llm-wiki-definition /
setup-claude / setup-cowork）。これらはプロジェクトに依存しない。

### `npm run og:tournaments` の修正

`tools/sns-images/run.sh` を足し、npm script をそこ経由にした。

```
"og:tournaments": "bash tools/sns-images/run.sh tools/sns-images/tournament_og.py"
```

`run.sh` は `SNS_IMAGES_PYTHON` > 有効化済み venv > `.venv` > `python3` の順に
python を選び、`import PIL` が通らなければ導入方法を案内して終了する。
`.venv` のパスを npm script に焼かなかったのは、venv を別の場所に置く環境で壊れるため。

あわせて Pillow を **`requirements-dev.txt`** に固定した（`Pillow==11.3.0`）。
ルートの `requirements.txt` に足さなかったのは、そこに書いたものが
Cloudflare Pages の本番ビルドで毎回 pip install されるため（ファイル冒頭のコメントの通り）。

### 直したついでに見つかった別のバグ

修正後に `npm run og:tournaments`（引数なし）を叩いたら、今度は python 側で落ちた。

```python
only_parts = args.only.split('/') if args.only else None
only_tid = only_parts[0] if only_parts else None
only_year = only_parts[1] if len(only_parts) > 1 else None   # ← None を len() に渡している
```

```
TypeError: object of type 'NoneType' has no len()
```

**`--only` 無しの実行が 2026-08-02 からずっと壊れていた。** docstring と
[public-pages.md](../wiki/public-pages.md) が「生成対象を一覧（書き込まない）」として
案内している使い方がこれで、`--only` を付けた実行だけが生きていた。
`only_parts` を `[]` にして修正。

**Pillow が無くて即落ちしていたので、その先の TypeError まで到達していなかった。**
2つ目のバグは1つ目のバグに隠れていたことになる。

### 修正後に見えたこと: OGP画像が119件不足している

引数なし dry-run が通るようになって初めて全体像が見えた。

```
生成対象: 456 件 / 対象外（決勝が未確定）: 20 件
```

一方 `data/tournaments/og-images.json` は **337件**。
**決勝が確定しているのに OGP画像を持っていない種目が 119 件ある**（既定の summary カードに
フォールバックしている）。`--only` 無しの実行が壊れていた間、全件生成が回せなかったのが
効いていると思われる。

今回は生成していない（依頼の範囲外・PNG 119枚≒5MB がコミットに乗るため）。
→ [open-questions](../wiki/open-questions.md)

## Compile Log（追記分）

| 項目 | 扱い | 理由 |
|---|---|---|
| `npm run og:tournaments` が使えるようになったこと・`run.sh` の python 選択順・引数の渡し方 | wiki `public-pages.md` の OGP 節と skill 工程5を**書き換え**（「落ちる」と書いた直後なので訂正が要る） | 直前の記述が誤りになったため。放置すると使えるコマンドを避け続けることになる |
| Pillow を `requirements-dev.txt` に分けた理由（本番ビルドが `requirements.txt` を pip install する） | `tools/sns-images/README.md` に採用 | 依存の置き場所の判断はツール群の README が正 |
| `--only` 無しが 2026-08-02 から壊れていたこと | wiki `public-pages.md` に1行だけ採用 | 「昔の記述どおりに動かなかった」ことを残さないと、直った今も避けられ続ける |
| OGP画像が119件不足していること | `open-questions.md` に新項目として採用 | 未着手の作業で、着手判断（PNG 5MB をコミットするか）が要る |
| skill 4件の移動先と、個人側に残した汎用 skill の一覧 | 採らない（この raw に残す）。open-questions の該当項目を「解決」に更新 | 移動そのものは1回きりの作業。durable なのは「プロジェクト skill は `.claude/skills/`」という置き場所の規約だけで、それは既に実体で表現されている |
| 2つ目のバグが1つ目に隠れていたという構造 | 採らない（この raw に残す） | 教訓として面白いが、wiki に一般則として書けるほどの再現性が無い |

---

## 追記2（同日）: 不足119件を生成。全件再生成は313枚を無意味に差し替えると分かった

ユーザーから「5MBが多くなければ走らせてほしい」。
リポジトリの規模（`.git` 115MB / `data/` 84MB / `public/og` 12MB）に対して4〜5MB増は
同じ桁の話ではないので、走らせた。

### 起きたこと

```
$ npm run og:tournaments -- --apply
  生成対象: 456 件 / 対象外（決勝が未確定）: 20 件

索引: 337 -> 456
  新規キー: 119   消えたキー: 0   画像が差し替わったキー: 313
```

**新規119件は想定どおりだが、既存337枚のうち313枚が差し替わった。**
`zennihon-primaryschool/2019` のようにデータが動くはずのない年まで含まれていたので調べた。

### 原因: フォントの解決結果が変わっていた

旧画像を git から取り出して画素比較した。

```
size: (1200, 630) (1200, 630)
差分bbox: (24, 14, 1176, 596)
差分ピクセル数: 76664 / 756000 (10.141%)  最大差: 228
```

10%のピクセルが変わっている一方、**並べて見ると内容は完全に同一**（名前・スコア・線・
エントリー番号すべて一致）。違うのは**グリフの描画**だけだった。ファイルサイズも
46,398 → 51,800 バイトに増えている。

`snslib.py` はフォントをシステムパスから解決している。

```python
_FONT_CANDIDATES_BOLD = [
    "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc",
    ...
```

初回生成（2026-07〜08）から今日までの間に OS かライブラリが更新され、同じ入力から
別のビットマップが出るようになった。内容ハッシュでファイル名を決める設計なので、
**中身が同じでも別ファイルになる**。

### 対応: 新規119件だけ採用した

依頼は「不足分を生成」であって「全件を作り直す」ではない。313枚の差し替えは
12MB前後の履歴を積むだけで見た目が1ミリも変わらないので、捨てた。

1. `git checkout -- public/og/tournaments` で既存337枚を復元
2. 新規119キーぶんの PNG だけ残し、既存キーの再レンダ PNG 313枚を削除
3. 索引を `before ∪ 新規119` で作り直し

結果: **追加119ファイル・索引1ファイルの変更のみ**（削除0・差し替え0）。
`public/og/tournaments` は 12MB → 16MB、PNG 456枚。
索引456件とファイル456枚が過不足なく一致することを確認した。

### 確認

- 新規画像の目視: インカレ2026 男子対抗は右下の日本体育大学が太字、決勝3-0。
  データ（`versus-none-boys` の優勝 entryNo 96 = 日本体育大学）と一致
- dev サーバ: インカレ2026 対抗／ダブルス、インターハイ2026 男子ダブルスとも
  `twitter:card` が `summary_large_image` になり、生成した PNG を指している

### 残った判断

**決定的な再現性は無いままにした。** フォントをリポジトリに置く、または生成をコンテナ化すれば
揃うが、「全件再生成しない・足りないぶんだけ足す」で運用できているうちは必要ない。
→ [open-questions](../wiki/open-questions.md)

## Compile Log（追記2分）

| 項目 | 扱い | 理由 |
|---|---|---|
| 全件 `--apply` は既存もほぼ全部差し替わる／原因はシステムフォントの解決／足りないぶんだけ足す手順 | wiki `public-pages.md` の OGP 節に採用 | 次に全件再生成する人が必ず踏む。しかも「差分が出た＝データが変わった」と誤読しやすいので、原因まで書かないと危ない |
| フォント環境に依存して再現性が無いこと・コンテナ化等は未判断 | `open-questions.md` に新項目として採用 | 未判断の設計課題。実害が出ていないので急がないが、記録が無いと毎回調べ直しになる |
| 119件を生成して不足が解消したこと・内訳 | `open-questions.md` の該当項目を「解決」に更新 | current-state の更新 |
| 画素差の実測値（10.141% / 最大差228 / bbox） | wiki には10.1%だけ採用、詳細はこの raw | 「見た目は同じなのに1割の画素が違う」という規模感だけが判断に効く |
| 復元手順の具体（git checkout → 再レンダ分を削除 → 索引をマージ） | wiki に要点だけ採用（「生成後に既存キーの再レンダ分を捨てて索引をマージし直す」） | コマンド列は raw で足りる。wiki には方針だけ |
| 20件が未生成のまま正しいこと（決勝未確定） | 採らない（この raw に残す） | 既に「決勝が未確定の種目は生成されない」と wiki に書いてある性質の再掲 |

---

## 追記3（同日）: `--changed` を実装し、全件 `--apply` を塞いだ

ユーザーから「skillでは更新があった大会だけを対象にog画像の生成が行われるようにしてほしい」。

追記2の対応（全件生成してから既存キーの再レンダ分を手で捨てる）は**その場しのぎ**で、
次に同じことをする人が同じ手作業をやり直すことになる。人の注意力ではなく
仕組みで絞る形にした。

### `--changed`

`data/tournaments/details/**` の更新から対象を機械的に決める。

- **未コミットの変更**（`git status --porcelain -- data/tournaments/details`）
- **`--base`（既定 `origin/main`）からブランチまでの差分**（`git diff --name-only base...HEAD`）

の**和**を取る。2つ足しているのは、実際の作業が
「取り込み → コミット → （後日）インサイト → OGP」という順になるため。
`git status` だけだと、コミット済みの取り込みを拾えない。

`git` が無い環境や `origin/main` が解決できない環境（単独クローン・未 fetch）では
警告を出して未コミット分だけで続行する。落とさない。

対象は実行時に一覧表示する。人が「今回の作業と一致するか」を目で確かめられるようにするため。

### 全件 `--apply` を塞いだ

`--apply` に `--changed` / `--only` / `--all` のいずれも付いていなければ、
使い方を表示して終了コード2で止まる。従来の全件は `--all` として明示的に指定する形へ退避した。

**塞いだのは、事故が静かだから。** 全件 `--apply` は何も警告せずに313枚を差し替え、
`git status` に大量の D と ?? が並ぶだけで、原因（フォントの解決結果が変わった）は
そこからは分からない。追記2で自分が実際に踏んで、画素比較するまで気付かなかった。

あわせて `sys.exit(main() or 0)` にした。`main()` が2を返しても
`sys.exit` を通していなかったので、**エラーなのに終了コード0**で返っていた。

### 検証

| ケース | 結果 |
|---|---|
| `--apply` 単独 | 使い方を表示して exit 2 |
| `--changed`（このブランチは details を触っていない） | 対象0件 |
| `--changed --base <#118 マージ前>` | **`zennihon-university/2026/doubles-none-boys` と `-girls` の2件**だけを列挙 |
| `--changed --apply`（同上） | 生成2件・`git status` は空＝churn なし（同じ環境なので同一ハッシュ） |
| 未コミット変更（`singles-none-boys.json` を1バイト変更） | その1件を検出。決勝未確定なので「対象外」に計上 |

`--changed --base <#118 マージ前>` が**ユーザーが実際に更新した2種目とちょうど一致**した。

## Compile Log（追記3分）

| 項目 | 扱い | 理由 |
|---|---|---|
| `--changed` の対象決定（未コミット + base からの差分の和）・`--apply` のガード・`--all` への退避 | wiki `public-pages.md` の OGP 節と skill 工程5に採用 | 実行方法が変わったので、両方の記述を更新しないと古い手順が残る |
| 「コミット前に `git status` を見て、既存 PNG の削除・差し替えが0件であることを確かめる」 | skill 工程5に採用 | `--changed` を付け忘れたときの最後の砦。機械のガードと人の確認を二重にする |
| 追記2の手作業（全件生成→再レンダ分を捨てる）はもう不要になったこと | wiki `public-pages.md` の該当箇所を書き換え | 手順として残すと、次の人が不要な回り道をする |
| `git` が無い / `origin/main` が無い環境での挙動 | 採らない（コード内のコメントとヘルプに残す） | 実装の詳細で、運用の判断には効かない |
| `sys.exit(main() or 0)` を入れた件 | 採らない（この raw に残す） | 単なるバグ修正。一般則にならない |
| 検証の表 | 採らない（この raw に残す） | 一時点の確認。再実行できる |
