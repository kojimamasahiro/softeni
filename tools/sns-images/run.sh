#!/usr/bin/env bash
# tools/sns-images/*.py を「Pillow が入っている python」で実行するためのラッパ。
#
# 背景（2026-09-09 追加）:
#   画像生成の依存は Pillow だけで、これは .venv にしか入れていない。本番ビルド
#   （Cloudflare Pages）はこれらのツールを走らせないので、ルートの requirements.txt には
#   足さない方針（あそこに書いたものは本番ビルドで毎回 pip install される）。
#   その結果 `python3 tools/sns-images/xxx.py` を直接叩くと
#   `ModuleNotFoundError: No module named 'PIL'` になる。
#   `npm run og:tournaments` が中で python3 を呼んでいて必ず落ちていたのを直すために追加した。
#
# 使い方:
#   bash tools/sns-images/run.sh tools/sns-images/tournament_og.py --apply --only <tid>
#   SNS_IMAGES_PYTHON=/path/to/python bash tools/sns-images/run.sh ...   # 環境を明示する場合
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

pick_python() {
  # 明示指定 > 有効化済みの venv > リポジトリの .venv > system python3
  if [ -n "${SNS_IMAGES_PYTHON:-}" ]; then
    printf '%s\n' "$SNS_IMAGES_PYTHON"
  elif [ -n "${VIRTUAL_ENV:-}" ] && [ -x "$VIRTUAL_ENV/bin/python" ]; then
    printf '%s\n' "$VIRTUAL_ENV/bin/python"
  elif [ -x "$ROOT/.venv/bin/python" ]; then
    printf '%s\n' "$ROOT/.venv/bin/python"
  else
    printf '%s\n' "python3"
  fi
}

PY="$(pick_python)"

if ! "$PY" -c 'import PIL' >/dev/null 2>&1; then
  cat >&2 <<MSG
tools/sns-images は Pillow を必要としますが、$PY に入っていません。

  python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt

を実行してから再実行してください。
（Pillow は画像生成ツール専用で本番ビルドでは使わないため、ルートの
 requirements.txt ではなく requirements-dev.txt に分けています）

別の環境を使う場合は SNS_IMAGES_PYTHON=/path/to/python を指定できます。
MSG
  exit 1
fi

exec "$PY" "$@"
