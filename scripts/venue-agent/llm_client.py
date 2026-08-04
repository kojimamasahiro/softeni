"""
ローカルOllamaへの薄いラッパー。

ツール呼び出し(function calling)は使わない。9Bクラスの小型モデルは
ツール呼び出しの信頼性が低いため、Pythonが読み書き・検証を全て担当し、
LLMには「このテキストをJSONに構造化する」という狭い判断だけを聞く設計。
"""
from __future__ import annotations

import json
import re

import requests

OLLAMA_URL = "http://localhost:11434/api/chat"
DEFAULT_MODEL = "qwen2.5:9b-instruct"


class OllamaError(RuntimeError):
    pass


def chat_json(system: str, user: str, model: str = DEFAULT_MODEL, timeout: int = 120) -> dict:
    """systemとuserを渡し、JSONオブジェクトを1つ返させる。

    Ollamaのformat="json"で構造化出力を強制するが、それでも壊れることがあるため
    パースに失敗したら例外を投げて呼び出し側で人に見せる。
    """
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "format": "json",
        "stream": False,
        "options": {"temperature": 0.1},
    }
    try:
        resp = requests.post(OLLAMA_URL, json=payload, timeout=timeout)
        resp.raise_for_status()
    except requests.RequestException as e:
        raise OllamaError(
            f"Ollamaへの接続に失敗しました({e})。"
            f"`ollama serve` が起動しているか、`ollama pull {model}` 済みか確認してください。"
        ) from e

    data = resp.json()
    content = data.get("message", {}).get("content", "")
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # まれにコードフェンス等が混ざる場合の救済
        m = re.search(r"\{.*\}", content, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                pass
        raise OllamaError(f"モデルの応答をJSONとして解釈できませんでした:\n{content}")
