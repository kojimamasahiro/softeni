# venue-agent

`tournament-venue-data` スキルの一部を、ローカルLLM(Ollama)でオフロードするためのツール。

## 設計方針

抽出・検証は決定的なスクリプトが担い、LLM(ローカル9Bクラス)には
「このテキストをどう構造化するか」という狭い判断だけを聞きます。
ツール呼び出し(function calling)は使わず、Pythonが読み書き・検証をすべて主導します。
9Bクラスのモデルは自律的なツール呼び出しの信頼性が低いためです。

```
PDF
 └─(決定的: pdfplumber)→ 「4. 会場」節のテキスト ★ここで一度必ず人に見せる
     └─(LLM判断)→ 施設ごとのJSON
         └─(決定的: checks.py)→ prefecture/address突合・郵便番号/電話番号の桁チェック・surface語彙チェック
             └─ draft-*.json (要確認フラグ付き)
                 └─(人が目視/修正)→ apply → data/tournaments/information/*.json
                     └─(決定的)→ 全件の検算を再実行してから確定
```

`data/tournaments/information/*.json` を直接は書き換えません。
`extract` は必ず draft ファイルを作るだけで、`apply` を人が明示的に実行して初めて本番に反映されます。

## セットアップ (お使いのMacBook Air M4 / 16GBで)

```bash
# 1. Ollamaのインストール
brew install ollama
ollama serve &   # または Ollamaアプリを起動しておく

# 2. モデルの取得 (Q4量子化、約7GB。16GB機でも余裕あり)
ollama pull qwen2.5:9b-instruct

# 3. Python依存関係
pip3 install --break-system-packages pdfplumber requests
```

このディレクトリ(venue-agent)を、プロジェクトのルート付近(例: `scripts/venue-agent/`)に置いてください。

## 使い方

### 1. まず決定的チェックだけ動作確認する(Ollama不要)

```bash
python3 test_regression.py
```

SKILL.mdに載っている実例(福山市/福知山市の誤記、東舞鶴公園のTEL桁落ち等)がちゃんと
検出できるかのテストです。ここが通らないうちはLLMを使う意味がありません。

### 2. 要項PDFから抽出してdraftを作る

```bash
python3 venue_agent.py extract 要項.pdf \
  --tournament-id zennihon-senior --year 2026 \
  -o draft-zennihon-senior-2026.json \
  --data-dir /path/to/softeni-pick/data/tournaments/information
```

- 「会場」節の自動抽出は見出し表記のゆれに弱いベストエフォートです。抽出結果は毎回
  コンソールに全文表示され、進めるかどうか確認を求めます。ズレていたら中断して、
  該当ページのテキストを手でファイルに貼り、`--section-text そのファイル` で渡し直してください。
- 施設ごとにLLMへ問い合わせ、返ってきたJSONをその場で `checks.py` にかけます。
  prefecture/addressの不一致、郵便番号・電話番号の桁落ち疑い、未知のsurface表記は
  `_status: "needs_review"` として draft に残ります(自動では直しません)。

### 3. draftを見る・直す

`draft-*.json` を開いて、`_status` が `needs_review` の項目を確認してください。
`_check_results` に理由が入っています。必要ならフィールドを手で修正し、
`_status` / `_check_results` はそのまま残しておいても `apply` 側で自動的に取り除かれます
(ただし `needs_review` が残っていると `apply` は止まります)。

### 4. 本番へ反映する

```bash
python3 venue_agent.py apply draft-zennihon-senior-2026.json \
  --tournament-id zennihon-senior --year 2026 \
  --data-dir /path/to/softeni-pick/data/tournaments/information \
  --guideline-url https://www.jsta.or.jp/wp-content/uploads/t_records/2026/2026_A01_10c.pdf
```

`needs_review` が1件でも残っていると中断します。中身を確認したうえで
強制的に反映したい場合のみ `--force` を付けてください。

反映後、SKILL.md記載の検算(prefecture/address突合・JSON構文チェック)を
**対象ファイルだけでなく `data-dir` 配下の全ファイルに対して**再実行し、結果を表示します。

## 既知の限界

- `surface` の語彙チェックは「既存データに無い新表記」を警告するだけで、それが表記ゆれなのか
  正当な新語彙なのかはLLMも機械チェックも判定できません。人の目が必要です。
- 「会場が日別・種目別に分かれていないか」の一次判定はLLM任せです(SKILL.mdの進め方1)。
  ここを見落とすと venues の対応が丸ごとズレるので、draft生成直後の `facilities_raw` の
  件数・内容は必ず元PDFと突き合わせてください。
- `venue-candidates.json` とのconfidenceマッチング(SKILL.md記載)はこのツールに未実装です。
  開催地の精緻化はまだ手動、または別途スクリプトで行ってください。
- ここでの機械チェックは「福山市/福知山市」のような**住所と県名の矛盾**は確実に拾いますが、
  住所自体が誤記でprefecture/addressの両方が同じ間違った県を指しているケース(矛盾が無い誤り)は
  原理的に検出できません。これはSKILL.mdの検算スクリプトも同じ限界を持っています。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `venue_agent.py` | CLI本体 (`extract` / `apply`) |
| `checks.py` | 決定的な検証ロジック(LLM不使用) |
| `llm_client.py` | Ollamaへの薄いラッパー |
| `prompts.py` | SKILL.mdの判断ルールを凝縮したプロンプト |
| `test_regression.py` | 実例ベースの回帰テスト(Ollama不要) |
