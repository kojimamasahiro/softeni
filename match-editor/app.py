from flask import Flask, request, render_template
import json
import os

app = Flask(__name__)

# ファイルパス
DATA_PATH = os.path.join(os.path.dirname(__file__), 'data/output.json')

# 空文字を None に変換（→ JSON では null）
def none_if_empty(value):
    return value if value != "" else None

@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        matches = []
        total = int(request.form.get("total_matches", 0))
        for i in range(total):
            matches.append({
                "round": request.form.get(f"round_{i}", ""),
                "player": {
                    "name": request.form.get(f"player_{i}", ""),
                    "id": request.form.get(f"id_{i}", "")
                },
                "result": none_if_empty(request.form.get(f"result_{i}", "")),
                "score": none_if_empty(request.form.get(f"score_{i}", ""))
            })

        # 既存データ読み込み・上書き
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        data["matches"] = matches

        # 保存（ensure_ascii=False で日本語をそのまま保存）
        with open(DATA_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return render_template("index.html", matches=matches, total=len(matches))

    # 初期表示
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return render_template("index.html", matches=data["matches"], total=len(data["matches"]))

if __name__ == "__main__":
    app.run(debug=True)
