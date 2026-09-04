#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
全日本ミックスダブルス選手権の「予選リーグ（総当たり）」ページを
`data/tournaments/details/zennihon-mixed/<年>/<種目>.json` の形へ変換する。

対象の様式（第2回・2021 の一般で確認）:

  - 1ページに3〜5ブロック。ブロックは Excel 由来の素直な星取表
  - ヘッダ行 `<ブロック番号> 氏 名 所 属 <entryNo...> 勝率 差 順位`
  - 1エントリーにつき3行（上段の選手 / 星取セル＋集計 / 下段の選手）。
    エントリー番号はセル行のすぐ下、いちばん左の桁列に置かれる
  - 星取セルは 丸数字＝勝者の取得ゲーム数、裸の数字＝敗者の取得ゲーム数、`R`＝棄権

決勝トーナメント（別ページ）はここでは扱わない。stage は全て `roundrobin`。

依存: pdfplumber
"""
from __future__ import annotations

import argparse
import json
import re
import unicodedata
from pathlib import Path

import pdfplumber

# --- 列のx座標（ページ幅595ptの様式に対する固定値） ---
X_LABEL_MAX = 75.0        # ブロック番号 / エントリー番号が置かれる左端の桁列
X_NAME_MIN, X_NAME_MAX = 75.0, 120.0     # 姓・名
X_AREA_MIN, X_AREA_MAX = 120.0, 160.0    # 都道府県 / 日本学連
X_TEAM_MIN, X_TEAM_MAX = 165.0, 255.0    # 所属
X_CELL_MIN = 255.0                       # 星取セルの左端（右端はブロックごとに勝率列から決める）
# 勝率 / 差 / 順位 の x はブロックの人数で右へずれる（3人組と4人組で別位置）ため、
# 固定値ではなくヘッダ行の「勝率」「差」の座標から毎回求める。

CIRCLED = {"⓪": 0, "①": 1, "②": 2, "③": 3, "④": 4, "⑤": 5, "⑥": 6, "⑦": 7}

PREF_FU = {"東京": "東京都", "大阪": "大阪府", "京都": "京都府", "北海道": "北海道"}
NON_PREF = {"日本学連", "日本連盟"}


def norm_pref(area: str) -> str:
    if area in NON_PREF:
        return area
    if area in PREF_FU:
        return PREF_FU[area]
    return area if area.endswith(("県", "都", "府", "道")) else area + "県"


def to_halfwidth_digits(s: str) -> str:
    return unicodedata.normalize("NFKC", s)


def cx(w) -> float:
    return (w["x0"] + w["x1"]) / 2


def rows_of(page, y_tol=2.0):
    """語を y でまとめて行にする。行は (top, [語...]) で y 昇順。"""
    words = page.extract_words(x_tolerance=1.2, y_tolerance=1.5, keep_blank_chars=False)
    buckets: list[tuple[float, list]] = []
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        for i, (top, items) in enumerate(buckets):
            if abs(w["top"] - top) <= y_tol:
                items.append(w)
                break
        else:
            buckets.append((w["top"], [w]))
    return [(top, sorted(items, key=lambda w: w["x0"])) for top, items in buckets]


def pick(items, xmin, xmax):
    return [w for w in items if xmin <= cx(w) <= xmax]


def join(items):
    return " ".join(w["text"] for w in items)


class ParseError(RuntimeError):
    pass


def parse_page(page, page_no):
    """1ページ分のブロックを返す。

    ブロック = {"group": "1", "entries": [{"entryNo", "players", "cells", "winrate", "rank"}]}
    """
    rows = rows_of(page)

    # ヘッダ行 = 勝率 を含む行。ヘッダの「所 属」だけが別行に落ちることがあるので、
    # ヘッダの検出は 勝率 の有無だけで行う。
    header_idx = [i for i, (_, items) in enumerate(rows)
                  if any(w["text"] == "勝率" for w in items)]
    if not header_idx:
        raise ParseError(f"p{page_no}: ヘッダ行が見つからない")

    blocks = []
    for n, hi in enumerate(header_idx):
        top, items = rows[hi]
        label = pick(items, 0, X_LABEL_MAX)
        if len(label) != 1:
            raise ParseError(f"p{page_no}: ブロック番号が読めない top={top} {join(items)}")
        group = label[0]["text"]
        # 勝率 / 差 の位置はブロックの人数で右へずれるので、ヘッダから毎回読む
        wr_h = [w for w in items if w["text"] == "勝率"]
        df_h = [w for w in items if w["text"] == "差"]
        if len(wr_h) != 1 or len(df_h) != 1:
            raise ParseError(f"p{page_no}: ブロック{group} のヘッダに勝率/差がない")
        x_cell_max = wr_h[0]["x0"] - 5
        wr_range = (wr_h[0]["x0"] - 10, wr_h[0]["x1"] + 10)
        rank_range = (df_h[0]["x1"] + 12, 9999.0)

        col_words = pick(items, X_CELL_MIN, x_cell_max)
        if not all(w["text"].isdigit() for w in col_words):
            raise ParseError(f"p{page_no}: ブロック{group} の列見出しに数字以外: {join(col_words)}")
        col_entry_nos = [int(w["text"]) for w in col_words]
        col_centers = [cx(w) for w in col_words]
        if len(col_entry_nos) < 3:
            raise ParseError(f"p{page_no}: ブロック{group} の列見出しが {col_entry_nos}")

        end = header_idx[n + 1] if n + 1 < len(header_idx) else len(rows)
        body = rows[hi + 1:end]

        # セル行 = 勝率カラムに `n/m` がある行
        cell_rows = []
        for top_r, its in body:
            wr = pick(its, *wr_range)
            if wr and re.fullmatch(r"\d+/\d+", to_halfwidth_digits(join(wr))):
                cell_rows.append((top_r, its))
        # エントリー番号 = 左端桁列にある行（ヘッダ以外）
        no_rows = [(top_r, its) for top_r, its in body if pick(its, 0, X_LABEL_MAX)]
        # 選手行 = 姓名カラムを持つ行
        name_rows = [(top_r, its) for top_r, its in body if pick(its, X_NAME_MIN, X_NAME_MAX)]

        if len(cell_rows) != len(col_entry_nos):
            raise ParseError(f"p{page_no}: ブロック{group} セル行 {len(cell_rows)} != 列 {len(col_entry_nos)}")
        if len(no_rows) != len(col_entry_nos):
            raise ParseError(f"p{page_no}: ブロック{group} 番号行 {len(no_rows)} != 列 {len(col_entry_nos)}")
        if len(name_rows) != 2 * len(col_entry_nos):
            raise ParseError(f"p{page_no}: ブロック{group} 選手行 {len(name_rows)} != {2*len(col_entry_nos)}")

        entries = []
        for k, (top_r, its) in enumerate(cell_rows):
            no_items = pick(no_rows[k][1], 0, X_LABEL_MAX)
            if len(no_items) != 1:
                raise ParseError(f"p{page_no}: ブロック{group} の番号行が壊れている")
            entry_no = int(no_items[0]["text"])
            if entry_no != col_entry_nos[k]:
                raise ParseError(
                    f"p{page_no}: ブロック{group} 行の番号 {entry_no} と列見出し {col_entry_nos[k]} が不一致")

            players = []
            for _, nits in name_rows[2 * k:2 * k + 2]:
                nm = pick(nits, X_NAME_MIN, X_NAME_MAX)
                area = pick(nits, X_AREA_MIN, X_AREA_MAX)
                team = pick(nits, X_TEAM_MIN, X_TEAM_MAX)
                if len(nm) != 2 or len(area) != 1 or not team:
                    raise ParseError(
                        f"p{page_no}: ブロック{group} entry{entry_no} の選手行が読めない: "
                        f"{join(nits)}")
                players.append({
                    "lastName": nm[0]["text"],
                    "firstName": nm[1]["text"],
                    "prefecture": norm_pref(area[0]["text"]),
                    "team": join(team),
                })

            # 星取セルを列に割り当てる（中心座標の最近傍）
            cells = {}
            for w in pick(its, X_CELL_MIN, x_cell_max):
                j = min(range(len(col_centers)), key=lambda j: abs(col_centers[j] - cx(w)))
                if abs(col_centers[j] - cx(w)) > 12:
                    raise ParseError(f"p{page_no}: ブロック{group} entry{entry_no} セル位置が列から外れる")
                opp = col_entry_nos[j]
                if opp == entry_no:
                    raise ParseError(f"p{page_no}: ブロック{group} entry{entry_no} 対角セルに値がある")
                if opp in cells:
                    raise ParseError(f"p{page_no}: ブロック{group} entry{entry_no} 列{opp} が重複")
                cells[opp] = w["text"]

            wr = to_halfwidth_digits(join(pick(its, *wr_range)))
            rk = pick(its, *rank_range)
            if len(rk) != 1:
                raise ParseError(f"p{page_no}: ブロック{group} entry{entry_no} の順位が読めない")
            entries.append({
                "entryNo": entry_no,
                "players": players,
                "cells": cells,
                "winrate": wr,
                "rank": int(to_halfwidth_digits(rk[0]["text"])),
            })

        blocks.append({"group": group, "entries": entries})
    return blocks


def cell_value(text):
    """星取セルを (種別, ゲーム数) にする。種別は 'win' / 'loss' / 'retired'。"""
    t = to_halfwidth_digits(text)
    if t in CIRCLED:
        return "win", CIRCLED[t]
    if text in CIRCLED:
        return "win", CIRCLED[text]
    if t.upper() == "R":
        return "retired", None
    m = re.fullmatch(r"(\d+)R", t.upper())      # 「4R」＝4ゲーム時点で棄権
    if m:
        return "retired", int(m.group(1))
    if re.fullmatch(r"\d+", t):
        return "loss", int(t)
    raise ParseError(f"未知の星取セル: {text!r}")


def build(blocks, warnings):
    participants, seen = [], {}
    entries, results, matches = [], [], []

    for b in blocks:
        for e in b["entries"]:
            pids = []
            for p in e["players"]:
                pid = f"{p['lastName']}_{p['firstName']}_{p['team']}_{p['prefecture']}"
                if pid not in seen:
                    seen[pid] = True
                    participants.append({
                        "id": pid,
                        "lastName": p["lastName"],
                        "firstName": p["firstName"],
                        "team": p["team"],
                        "prefecture": p["prefecture"],
                    })
                pids.append(pid)
            entries.append({"entryNo": e["entryNo"], "playerIds": pids, "type": None})
            results.append({
                "entryNo": e["entryNo"],
                "tournament": None,
                "roundrobin": {"group": b["group"], "rank": e["rank"]},
            })

    for b in blocks:
        by_no = {e["entryNo"]: e for e in b["entries"]}
        nos = sorted(by_no)
        for i, a in enumerate(nos):
            for c in nos[i + 1:]:
                ca = by_no[a]["cells"].get(c)
                cc = by_no[c]["cells"].get(a)
                if ca is None and cc is None:
                    warnings.append(f"ブロック{b['group']}: {a} vs {c} のセルが両方空。試合を出力しない")
                    continue
                if ca is None or cc is None:
                    warnings.append(f"ブロック{b['group']}: {a} vs {c} のセルが片側だけ "
                                    f"({a}={ca!r}, {c}={cc!r})。試合を出力しない")
                    continue
                ka, va = cell_value(ca)
                kc, vc = cell_value(cc)
                if ka == "win" and kc == "win":
                    raise ParseError(f"ブロック{b['group']}: {a} vs {c} の両方が勝者表記")
                if ka != "win" and kc != "win":
                    warnings.append(f"ブロック{b['group']}: {a} vs {c} は勝者不明 "
                                    f"({a}={ca!r}, {c}={cc!r})。試合を出力しない")
                    continue
                if ka == "win":
                    winner, wscore, loser, lkind, lscore = a, va, c, kc, vc
                else:
                    winner, wscore, loser, lkind, lscore = c, vc, a, ka, va
                matches.append({
                    "entries": [a, c],
                    "scores": {str(winner): wscore, str(loser): lscore or 0},
                    "round": None,
                    "stage": "roundrobin",
                    "group": b["group"],
                    "winnerEntryNo": winner,
                    "retired": lkind == "retired",
                    "nextMatchId": None,
                    "prevMatchIds": [],
                    "prevMatchId": None,
                })

    matches.sort(key=lambda m: (int(m["group"]), m["entries"][0], m["entries"][1]))
    # キー順は既存の roundrobin ファイル（zennihon-university-indoor 2025 など）に合わせる。
    # `retired` は true のときだけ置く。
    ordered = []
    for i, m in enumerate(matches, 1):
        o = {"entries": m["entries"], "scores": m["scores"], "round": None,
             "stage": "roundrobin", "group": m["group"],
             "winnerEntryNo": m["winnerEntryNo"]}
        if m["retired"]:
            o["retired"] = True
        o.update({"nextMatchId": None, "prevMatchIds": [], "prevMatchId": None,
                  "matchId": f"match-{i}"})
        ordered.append(o)

    entries.sort(key=lambda e: e["entryNo"])
    results.sort(key=lambda r: r["entryNo"])
    return {"participants": participants, "entries": entries,
            "matches": ordered, "results": results}


def check(blocks, data, warnings):
    problems = []
    nos = [e["entryNo"] for e in data["entries"]]
    if nos != list(range(1, len(nos) + 1)):
        problems.append(f"エントリー番号が 1..{len(nos)} の連番でない")
    if len(set(nos)) != len(nos):
        problems.append("エントリー番号が重複している")

    # ブロック内の順位が 1..n
    for b in blocks:
        ranks = sorted(e["rank"] for e in b["entries"])
        n = len(b["entries"])
        if ranks[0] != 1 or ranks[-1] > n:
            problems.append(f"ブロック{b['group']}: 順位が {ranks}")

    # 勝率の分子 = 星取セルの丸数字の数（PDF側の誤記を検出する）
    for b in blocks:
        for e in b["entries"]:
            wins = sum(1 for v in e["cells"].values() if cell_value(v)[0] == "win")
            num, den = (int(x) for x in e["winrate"].split("/"))
            if wins != num:
                problems.append(f"ブロック{b['group']} entry{e['entryNo']}: "
                                f"勝率 {e['winrate']} だが丸数字は {wins} 個")
            if den != len(b["entries"]) - 1:
                warnings.append(f"ブロック{b['group']} entry{e['entryNo']}: "
                                f"勝率の分母 {den} がブロック人数-1({len(b['entries'])-1}) と違う")

    # 勝率の分子の合計 = そのブロックの試合数
    for b in blocks:
        n = len(b["entries"])
        want = n * (n - 1) // 2
        got = sum(1 for m in data["matches"] if m["group"] == b["group"])
        if got != want:
            warnings.append(f"ブロック{b['group']}: 試合 {got} 件（総当たりなら {want} 件）")

    # 順位と勝数の整合（同勝数は順位が前後しうるので、勝数の降順が順位の昇順と矛盾しないか）
    for b in blocks:
        pairs = []
        for e in b["entries"]:
            wins = sum(1 for v in e["cells"].values() if cell_value(v)[0] == "win")
            pairs.append((e["rank"], wins, e["entryNo"]))
        for r1, w1, n1 in pairs:
            for r2, w2, n2 in pairs:
                if r1 < r2 and w1 < w2:
                    problems.append(f"ブロック{b['group']}: entry{n1}(順位{r1},{w1}勝) が "
                                    f"entry{n2}(順位{r2},{w2}勝) より上位")

    # 各選手が2人1組
    for e in data["entries"]:
        if len(e["playerIds"]) != 2:
            problems.append(f"entry{e['entryNo']}: 選手が {len(e['playerIds'])} 人")
    return problems


def block_winners_from_knockout_page(page):
    """決勝トーナメントページの「Ｎブロック １位」欄から {ブロック番号: {(姓, 名), ...}} を読む。

    予選リーグ側とは完全に独立した経路なので、順位の読み取りの検算に使う。
    """
    rows = rows_of(page, y_tol=1.0)
    name_rows = []       # (top, (姓, 名))
    block_rows = []      # (top, ブロック番号)
    for top, items in rows:
        nm = pick(items, 138.0, 178.0)
        if len(nm) == 2:
            name_rows.append((top, (nm[0]["text"], nm[1]["text"])))
        blk = [w for w in items
               if w["text"].endswith("ブロック") and w["text"] != "ブロック"]
        if blk:
            block_rows.append((top, int(to_halfwidth_digits(blk[0]["text"][:-4]))))

    out = {}
    for top, no in block_rows:
        near = sorted(name_rows, key=lambda nr: abs(nr[0] - top))[:2]
        if len(near) != 2:
            raise ParseError(f"決勝T: {no}ブロックのペア名が読めない")
        out[str(no)] = {n for _, n in near}
    return out


def cross_check_with_knockout_page(blocks, winners):
    """各ブロックの1位が決勝トーナメントの出場ペアと一致するか。"""
    problems = []
    if set(winners) != {b["group"] for b in blocks}:
        problems.append(f"ブロックの集合が不一致: 予選={sorted(b['group'] for b in blocks)} "
                        f"決勝T={sorted(winners)}")
        return problems
    for b in blocks:
        top = [e for e in b["entries"] if e["rank"] == 1]
        if len(top) != 1:
            problems.append(f"ブロック{b['group']}: 1位が {len(top)} 組")
            continue
        got = {(p["lastName"], p["firstName"]) for p in top[0]["players"]}
        want = winners[b["group"]]
        if got != want:
            problems.append(f"ブロック{b['group']}: 1位 {sorted(got)} だが "
                            f"決勝Tの出場ペアは {sorted(want)}")
    return problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--pages", default="1-8")
    ap.add_argument("--out", required=True)
    ap.add_argument("--knockout-page", type=int, default=None,
                    help="決勝トーナメントのページ番号。渡すと各ブロック1位を突き合わせて検算する")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    a, _, b = args.pages.partition("-")
    page_nos = list(range(int(a), int(b or a) + 1))

    warnings: list[str] = []
    blocks = []
    cross: list[str] = []
    with pdfplumber.open(args.pdf) as pdf:
        for pn in page_nos:
            blocks.extend(parse_page(pdf.pages[pn - 1], pn))
        if args.knockout_page:
            winners = block_winners_from_knockout_page(pdf.pages[args.knockout_page - 1])
            cross = cross_check_with_knockout_page(blocks, winners)

    data = build(blocks, warnings)
    problems = check(blocks, data, warnings) + cross
    if args.knockout_page and not cross:
        print(f"  OK  : 全{len(blocks)}ブロックの1位が p{args.knockout_page} の決勝T出場ペアと一致")

    print(f"ブロック {len(blocks)} / エントリー {len(data['entries'])} / "
          f"選手 {len(data['participants'])} / 試合 {len(data['matches'])}")
    for w in warnings:
        print("  WARN:", w)
    for p in problems:
        print("  NG  :", p)
    assert not problems, "検査に失敗した"

    if args.dry_run:
        return
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("wrote", out)


if __name__ == "__main__":
    main()
