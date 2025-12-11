from bs4 import BeautifulSoup
import re

with open("data/input.html", encoding="utf-8") as f:
    html = f.read()

soup = BeautifulSoup(html, "html.parser")

def clean(text):
    return re.sub(r"\s+", " ", text.strip())

def normalize_pref(pref):
    if pref in ["北北海道", "南北海道"]:
        return "北海道"
    return pref

def normalize_school_name(name):
    # 半角スペースがあれば前だけ残す
    return name.split(" ")[0]

def normalize_name(name):
    parts = re.split(r"\s+", name.strip())
    return "　".join(parts)  # 全角スペース

def split_numbered(text):
    """
    (1)AAA  (2)BBB (3)CCC のような形式を [AAA, BBB, CCC] に変換
    """
    parts = re.split(r"\(\d+\)", text)
    return [p.strip() for p in parts if p.strip()]


rows = []

# すべての table を処理
for table in soup.find_all("table"):

    trs = table.find_all("tr")

    # ヘッダーを除く
    for tr in trs[1:]:

        cols = tr.find_all(["th", "td"])
        if len(cols) < 4:
            continue

        prefecture = normalize_pref(clean(cols[0].get_text()))
        schools_raw = clean(cols[1].get_text())
        p1_raw = clean(cols[2].get_text())  # ダブルス1人目
        p2_raw = clean(cols[3].get_text())  # ダブルス2人目

        schools = split_numbered(schools_raw)
        players1 = split_numbered(p1_raw)
        players2 = split_numbered(p2_raw)

        # 個数のズレを吸収（学校を基準にする）
        max_len = max(len(schools), len(players1), len(players2))

        # 学校
        while len(schools) < max_len:
            schools.append("")
        # 1人目
        while len(players1) < max_len:
            players1.append("")
        # 2人目
        while len(players2) < max_len:
            players2.append("")

        # ペアごとに出力
        for s, p1, p2 in zip(schools, players1, players2):

            s = normalize_school_name(s)
            p1 = normalize_name(p1) if p1 else ""
            p2 = normalize_name(p2) if p2 else ""

            rows.append(f"{prefecture}\t{s}\t{p1}\t{p2}")


# 書き出し
with open("data/players.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(rows))

print("data/players.txt に書き出しました")