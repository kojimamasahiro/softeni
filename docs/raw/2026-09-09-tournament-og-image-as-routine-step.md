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
