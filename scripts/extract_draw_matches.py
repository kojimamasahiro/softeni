import json
import re
import fitz  # PyMuPDF

# 1. 選手リスト
players = [
  {
    "id": "yano-soto",
    "name": "矢野颯人"
  },
  {
    "id": "kawasaki-kohei",
    "name": "川﨑康平"
  },
  {
    "id": "kataoka-aki",
    "name": "片岡暁紀"
  },
  {
    "id": "marunaka-taimei",
    "name": "丸中大明"
  },
  {
    "id": "hashimoto-asahi",
    "name": "橋本旭陽"
  },
  {
    "id": "uchimoto-takafumi",
    "name": "内本隆文"
  },
  {
    "id": "kurosaka-takuya",
    "name": "黒坂卓矢"
  },
  {
    "id": "hashiba-toichiro",
    "name": "橋場柊一郎"
  },
  {
    "id": "funemizu-hayato",
    "name": "船水颯人"
  },
  {
    "id": "hirooka-sora",
    "name": "広岡宙"
  },
  {
    "id": "nagae-koichi",
    "name": "長江光一"
  },
  {
    "id": "maruyama-kaito",
    "name": "丸山海斗"
  },
  {
    "id": "ando-yusaku",
    "name": "安藤優作"
  },
  {
    "id": "uematsu-toshiki",
    "name": "上松俊貴"
  },
  {
    "id": "yonekawa-yuto",
    "name": "米川結翔"
  },
  {
    "id": "motokura-kentaro",
    "name": "本倉健太郎"
  },
  {
    "id": "uchida-riku",
    "name": "内田理久"
  },
  {
    "id": "ueoka-shunsuke",
    "name": "上岡俊介"
  },
  {
    "id": "ando-kesuke",
    "name": "安藤圭祐"
  }
]

# 2. nameからidを探す辞書
name_to_id = {p["name"]: p["id"] for p in players}

# 3. PDFからテキスト抽出
def extract_text_from_pdf(pdf_path):
    text = ""
    doc = fitz.open(pdf_path)
    for page in doc:
        text += page.get_text()
    return text

# 4. 選手名が含まれる行を探し、ペアを抽出
def normalize_name(name):
    return re.sub(r"[ \u3000]", "", name).strip()


def parse_matches(text):
    lines = text.splitlines()
    matches = []
    seen_players = set()

    # フィルタ：候補となる選手名のみに限定
    player_lines = []
    for line in lines:
        name = normalize_name(line)
        if name in name_to_id and name not in seen_players:
            player_lines.append(name)
            seen_players.add(name)

    for i in range(0, len(player_lines) - 1, 1):
        name1 = player_lines[i]
        matches.append({
            "round": "1回戦",  # 必要なら外から渡せるようにしてもOK
            "player": {"name": name1, "id": name_to_id[name1]},
            "result": None,
            "score": None
        })

    return matches


# 5. 実行
pdf_path = "../A02_drow_M.pdf"
text = extract_text_from_pdf(pdf_path)
matches = parse_matches(text)

# 6. JSON構造を作成
result_json = {
    "tournament": "第32回 全日本シングルス選手権大会",
    "category": "男子シングルス",
    "matches": matches
}

# 7. 結果を保存（任意）
with open("../match-editor/data/output.json", "w", encoding="utf-8") as f:
    json.dump(result_json, f, ensure_ascii=False, indent=2)

