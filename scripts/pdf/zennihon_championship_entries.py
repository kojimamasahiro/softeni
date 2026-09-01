#!/usr/bin/env python3
"""天皇賜杯・皇后賜杯 全日本ソフトテニス選手権大会 ドロー表PDF → initialPlayers JSON。

対象レイアウト（2019年度 = 令和元年度 第74回、`2019_A08_40.pdf` で検証）:

    [番号] [氏名フィールド] ( [都道府県] [所属] ) [スコア]      ← 左ブロック
    [スコア] [氏名フィールド] ( [都道府県] [所属] ) [番号]      ← 右ブロック

1エントリー = 3行（選手1 / 括弧行 / 選手2）。括弧行にエントリー番号が入る。
都道府県・所属はペアで共通なら括弧行に、選手ごとに異なれば選手の行に印字される
（両方が異なる場合、括弧の中身は空になる）。そのため

    その選手の行に値があればそれを、無ければ括弧行の値を使う

という解決になる。

氏名は7スロット固定グリッド（全角スペース詰め）で、
    スロット0-2 = 姓 / スロット3 = 区切り / スロット4-6 = 名
という規則で分割できる（`藤　森　　　源` = 藤森+源、`林　　　大喜` = 林+大喜、
`柳　田　賢太朗` = 柳田+賢太朗）。姓が4文字のときだけスロット3まで食い込む
（`小　茄　子　川　　夏　月` = 小茄子川+夏月）。座標は定数で持たず、ページ・ブロック
ごとにグリッドの基準x・ピッチを実測する（男子ページはピッチ8.74pt、女子は8.51pt）。

行の組み立ては文字の **上端ではなく上下中心** で行う。所属欄はフォントが本文より
小さくなることがあり（列幅に収まらない長い名前）、上端で揃えると別の行に流れるため。

使い方:
    python3 scripts/pdf/zennihon_championship_entries.py INPUT.pdf \
        --pages 1-4 --out tools/zennihon-championship-2019/doubles-none-boys.initialPlayers.json
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import unicodedata
from collections import Counter, defaultdict

import pdfplumber

IDEOGRAPHIC_SPACE = "　"
PARENS = "()（）"

PREFECTURES = [
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
    "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
    "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
    "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
]
PREF_BY_SHORT = {(p if p == "北海道" else p[:-1]): p for p in PREFECTURES}

# 都道府県ではないが、この大会の「都道府県」欄に正規に現れる所属区分
NON_PREFECTURE_AFFILIATIONS = {"日本学連", "学連", "日本連盟", "高体連", "中体連", "実業団"}

# 都道府県名に現れる異体字。紙面のまま持つと47都道府県の辞書に当たらない。
PREF_VARIANTS = str.maketrans({"冨": "富", "德": "徳"})

# 氏名の異体字。紙面がどちらで刷られるかは年度で変わるため、**既存データに同一人物が
# 別字で居るときだけ**そちらへ寄せる（姉妹年度と結合できることを優先する。
# docs/wiki/data-import.md「スキャンPDF」節の異体字方針と同じ）。
# 一律に正規化はしない。`岩﨑拓斗` `川﨑海奈` のように異体字が正しい人が実在する。
NAME_VARIANTS = {"髙": "高", "黑": "黒", "﨑": "崎", "濵": "濱", "德": "徳", "眞": "真"}

SCORE_CHARS = set("0123456789①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮")


def is_name_char(text: str) -> bool:
    if text == IDEOGRAPHIC_SPACE:
        return True
    if not text.strip():
        return False
    if text in SCORE_CHARS or text in PARENS or text in "・．.":
        return False
    return unicodedata.category(text[0]).startswith("L")


def center(c):
    return (c["top"] + c["bottom"]) / 2


def make_lines(chars, tol=1.5):
    """文字を上下中心でテキスト行にまとめる。戻り値は [(中心y, [文字...])]。"""
    lines = []
    for c in sorted(chars, key=center):
        if lines and center(c) - lines[-1][0] <= tol:
            lines[-1][1].append(c)
            lines[-1][0] = center(c)
        else:
            lines.append([center(c), [c]])
    return [(sum(center(x) for x in cs) / len(cs), sorted(cs, key=lambda x: x["x0"]))
            for _, cs in lines]


def widest_gap(chars, lo, hi):
    """[lo, hi) の中で、どの文字にも覆われていない最も広い帯の中心を返す。"""
    spans = sorted((c["x0"], c["x1"]) for c in chars if lo <= c["x0"] < hi)
    if not spans:
        return (lo + hi) / 2
    best, best_w = None, 0.0
    cur = spans[0][1]
    for x0, x1 in spans[1:]:
        if x0 - cur > best_w:
            best_w, best = x0 - cur, (cur + x0) / 2
        cur = max(cur, x1)
    return best if best is not None else (lo + hi) / 2


def detect_paren_columns(chars):
    """左右2ブロックの括弧列のx0を、出現数の多い順で確定する。

    見出し「男子 (1)」の括弧が1個だけ混ざるので、最頻の2本だけを採る。
    """
    opens = Counter(round(c["x0"], 1) for c in chars if c["text"] in "(（")
    closes = Counter(round(c["x0"], 1) for c in chars if c["text"] in ")）")
    ox = sorted(x for x, _ in opens.most_common(2))
    cx = sorted(x for x, _ in closes.most_common(2))
    if len(ox) != 2 or len(cx) != 2:
        raise RuntimeError(f"括弧列を2本検出できませんでした: {ox} / {cx}")
    return [(ox[0], cx[0]), (ox[1], cx[1])]


def detect_name_grid(chars, x_hi, x_lo=0.0):
    """氏名フィールドの等間隔スロットのx0を実測する。

    スロット数は年度で違う（2019年度=7スロット、2018年度=5スロット）ので決め打ちしない。
    ただし **出現数だけでスロットを選んではいけない**。埋まる行が少ないスロットがあり
    （2019年度 p6 右ブロックの5番目）、頻度で切ると氏名欄が途中で切れて名が所属列へ流れる。
    そこで「基準位置とピッチは高頻度の2本から取り、あとは文字が存在するかどうかで伸ばす」。
    """
    xs = Counter(round(c["x0"], 1) for c in chars
                 if x_lo < c["x0"] < x_hi and is_name_char(c["text"]))
    if not xs:
        raise RuntimeError("氏名フィールドを検出できませんでした")
    peak = max(xs.values())
    # 確実にスロットである位置（姓の1・2文字目は全行に出るので必ず高頻度になる）
    core = sorted(x for x, n in xs.items() if n >= peak * 0.6)
    if len(core) < 2:
        raise RuntimeError(f"氏名スロットが少なすぎます: {core}")
    base, pitch = core[0], core[1] - core[0]
    if pitch <= 0:
        raise RuntimeError(f"氏名スロットのピッチを取れません: {core}")
    seen = sorted(xs)
    grid = [base]
    while True:
        nxt = grid[-1] + pitch
        hit = next((x for x in seen if abs(x - nxt) <= 1.0), None)
        if hit is None or hit >= x_hi:
            break
        grid.append(hit)
    if len(grid) < 3:
        raise RuntimeError(f"氏名スロットが等間隔に並びません: {core}")
    return grid, pitch


def text_of(cs):
    return "".join(c["text"] for c in cs).strip()


def merge_nakaguro(lines, note):
    """都道府県欄で折り返された行をまとめる。

    2017年度は「都道府県・連盟」（`奈良・高体連`、`岐阜・高体連`、`宮城・中体連`）が
    列幅に入りきらず2行に折り返される。所属欄の折り返しと違って**末尾の `・` が
    続きがあることを示している**ので、そこを条件にできる（座標での推測が要らない）。
    """
    if len(lines) < 2:
        return lines
    out = []
    i = 0
    while i < len(lines):
        y, cs = lines[i]
        while i + 1 < len(lines) and text_of(cs).endswith("・"):
            nxt = lines[i + 1][1]
            note(f"都道府県の折り返しを結合: {text_of(cs)}{text_of(nxt)}")
            cs = cs + nxt
            i += 1
        out.append((sum(center(c) for c in cs) / len(cs), cs))
        i += 1
    return out


def load_team_vocabulary():
    """既知のチーム名（NFKC正規化形）。所属欄の折り返しを見分けるために使う。"""
    import glob
    def n(x):
        return unicodedata.normalize("NFKC", x).replace(" ", "").replace("　", "").replace("･", "・")
    out = set()
    teams_path = os.path.join("data", "teams", "teams.json")
    if os.path.exists(teams_path):
        with open(teams_path, encoding="utf-8") as f:
            for t in json.load(f):
                out.add(n(t["name"]))
    alias_path = os.path.join("data", "tournaments", "team-name-aliases.json")
    if os.path.exists(alias_path):
        with open(alias_path, encoding="utf-8") as f:
            for e in json.load(f).get("teamAliases", []):
                out.add(n(e["canonical"]))
                for a in e.get("aliases", []):
                    out.add(n(a))
    for path in glob.glob(os.path.join("data", "tournaments", "details", "**", "*.json"), recursive=True):
        try:
            with open(path, encoding="utf-8") as f:
                d = json.load(f)
        except (ValueError, OSError):
            continue
        if not isinstance(d, dict):
            continue
        for pl in d.get("participants", []):
            if isinstance(pl, dict) and pl.get("team"):
                out.add(n(pl["team"]))
    return out


def merge_wrapped(lines, note, teams):
    """所属欄で折り返された行を1つにまとめる。

    **座標では折り返しと「隣のエントリーの所属」を区別できない**ことを実測で確認してある
    （行送りも列幅の使い切りも、正当な隣接ペアと重なる。2017年度は幾何条件だけだと
    60件が候補に挙がるが本物は6件）。そこで意味的な条件で決める:

      1. 次の行が `・` で始まる（`青森県高体連` + `・教員クラブ`）
      2. 直前の行が `附属` / `付属` で終わる（`東洋大学附属` + `牛久高校`）
      3. 連結した文字列が既知のチーム名（`八戸工業大学` + `第一高校`、
         `神戸松蔭女子学院大` + `学`）
      4. 次の行が1文字（既知データに無い新チームの折り返しを取りこぼさないための保険）

    誤結合には気づけないので、結合したものは必ず警告に出す。
    """
    if len(lines) < 2:
        return lines
    def key(x):
        return unicodedata.normalize("NFKC", x).replace(" ", "").replace("　", "").replace("･", "・")
    out = []
    i = 0
    while i < len(lines):
        y, cs = lines[i]
        while i + 1 < len(lines):
            nxt = lines[i + 1][1]
            head, tail = text_of(cs), text_of(nxt)
            if not (tail.startswith("・")
                    or head.endswith(("附属", "付属"))
                    or key(head + tail) in teams
                    or len(tail) == 1):
                break
            # 幾何の裏付け（同じ左端・直上の行が列幅をほぼ使い切っている）も課す
            size = max(c["size"] for c in cs)
            max_right = max(max(c["x1"] for c in ls) for _, ls in lines)
            if (abs(nxt[0]["x0"] - cs[0]["x0"]) > 0.5
                    or max(c["x1"] for c in cs) < max_right - 1.5 * size
                    or lines[i + 1][0] - y > 1.6 * size):
                break
            note(f"所属名の折り返しを結合: {head} + {tail}")
            # 行末・行頭の空白は組版の詰めもので名前の一部ではない
            # （`東洋大学附属　` + `牛久高校` を素に繋ぐと中黒ならぬ全角空白が残る）
            while cs and not cs[-1]["text"].strip():
                cs = cs[:-1]
            while nxt and not nxt[0]["text"].strip():
                nxt = nxt[1:]
            cs = cs + nxt
            i += 1
        out.append((sum(center(c) for c in cs) / len(cs), cs))
        i += 1
    return out


def load_name_vocabulary(reference_paths):
    """既知の (姓, 名) / 姓 / 名 の語彙。姓名の境界が座標で決まらないときに使う。

    出典は `data/tournaments/details/**`（取り込み済みの大会結果＝一次情報）。
    `--reference` で隣接年度のステージング（tools/**.initialPlayers.json）も足せる。
    高校生は3年で入れ替わるので、近い年度を足すほど当たる。

    **誤った分割を語彙に入れない**のが肝。`data/players/name-split-aliases.json` に
    人手判断で「誤り」と確定した分割が蓄積されており（`小茄子 / 川湊`）、これを入れると
    `小茄子` が既知の姓として振る舞い、`小茄子川夏月` を `小茄子｜川夏月` と誤って割る。
    """
    blocked = set()
    canonical = []
    alias_path = os.path.join("data", "players", "name-split-aliases.json")
    if os.path.exists(alias_path):
        with open(alias_path, encoding="utf-8") as f:
            table = json.load(f)
        for e in table.get("entries", []):
            canonical.append(tuple(e["canonical"]))
            for a in e.get("aliases", []):
                blocked.add(tuple(a))

    pairs = Counter()

    def add(ln, fn, n=1):
        if ln and fn and (ln, fn) not in blocked:
            pairs[(ln, fn)] += n

    details = os.path.join("data", "tournaments", "details")
    for root, _dirs, files in os.walk(details):
        if os.path.basename(root) == "temp":
            continue
        for name in files:
            if not name.endswith(".json"):
                continue
            try:
                with open(os.path.join(root, name), encoding="utf-8") as f:
                    d = json.load(f)
            except (ValueError, OSError):
                continue
            if not isinstance(d, dict):
                continue
            for p in d.get("participants", []):
                if isinstance(p, dict):
                    add(p.get("lastName"), p.get("firstName"))
    for c in canonical:
        add(c[0], c[1], 5)
    for path in reference_paths:
        with open(path, encoding="utf-8") as f:
            for e in json.load(f):
                for x in e.get("information", []):
                    add(x.get("lastName"), x.get("firstName"))

    last, first = Counter(), Counter()
    for (ln, fn), n in pairs.items():
        last[ln] += n
        first[fn] += n
    return pairs, last, first


def split_name(slots, size, vocab, overrides=None, used=None):
    """スロット番号→文字 の辞書から (姓, 名, 判定の根拠) を返す。

    `overrides` は人が確定させた分割（`--name-split`）。座標でも既知データでも決まらない
    行があるため（フォントを縮めて詰め込んだ行はスロット分割自体が効かない）、
    最後は人の判断を受け取れるようにしてある。

    フィールドは「姓を左詰め・名を右詰めにし、中央のスロットを空ける」という組み方。
    したがって **中央スロット** が境界になる。2019年度は7スロット（姓0-2 / 名4-6）、
    2018年度は5スロット（姓0-1 / 名3-4）で、どちらも中央が空く。

    中央スロットが埋まっている行は、**座標だけでは姓名の境界が決まらない**
    （`小田島|俊介` と `加藤|健太郎` が同じ形になる。2018年度は714行中100行がこれ）。
    その場合だけ既知の姓名で決める。決まらなければ姓2文字を仮に採り、要目視として返す。
    """
    full = "".join(slots[i] for i in sorted(slots))
    if overrides and full in overrides:
        if used is not None:
            used.add(full)
        return overrides[full][0], overrides[full][1], None

    sep = (size - 1) // 2
    head = "".join(slots[i] for i in sorted(slots) if i < sep)
    tail = "".join(slots[i] for i in sorted(slots) if i > sep)
    mid = slots.get(sep, "")
    if not mid:
        return head, tail, None

    pairs, last, first = vocab
    cands = [(head + mid, tail), (head, mid + tail)]
    exact = [c for c in cands if pairs.get(c)]
    if len(exact) == 1:
        return exact[0][0], exact[0][1], None
    # 姓・名それぞれの既知度で決める（姓の一致を重く見る。名は表記の幅が広いため）
    score = [2 * (last.get(a, 0) > 0) + (first.get(b, 0) > 0) for a, b in cands]
    if score[0] != score[1] and max(score) >= 2:
        best = cands[score.index(max(score))]
        return best[0], best[1], None
    return cands[1][0], cands[1][1], f"{head}{mid}{tail}（{cands[1][0]}｜{cands[1][1]} と仮置き）"


def fold_name_variant(last, first, vocab, note, apply_fold):
    """紙面の異体字を、既存データに同一人物が居るときだけそちらへ寄せる。

    2017年度は `髙橋柚圭` `黑木瑠璃華` `岡﨑聡太` のように異体字で刷られており、
    そのままだと2018年度の `高橋柚圭` `黒木瑠璃華` `岡崎聡太` と別人になる。
    ただし **一律の正規化はしない**——`岩﨑拓斗` `川﨑海奈` のように異体字が正しい人が
    実在するため、「紙面の表記が既存に無く、かつ異体字を畳んだ表記がちょうど1つ既存にある」
    ときだけ候補になる。

    **既定では寄せず、候補を警告に出すだけ**にしてある。どちらの字を採るかは
    データ全体に効く方針判断で、既に確定した年度の出力を黙って書き換えたくないため
    （`--fold-name-variants` を渡したときだけ実際に寄せる）。
    """
    pairs = vocab[0]
    if (last, first) in pairs:
        return last, first
    folded = ("".join(NAME_VARIANTS.get(c, c) for c in last),
              "".join(NAME_VARIANTS.get(c, c) for c in first))
    if folded == (last, first) or folded not in pairs:
        return last, first
    if apply_fold:
        note(f"異体字を既存データの表記へ寄せた: {last}{first} -> {folded[0]}{folded[1]}")
        return folded
    note(f"異体字の候補（未適用。既存データには {folded[0]}{folded[1]} がある）: {last}{first}")
    return last, first


def normalize_prefecture(raw):
    raw = (raw or "").strip()
    if not raw:
        return None, False
    # `奈良・高体連`（2017年度）や `近畿・滋賀県`（全中）のように2つの区分が
    # 中黒で連結される様式がある。**都道府県の側を採る**。
    # `participants[].prefecture` は正準な47都道府県を持つのが原則で、連盟は
    # 「県が分からないときに県の代わりに入る値」という位置づけのため
    # （docs/wiki/data-import.md「ルール: 都道府県は省略しない」）。
    if "・" in raw:
        for part in raw.split("・"):
            part = part.strip()
            if part in PREFECTURES or part in PREF_BY_SHORT:
                return PREF_BY_SHORT.get(part, part), True
    if raw in NON_PREFECTURE_AFFILIATIONS or raw in PREFECTURES:
        return raw, True
    if raw in PREF_BY_SHORT:
        return PREF_BY_SHORT[raw], True
    # 都道府県名の異体字（2017年度 男子76は `冨山`）。`scripts/normalize-prefectures.mjs` の
    # Tier B（明示マップで一意復元）と同じ考え方だが、ステージングの時点で正しくしておく。
    folded = raw.translate(PREF_VARIANTS)
    if folded in PREFECTURES or folded in PREF_BY_SHORT:
        return PREF_BY_SHORT.get(folded, folded), True
    return raw, False


def extract_block(chars, open_x, close_x, x_lo, side, warnings, page_no, vocab, overrides, used, fold_variants, teams):
    """1ブロック（左または右の1列）を解析する。

    x_lo … このブロックの左端。右ブロックでは中央のスコア帯を跨がないための下限。
    """
    def note(msg):
        warnings.append(f"p{page_no} {side}: {msg}")

    grid, pitch = detect_name_grid(chars, open_x, x_lo)
    # 氏名が枠に入りきらない行はフォントを縮めるため、両端がスロットから半文字ぶんはみ出す
    # （2017年度 `ミヒニャック　瑠偉` の `ミ` はスロット0より1.3pt左にあり、余裕1.0ptでは落ちた）。
    # 番号列・スコア列とは20pt以上離れているので、0.4スロットぶん広げても混ざらない。
    name_lo, name_hi = grid[0] - pitch * 0.4, grid[-1] + pitch
    split_x = widest_gap([c for c in chars if open_x < c["x0"] < close_x], open_x, close_x)

    def picks(pred):
        return [c for c in chars if pred(c)]

    name_rows = make_lines(picks(
        lambda c: name_lo <= c["x0"] < name_hi and is_name_char(c["text"])))
    paren_rows = make_lines(picks(
        lambda c: c["text"] in "(（" and abs(c["x0"] - open_x) < 1.0))
    pref_lines = merge_nakaguro(make_lines(picks(
        lambda c: open_x <= c["x0"] < split_x and c["text"] not in PARENS)), note)
    team_lines = merge_wrapped(make_lines(picks(
        lambda c: split_x <= c["x0"] <= close_x and c["text"] not in PARENS)), note, teams)
    num_lines = make_lines(picks(
        lambda c: c["text"].isdigit()
        and (c["x1"] <= name_lo if side == "left" else c["x0"] > close_x)))

    anchors = sorted(
        [{"y": y, "kind": "name", "chars": cs} for y, cs in name_rows]
        + [{"y": y, "kind": "paren", "chars": cs} for y, cs in paren_rows],
        key=lambda a: a["y"])
    if not anchors:
        return []
    for a in anchors:
        a.update(pref="", team="", number="")

    def attach(lines, field):
        for y, cs in lines:
            best = min(anchors, key=lambda a: abs(a["y"] - y))
            best[field] = (best[field] + text_of(cs)) if best[field] else text_of(cs)

    attach(pref_lines, "pref")
    attach(team_lines, "team")
    attach(num_lines, "number")

    entries = []
    for i, row in enumerate(anchors):
        if row["kind"] != "paren":
            continue
        players = [anchors[j] for j in (i - 1, i + 1)
                   if 0 <= j < len(anchors) and anchors[j]["kind"] == "name"]
        if len(players) != 2:
            note(f"番号{row['number'] or '?'}: 選手行が{len(players)}件")
            continue
        info = []
        for pl in players:
            slots = {}
            for c in pl["chars"]:
                if c["text"] == IDEOGRAPHIC_SPACE:
                    continue
                # 氏名が枠に入りきらない行はフォントを縮めて詰め込むので、文字が
                # スロットの整数倍からずれる（2018年度 `ミヒニャック　瑠偉` は9文字を
                # 5スロットに詰めており、最終スロットを超えた `偉` が落ちていた）。
                # 氏名欄の中にある文字は捨てず、両端のスロットへ寄せる。
                idx = int(round((c["x0"] - grid[0]) / pitch))
                idx = min(max(idx, 0), len(grid) - 1)
                slots[idx] = slots.get(idx, "") + c["text"]
            last, first, unsure = split_name(slots, len(grid), vocab, overrides, used)
            last, first = fold_name_variant(last, first, vocab, note, fold_variants)
            if unsure:
                note(f"番号{row['number']}: 姓名の境界を既知データで決められない {unsure}")
            pref, ok = normalize_prefecture(pl["pref"] or row["pref"])
            if not ok:
                note(f"番号{row['number']}: 都道府県辞書に無い {pref!r}")
            team = pl["team"] or row["team"]
            info.append({
                "lastName": last, "firstName": first, "team": team,
                "prefecture": pref, "playerId": None,
                "tempId": f"{last}_{first}_{team}",
            })
        # 番号は普通は括弧行にあるが、ページによっては1人目の行に印字される
        # （2018年度 女子 p16/p17 の右ブロックは括弧行より11pt上に出る）。
        # エントリー単位の値なので、括弧行に無ければ選手の行から拾う。
        number = row["number"] or players[0]["number"] or players[1]["number"]
        if not number:
            note(f"y={row['y']:.0f}: エントリー番号が見つからない "
                 f"{info[0]['lastName']}・{info[1]['lastName']}")
        entries.append({
            "number": int(number) if number.isdigit() else None,
            "information": info,
        })
    return entries


# ドロー表の下に付く再掲ブロックの見出し。ここから下は本体ではない。
RECAP_HEADINGS = ("準々決勝", "準決勝", "決勝戦", "３位決定", "3位決定")


def recap_cutoff(page):
    """再掲ブロックの見出しのyを返す（無ければ無限大）。

    2018年度は奇数ページの下部に「準々決勝戦」の再掲があり、本体と同じ列に組まれている。
    番号まで振られているので、放っておくとエントリーとして拾われ重複する
    （ページあたり左右2件）。見出しより下を捨てる。
    """
    best = float("inf")
    for y, cs in make_lines(list(page.chars), tol=2.0):
        text = "".join(c["text"] for c in cs)
        if any(h in text for h in RECAP_HEADINGS):
            best = min(best, y)
    return best


def extract_page(page, page_no, warnings, vocab, overrides, used, fold_variants, teams):
    # 再掲ブロックは**文字の段階で**落とす。アンカー（氏名行・括弧行）だけ落としても、
    # 再掲の県・所属の行が生き残って直上のエントリーにくっつく
    # （2018年度 p1 で「日本学連東京東京」のような連結になった）。
    y_max = recap_cutoff(page)
    chars = [c for c in page.chars if center(c) < y_max]
    (open_l, close_l), (open_r, close_r) = detect_paren_columns(chars)
    left = [c for c in chars if c["x0"] <= close_l]
    right = [c for c in chars if c["x0"] > close_l]
    return (extract_block(left, open_l, close_l, 0.0, "left", warnings, page_no, vocab, overrides, used, fold_variants, teams)
            + extract_block(right, open_r, close_r, close_l, "right", warnings, page_no, vocab, overrides, used, fold_variants, teams))


def parse_pages(spec, total):
    if not spec:
        return list(range(1, total + 1))
    out = []
    for part in spec.split(","):
        if "-" in part:
            a, b = part.split("-")
            out.extend(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--pages", help="例: 1-4 / 6,7,8,9")
    ap.add_argument("--out")
    ap.add_argument("--reference", action="append", default=[],
                    help="姓名の境界を決めるための既知データ（隣接年度の initialPlayers.json）。"
                         "複数指定可。data/players/index.json は常に読む。")
    ap.add_argument("--fold-name-variants", action="store_true",
                    help="紙面の異体字を、既存データに同一人物が居る場合にその表記へ寄せる"
                         "（既定は候補を警告に出すだけ）。")
    ap.add_argument("--name-split", action="append", default=[], metavar="姓名=姓|名",
                    help="姓名の境界を人手で指定する（例: --name-split 'ミヒニャック瑠偉=ミヒニャック|瑠偉'）。"
                         "座標でも既知データでも決まらない行のための最後の手段。複数指定可。")
    args = ap.parse_args()

    overrides = {}
    for spec in args.name_split:
        full, _, split = spec.partition("=")
        ln, _, fn = split.partition("|")
        if not (full and ln and fn):
            raise SystemExit(f"--name-split の書式が不正です: {spec!r}（姓名=姓|名）")
        overrides[full] = (ln, fn)
    used = set()

    vocab = load_name_vocabulary(args.reference)
    teams = load_team_vocabulary()
    warnings, entries = [], []
    with pdfplumber.open(args.pdf) as pdf:
        for pno in parse_pages(args.pages, len(pdf.pages)):
            entries.extend(extract_page(pdf.pages[pno - 1], pno, warnings, vocab, overrides, used,
                                        args.fold_name_variants, teams))
    for full in overrides:
        # 使われなかった指定は、紙面が変わったか綴りが違う。黙って無視すると気づけない
        if full not in used:
            warnings.append(f"--name-split の指定が一度も一致しませんでした: {full}")

    entries.sort(key=lambda e: (e["number"] is None, e["number"]))
    result = []
    for e in entries:
        info = e["information"]
        result.append({
            "id": e["number"],
            "name": f"{info[0]['lastName']}・{info[1]['lastName']}（{info[0]['team']}）",
            "information": info,
            "category": "doubles",
        })

    # --- 検証レポート ---
    numbers = [e["id"] for e in result]
    seen = defaultdict(list)
    for e in result:
        seen[tuple(sorted(f"{p['lastName']}{p['firstName']}" for p in e["information"]))].append(e["id"])
    report = {
        "count": len(result),
        "id_range": [min(numbers), max(numbers)] if numbers else None,
        "duplicate_ids": [n for n, c in Counter(numbers).items() if c > 1],
        "missing_ids": [n for n in range(1, max(numbers) + 1) if n not in set(numbers)] if numbers else [],
        "empty_team": sorted({e["id"] for e in result for p in e["information"] if not p["team"]}),
        "empty_name": sorted({e["id"] for e in result for p in e["information"]
                              if not p["lastName"] or not p["firstName"]}),
        "duplicate_players": {"・".join(k): v for k, v in seen.items() if len(v) > 1},
        "warnings": warnings,
    }
    report["clean"] = not any(report[k] for k in
                              ("duplicate_ids", "missing_ids", "empty_team", "empty_name",
                               "duplicate_players", "warnings"))
    print(json.dumps(report, ensure_ascii=False, indent=2), file=sys.stderr)

    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"wrote {args.out} ({len(result)} entries)", file=sys.stderr)
    else:
        print(text)


if __name__ == "__main__":
    main()
