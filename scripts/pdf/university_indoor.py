#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
全日本学生選抜インドア選手権大会（内閣総理大臣杯）の公式結果PDFを解析し、
data/tournaments/details/zennihon-university-indoor/<year>/<category>.json を生成する。

PDF構成（JSSTA 公式・第59回/2025 形式）:
  p1-p4 : 各ブロック成績（予選リーグ星取表）  男子A/B, 男子C/D, 女子A/B, 女子C/D
  p5-p6 : 「男子の部」「女子の部」エントリー一覧 + ブロック編成
  p7    : 試合順序 / 順位決定方法
  p8    : 男子・女子 決勝トーナメント + 入賞（優勝/準優勝/3位）

予選リーグはスコアまでPDFに記載されているため星取表から復元する。
決勝トーナメントのゲームスコアはPDFに記載が無いため、勝敗のみ
公式入賞（優勝/準優勝/3位）から確定し、scores は空にする（捏造しない）。

使い方:
  python scripts/pdf/university_indoor.py <input.pdf> --year 2025 \
      --out data/tournaments/details/zennihon-university-indoor

依存: pdfplumber
"""
import argparse
import json
import os
import re
import unicodedata
from typing import Dict, List, Optional, Tuple

import pdfplumber

# 旧字体・異体字・NFKCで吸収しきれないCJK部首を常用字体へ寄せる
# （PDF内表記ゆれ対策・氏名/団体名の照合用）
VARIANT_MAP = str.maketrans(
    {
        "黑": "黒",
        "髙": "高",
        "﨑": "崎",
        "學": "学",
        "戶": "戸",  # 神戶 → 神戸
        "⻄": "西",  # CJK部首・西
        "⻘": "青",  # CJK部首・青
        "⾕": "谷",
    }
)


def norm(text: str) -> str:
    """NFKC 正規化（康熙部首・全角→通常字）+ 異体字寄せ + 空白除去。"""
    if text is None:
        return ""
    t = unicodedata.normalize("NFKC", text)
    t = t.translate(VARIANT_MAP)
    t = re.sub(r"\s+", "", t)
    return t


def split_name(full: str) -> Tuple[str, str]:
    """氏名を姓2文字・名残りで分割（本大会の氏名は全て姓2文字）。"""
    full = full.strip()
    if len(full) <= 2:
        return full, ""
    return full[:2], full[2:]


# ----------------------------- 行抽出ユーティリティ -----------------------------

def rows_by_top(page, ytol: int = 3) -> List[Tuple[float, List[Tuple[float, str]]]]:
    """ページの単語を top 座標でグルーピングし、(top, [(x0, text)...]) の昇順リストを返す。"""
    words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
    buckets: Dict[int, List[Tuple[float, str]]] = {}
    for w in words:
        key = round(w["top"] / ytol) * ytol
        buckets.setdefault(key, []).append((w["x0"], w["text"]))
    out = []
    for k in sorted(buckets):
        cells = [t for _, t in sorted(buckets[k])]
        out.append((k, sorted(buckets[k])))
        _ = cells
    return out


def joined_lines(page, ytol: int = 3) -> List[str]:
    out = []
    for _, cells in rows_by_top(page, ytol):
        out.append(norm("".join(t for _, t in cells)))
    return out


# ----------------------------- エントリー一覧 -----------------------------
# 列の x しきい値（PDF実測）。番号 x81 / 選手1 x101-195 / 選手2 x208-303 / 大学 x315+
X_NUM = 95
X_P1 = 202  # 選手1(<202) と 選手2 の境界
X_P2 = 312  # 選手2 と 大学(>=312) の境界


def parse_entry_list(page) -> List[Dict]:
    """「○○の部」エントリー一覧（1..12）をパースして pairs を返す。
    最初の「Xブロック」見出しより前のみを対象にする（編成表との混在を防ぐ）。"""
    pairs = []
    for _, cells in rows_by_top(page):
        if not cells:
            continue
        line_text = norm("".join(t for _, t in cells))
        # ブロック編成セクションに入ったら終了
        if re.match(r"^[A-DＡ-Ｄ]ブロック$", line_text):
            break
        # 行頭が番号で始まる行のみ対象
        first_x, first_t = cells[0]
        if first_x >= X_NUM or not first_t.strip().isdigit():
            continue
        no = int(first_t.strip())
        if no < 1 or no > 12:
            continue
        p1_chars, p2_chars, team_chars = [], [], []
        for x, t in cells[1:]:
            if x < X_P1:
                p1_chars.append(t)
            elif x < X_P2:
                p2_chars.append(t)
            else:
                team_chars.append(t)
        p1 = norm("".join(p1_chars))
        p2 = norm("".join(p2_chars))
        team = norm("".join(team_chars))
        if not (p1 and p2 and team):
            continue
        pairs.append({"no": no, "p1": p1, "p2": p2, "team": team})
    pairs.sort(key=lambda r: r["no"])
    if len(pairs) != 12:
        raise ValueError(f"エントリー数が12ではありません: {len(pairs)} 件")
    return pairs


# ----------------------------- ブロック編成 -----------------------------

def parse_block_assignment(page) -> Dict[str, List[Dict]]:
    """ブロック編成（A..D 各3ペア）を {block: [pair...]} で返す。順序=星取表の行順。"""
    lines_cells = rows_by_top(page)
    blocks: Dict[str, List[Dict]] = {}
    current = None
    for _, cells in lines_cells:
        text = norm("".join(t for _, t in cells))
        m = re.match(r"^([A-DＡ-Ｄ])ブロック$", text)
        if m:
            current = norm(m.group(1))
            blocks[current] = []
            continue
        if current is None:
            continue
        if not cells:
            continue
        first_x, first_t = cells[0]
        if first_x >= X_NUM or not first_t.strip().isdigit():
            continue
        pos = int(first_t.strip())
        if pos < 1 or pos > 3:
            continue
        p1_chars, p2_chars, team_chars = [], [], []
        for x, t in cells[1:]:
            if x < X_P1:
                p1_chars.append(t)
            elif x < X_P2:
                p2_chars.append(t)
            else:
                team_chars.append(t)
        blocks[current].append(
            {
                "pos": pos,
                "p1": norm("".join(p1_chars)),
                "p2": norm("".join(p2_chars)),
                "team": norm("".join(team_chars)),
            }
        )
    for b, lst in blocks.items():
        lst.sort(key=lambda r: r["pos"])
        if len(lst) != 3:
            raise ValueError(f"ブロック{b}のペア数が3ではありません: {len(lst)}")
    return blocks


# ----------------------------- 星取表（予選リーグ） -----------------------------
# スコアセル列 x（実測）: col1≈166, col2≈223, col3≈282。/2 は x≈333、順位は x≈527。
SCORE_X_MIN = 140
SCORE_X_MAX = 315
COL_BOUNDS = [(140, 200), (200, 260), (260, 315)]  # col1,col2,col3


def circled_to_int(ch: str) -> Optional[int]:
    if "①" <= ch <= "⑳":
        return ord(ch) - 0x2460 + 1
    return None


def parse_block_standings(page) -> List[Dict]:
    """1ページ（2ブロック分）の星取表をパースし、ブロックごとの行情報を返す。
    返り値: [{label:'A', rows:[{pos, scores:{col:games}, wins:{col:bool}, rank}]}...]
    """
    chars = page.chars
    # ブロック見出しの top を取得して縦方向に2分割する
    text_rows = rows_by_top(page)
    block_headers = []
    for top, cells in text_rows:
        text = norm("".join(t for _, t in cells))
        m = re.match(r"^(男子|女子)([A-DＡ-Ｄ])ブロック成績$", text)
        if m:
            block_headers.append((top, norm(m.group(2))))
    block_headers.sort()
    if len(block_headers) != 2:
        raise ValueError(f"1ページに2ブロック見出しが見つかりません: {block_headers}")

    results = []
    for idx, (htop, label) in enumerate(block_headers):
        # 各ブロックの範囲は「自見出し top 〜 次見出し top」
        top_hi = block_headers[idx + 1][0] if idx + 1 < len(block_headers) else 10_000
        # この範囲の行番号(x<95, top>htop) を3つ拾う
        rows_info = []
        for top, cells in text_rows:
            if top <= htop or top >= top_hi:
                continue
            if not cells:
                continue
            fx, ft = cells[0]
            if fx < 80 and ft.strip() in {"1", "2", "3"}:
                rows_info.append((top, int(ft.strip())))
        rows_info.sort()
        rows_info = rows_info[:3]
        if len(rows_info) != 3:
            raise ValueError(f"ブロック{label}: 行番号が3つ取れません: {rows_info}")

        # 各行band内のスコアchar・順位charを座標で割当
        # 行は約40pt間隔。スコア・順位は行番号と同じ行（±数pt）にあるため
        # 固定幅の窓で隣接行や「失ゲーム」集計行の混入を防ぐ。
        rows = []
        for ri, (rtop, pos) in enumerate(rows_info):
            band_lo = rtop - 8
            band_hi = rtop + 22
            scores: Dict[int, int] = {}
            wins: Dict[int, bool] = {}
            rank = None
            for c in chars:
                ctop = c["top"]
                if ctop < band_lo or ctop >= band_hi:
                    continue
                x = c["x0"]
                ch = c["text"]
                ci = circled_to_int(ch)
                if SCORE_X_MIN <= x <= SCORE_X_MAX:
                    val = ci if ci is not None else (int(ch) if ch.isdigit() else None)
                    if val is None:
                        continue
                    for col, (lo, hi) in enumerate(COL_BOUNDS, start=1):
                        if lo <= x < hi:
                            scores[col] = val
                            wins[col] = ci is not None
                            break
                elif x >= 500:  # 順位列
                    if ch.isdigit():
                        rank = int(ch)
            rows.append({"pos": pos, "scores": scores, "wins": wins, "rank": rank})
        results.append({"label": label, "rows": rows})
    return results


# ----------------------------- 入賞（決勝トーナメント結果） -----------------------------

def parse_placings(page) -> Dict[str, List[Dict]]:
    """p8 の入賞行をパースし、男子/女子それぞれ [{place, p1sur, p2sur, team}] を返す。
    place: 'winner' | 'runnerup' | 'best4'
    """
    text = page.extract_text() or ""
    lines = [norm(l) for l in text.splitlines()]
    genders = {"男子": [], "女子": []}
    current = None
    for raw in lines:
        if "男子決勝トーナメント" in raw:
            current = "男子"
            continue
        if "女子決勝トーナメント" in raw:
            current = "女子"
            continue
        if current is None:
            continue
        m = re.match(r"^(優勝|準優勝|3位)[:：](.+)$", raw)
        if not m:
            continue
        label, body = m.group(1), m.group(2)
        place = {"優勝": "winner", "準優勝": "runnerup", "3位": "best4"}[label]
        # body 例: 片岡暁紀・黒坂卓矢(日本体育大学)
        mteam = re.search(r"[（(]([^（）()]+)[)）]", body)
        team = norm(mteam.group(1)) if mteam else ""
        names = re.sub(r"[（(].*?[)）]", "", body)
        parts = re.split(r"[・･]", names)
        p1 = parts[0] if len(parts) > 0 else ""
        p2 = parts[1] if len(parts) > 1 else ""
        genders[current].append(
            {"place": place, "p1": norm(p1), "p2": norm(p2), "team": team}
        )
    return genders


# ----------------------------- 組み立て -----------------------------

def player_id(surname: str, given: str, team: str) -> str:
    return f"{surname}_{given}_{team}"


def build_gender_detail(
    pairs: List[Dict],
    blocks: Dict[str, List[Dict]],
    standings: List[Dict],
    placings: List[Dict],
) -> Dict:
    # entryNo は「○○の部」一覧の番号
    # pair照合キー: 姓名連結 + team
    def key(p1, p2, team):
        return f"{p1}|{p2}|{team}"

    pair_by_key = {key(p["p1"], p["p2"], p["team"]): p for p in pairs}

    # participants / entries
    participants = []
    seen = set()
    entries = []
    for p in pairs:
        ids = []
        for full in (p["p1"], p["p2"]):
            sur, giv = split_name(full)
            pid = player_id(sur, giv, p["team"])
            ids.append(pid)
            if pid not in seen:
                seen.add(pid)
                participants.append(
                    {
                        "id": pid,
                        "lastName": sur,
                        "firstName": giv,
                        "team": p["team"],
                        "prefecture": None,
                    }
                )
        entries.append({"entryNo": p["no"], "playerIds": ids, "type": None})

    # block: position(1-3) -> entryNo, と entryNo -> (block, posrank埋め用)
    block_pos_entry: Dict[str, Dict[int, int]] = {}
    entry_block: Dict[int, str] = {}
    for b, lst in blocks.items():
        block_pos_entry[b] = {}
        for item in lst:
            k = key(item["p1"], item["p2"], item["team"])
            src = pair_by_key.get(k)
            if src is None:
                raise ValueError(f"ブロック{b}のペアが一覧に見つかりません: {k}")
            block_pos_entry[b][item["pos"]] = src["no"]
            entry_block[src["no"]] = b

    # standings: ブロックごとの行(pos)→rank/score
    stand_by_block = {s["label"]: s for s in standings}

    matches = []
    results_map: Dict[int, Dict] = {}
    mid = 0

    def next_mid():
        nonlocal mid
        mid += 1
        return f"match-{mid}"

    # 予選リーグ matches（各ブロック総当たり3試合）
    for b in sorted(block_pos_entry.keys()):
        pos_entry = block_pos_entry[b]
        srows = stand_by_block[b]["rows"]
        srow_by_pos = {r["pos"]: r for r in srows}
        # rank 記録
        for pos, e in pos_entry.items():
            rank = srow_by_pos[pos]["rank"]
            results_map.setdefault(e, {})["roundrobin"] = {"group": b, "rank": rank}
        # 3 試合: (1,2),(1,3),(2,3)。棄権等でスコアが無い対戦はスキップ。
        for a, c in [(1, 2), (1, 3), (2, 3)]:
            ea, ec = pos_entry[a], pos_entry[c]
            sa = srow_by_pos[a]["scores"].get(c)
            sc = srow_by_pos[c]["scores"].get(a)
            wa = srow_by_pos[a]["wins"].get(c, False)
            wc = srow_by_pos[c]["wins"].get(a, False)
            if sa is None or sc is None:
                # 対戦が成立していない（欠場・未実施）
                continue
            winner = ea if (wa or (not wc and sa > sc)) else ec
            matches.append(
                {
                    "entries": [ea, ec],
                    "scores": {str(ea): sa, str(ec): sc},
                    "round": None,
                    "stage": "roundrobin",
                    "group": b,
                    "winnerEntryNo": winner,
                    "nextMatchId": None,
                    "prevMatchIds": [],
                    "prevMatchId": None,
                    "matchId": next_mid(),
                }
            )

    # 入賞 → block letter 照合（代表 = 各ブロック rank1）
    rep_of_block: Dict[str, int] = {}
    for b in block_pos_entry:
        srows = stand_by_block[b]["rows"]
        rank1_pos = next(r["pos"] for r in srows if r["rank"] == 1)
        rep_of_block[b] = block_pos_entry[b][rank1_pos]

    entry_by_id = {e["entryNo"]: e for e in entries}
    pid_to_sur = {pp["id"]: pp["lastName"] for pp in participants}

    def placing_to_entry(pl: Dict) -> int:
        # rep の中から team 一致 & 姓一致で特定
        cands = []
        for b, e in rep_of_block.items():
            ent = entry_by_id[e]
            team = participants_team(e)
            surs = {pid_to_sur[pid] for pid in ent["playerIds"]}
            if team == pl["team"] and (pl["p1"][:2] in surs or pl["p2"][:2] in surs):
                cands.append(e)
        if len(cands) == 1:
            return cands[0]
        # フォールバック: team 一致のみ
        tcands = [e for b, e in rep_of_block.items() if participants_team(e) == pl["team"]]
        if len(tcands) == 1:
            return tcands[0]
        raise ValueError(f"入賞ペアの特定に失敗: {pl} 候補={cands or tcands}")

    def participants_team(entryNo: int) -> str:
        ent = entry_by_id[entryNo]
        pid = ent["playerIds"][0]
        return next(pp["team"] for pp in participants if pp["id"] == pid)

    place_entry: Dict[str, List[int]] = {}
    for pl in placings:
        e = placing_to_entry(pl)
        place_entry.setdefault(pl["place"], []).append(e)

    champion = place_entry["winner"][0]
    runnerup = place_entry["runnerup"][0]
    best4 = place_entry["best4"]  # 2件

    champ_block = entry_block[champion]
    runner_block = entry_block[runnerup]

    # 準決勝の組合せは固定: SF1 = A-D, SF2 = B-C
    sf_pairs = [("A", "D"), ("B", "C")]
    sf_match_ids = []
    sf_winners = []
    for (bx, by) in sf_pairs:
        ex, ey = rep_of_block[bx], rep_of_block[by]
        # 勝者: champion/ runnerup の所属ブロックなら決勝進出側
        if champ_block in (bx, by):
            winner = rep_of_block[champ_block]
        elif runner_block in (bx, by):
            winner = rep_of_block[runner_block]
        else:
            raise ValueError("準決勝勝者が特定できません")
        mid_sf = next_mid()
        sf_match_ids.append(mid_sf)
        sf_winners.append(winner)
        matches.append(
            {
                "entries": [ex, ey],
                "scores": {},
                "round": "準決勝",
                "winnerEntryNo": winner,
                "retired": False,
                "stage": "knockout",
                "group": None,
                "matchId": mid_sf,
                "nextMatchId": None,  # 後で決勝IDを設定
                "prevMatchIds": [],
                "prevMatchId": None,
            }
        )
    final_id = next_mid()
    for m in matches:
        if m["matchId"] in sf_match_ids:
            m["nextMatchId"] = final_id
    matches.append(
        {
            "entries": [sf_winners[0], sf_winners[1]],
            "scores": {},
            "round": "決勝",
            "winnerEntryNo": champion,
            "retired": False,
            "stage": "knockout",
            "group": None,
            "matchId": final_id,
            "nextMatchId": None,
            "prevMatchIds": list(sf_match_ids),
            "prevMatchId": None,
        }
    )

    # results: tournament rank
    rank_label = {
        "winner": ("優勝", {"kind": "winner"}),
        "runnerup": ("準優勝", {"kind": "runnerup"}),
        "best4": ("ベスト4", {"kind": "best", "bestLevel": 4}),
    }
    tour_of_entry: Dict[int, Dict] = {}
    tour_of_entry[champion] = rank_label["winner"]
    tour_of_entry[runnerup] = rank_label["runnerup"]
    for e in best4:
        tour_of_entry[e] = rank_label["best4"]

    results = []
    for e in sorted(results_map.keys()):
        rr = results_map[e].get("roundrobin")
        tour = None
        if e in tour_of_entry:
            label, rank = tour_of_entry[e]
            tour = {"label": label, "rank": rank}
        results.append({"entryNo": e, "tournament": tour, "roundrobin": rr})

    return {
        "participants": participants,
        "entries": entries,
        "matches": matches,
        "results": results,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--out", required=True, help="details/<tournamentId> ディレクトリ")
    args = ap.parse_args()

    pdf = pdfplumber.open(args.pdf)
    # ページ割当（第59回/2025形式）
    # p1 男子A/B, p2 男子C/D, p3 女子A/B, p4 女子C/D, p5 男子一覧+編成, p6 女子一覧+編成, p8 入賞
    std_boys = parse_block_standings(pdf.pages[0]) + parse_block_standings(pdf.pages[1])
    std_girls = parse_block_standings(pdf.pages[2]) + parse_block_standings(pdf.pages[3])
    pairs_boys = parse_entry_list(pdf.pages[4])
    pairs_girls = parse_entry_list(pdf.pages[5])
    blocks_boys = parse_block_assignment(pdf.pages[4])
    blocks_girls = parse_block_assignment(pdf.pages[5])
    placings = parse_placings(pdf.pages[7])

    boys = build_gender_detail(pairs_boys, blocks_boys, std_boys, placings["男子"])
    girls = build_gender_detail(pairs_girls, blocks_girls, std_girls, placings["女子"])

    out_dir = os.path.join(args.out, str(args.year))
    os.makedirs(out_dir, exist_ok=True)
    for cat, data in [("doubles-none-boys", boys), ("doubles-none-girls", girls)]:
        path = os.path.join(out_dir, f"{cat}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"wrote {path}  participants={len(data['participants'])} "
              f"matches={len(data['matches'])} results={len(data['results'])}")


if __name__ == "__main__":
    main()
