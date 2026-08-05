#!/usr/bin/env bash
# 高校ソフトテニス データパイプラインを、正しい順序で一括実行する。
#
# 背景: 各ステップは手動で README の順に実行する運用だったため、
# 「results.json だけ更新されて summary 系が古いまま」といった取りこぼしが発生した
# （例: highschool-championship 2026 の結果は入っているのに、大会結果ページの
#   チームリンクが機能しない、という不具合）。
# このスクリプトはその手順を1コマンドにまとめ、実行漏れ・順序間違いを防ぐ。
#
# 使い方:
#   bash scripts/highschool/run-pipeline.sh
#   npm run highschool:pipeline
#
# 各ステップの入出力は scripts/highschool/README.md を参照。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# .venv があればそれを使う。無ければ python3 にフォールバック
# （ローカル開発機の venv は他環境に持ち越せないシンボリックリンクのため）。
PY="$ROOT_DIR/.venv/bin/python"
if [ ! -x "$PY" ]; then
  PY="python3"
fi

echo "▶ python: $PY"
echo ""

step() {
  echo "── $1 ─────────────────────────────"
}

# --- 0. チームマスタの更新 ---------------------------------------------
# data/tournaments/details/highschool-* を全走査して、未登録の学校を
# scripts/highschool/01team/teams.json に追記する。
step "0/5 チームマスタ更新 (01team/entries-to-teams.py)"
(cd "$SCRIPT_DIR/01team" && "$PY" entries-to-teams.py)

# --- 1. 大会結果の抽出 ---------------------------------------------------
step "1/5 大会結果抽出 (02result/extract.py)"
(cd "$SCRIPT_DIR/02result" && "$PY" extract.py)

# --- 2. 都道府県別サマリー生成 -------------------------------------------
step "2/5 都道府県別サマリー生成 (03list/summary.py)"
(cd "$SCRIPT_DIR/03list" && "$PY" summary.py)

# --- 3. 都道府県ごとのサマリーファイル生成 --------------------------------
step "3/5 都道府県別ファイル生成 (04summry/generate_prefecture_summaries.py)"
(cd "$SCRIPT_DIR/04summry" && "$PY" generate_prefecture_summaries.py)

# --- 4. 学校別分析データ生成 ----------------------------------------------
step "4/5 学校別分析データ生成 (analysis/generate_school_analysis.py)"
(cd "$SCRIPT_DIR/analysis" && "$PY" generate_school_analysis.py)

# --- 5. サイトが直接参照するファイルへのコピー -----------------------------
# data/highschool/teams.json と data/highschool/prefecture-summary.json は
# scripts/highschool 配下の生成物を手動コピーする運用（01team/MEMO, 03list/MEMO）。
# 大会結果ページのチームリンクは data/highschool/prefecture-summary.json を直接読むため、
# このコピーを忘れると「パイプラインは回したのにリンクが直らない」状態になる。
step "5/5 data/highschool/ への反映"
cp "$SCRIPT_DIR/01team/teams.json" "$ROOT_DIR/data/highschool/teams.json"
cp "$SCRIPT_DIR/03list/prefecture-summary.json" "$ROOT_DIR/data/highschool/prefecture-summary.json"
echo "  ✅ data/highschool/teams.json を更新しました"
echo "  ✅ data/highschool/prefecture-summary.json を更新しました"

# 元データの内容ハッシュを記録する。check-highschool-pipeline-freshness.mjs（ビルド時チェック）が
# 「今の元データに対してパイプラインが実行済みか」をタイムスタンプなしで判定するために使う。
# このマーカーファイルは、この実行で生成された他のファイルと一緒にコミットすること。
node "$ROOT_DIR/scripts/highschool/write-pipeline-marker.mjs"

# --- 6. フォーマット -------------------------------------------------------
if command -v npx >/dev/null 2>&1; then
  step "6/6 prettier"
  (cd "$ROOT_DIR" && npx prettier --write data/highschool >/dev/null 2>&1) || echo "  ⚠ prettier をスキップしました（npx 実行不可）"
fi

echo ""
echo "✅ 高校ソフトテニス データパイプラインが完了しました。"
