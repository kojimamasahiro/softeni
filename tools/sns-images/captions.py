# -*- coding: utf-8 -*-
"""客観事実ベースのXキャプション生成。

バランス方針: 画像は主役カットのみ。サマリ・番狂わせ・結果ダイジェストは
本文（caption）＋スレッド返信（thread）のテキストとして出す。
"""
import os

import day1lib as L
import snslib as S

HASHTAGS = "#ハイスクールジャパンカップ #ソフトテニス #softtennis"

CAT_LABEL = {
    "doubles-none-boys": "男子ダブルス", "doubles-none-girls": "女子ダブルス",
    "singles-none-boys": "男子シングルス", "singles-none-girls": "女子シングルス",
}


def _cat(p):
    return os.path.splitext(os.path.basename(p))[0]


def _label(name, sub):
    return f"{name}（{L.strip_sub(sub)}）"


def _cta(next_date, venue, fallback):
    s = "2日目は" + (next_date or fallback)
    if venue:
        s += f" @{venue}"
    return s + "。"


# ---------- ダブルス ----------

def doubles_caption(data, details_path, next_date=None, venue=None):
    label = CAT_LABEL.get(_cat(details_path), "ダブルス")
    adv = L.advancers(data)
    pref, _ = L.by_pref_school(adv, data)
    top = "・".join(f"{k}{v}" for k, v in pref.most_common(3))
    return (
        f"【{label} 1日目終了】予選リーグが終了し、決勝トーナメント進出{len(adv)}ペアが決定。\n"
        f"進出ペア数（都道府県・上位）: {top}。\n"
        f"{_cta(next_date, venue, '決勝トーナメント')}\n{HASHTAGS}"
    )


def doubles_thread(data, details_path):
    adv = set(L.advancers(data))
    lines = []
    hl = L.proxy_highlights(data, details_path, adv)
    if hl:
        if hl["eliminated"]:
            lines.append(f"［前年ベスト8以上が予選敗退（{hl['year']}）］")
            lines += [f"・{_label(n, s)}" for n, s in hl["eliminated"]]
        if hl["survived"]:
            lines.append(f"［前年ベスト8以上が本選進出（{hl['year']}）］")
            lines += [f"・{_label(n, s)}" for n, s in hl["survived"]]
    _, school = L.by_pref_school(adv, data)
    multi = [(k, v) for k, v in school.most_common(5) if v >= 2]
    if multi:
        lines.append("［複数ペア進出の学校］")
        lines += [f"・{k} {v}ペア" for k, v in multi]
    return "\n".join(lines)


# ---------- シングルス ----------

def singles_caption(data, details_path, next_date=None, venue=None):
    label = CAT_LABEL.get(_cat(details_path), "シングルス")
    alive = L.survivors(data)
    pref, _ = L.by_pref_school(alive, data)
    top = "・".join(f"{k}{v}" for k, v in pref.most_common(3))
    n = len(alive)
    nm = "ベスト4" if n == 4 else f"ベスト{n}"
    return (
        f"【{label} 1日目終了】準々決勝まで終了し、{nm}が決定。\n"
        f"勝ち残り（都道府県）: {top}。\n"
        f"{_cta(next_date, venue, '準決勝〜決勝')}\n{HASHTAGS}"
    )


def singles_thread(data, details_path):
    pmap, emap = L.maps(data)
    alive = set(L.survivors(data))
    lines = []
    # 準々決勝の結果
    qf = [r for r in L.decided_results(data) if r[0] == "準々決勝"]
    if qf:
        lines.append("［準々決勝］")
        for _, wno, lno, score, ret in qf:
            wn, ws = S.entry_label(emap[wno], pmap)
            if lno is None:
                lines.append(f"・{_label(wn, ws)} 不戦勝")
                continue
            ln, ls = S.entry_label(emap[lno], pmap)
            sc = score + ("（棄権）" if ret else "")
            lines.append(f"・{_label(wn, ws)} {sc} {_label(ln, ls)}")
    hl = L.proxy_highlights(data, details_path, alive)
    if hl and (hl["eliminated"] or hl["survived"]):
        if hl["eliminated"]:
            lines.append(f"［前年ベスト8以上が敗退（{hl['year']}）］")
            lines += [f"・{_label(n, s)}" for n, s in hl["eliminated"]]
        if hl["survived"]:
            lines.append(f"［前年ベスト8以上が勝ち残り（{hl['year']}）］")
            lines += [f"・{_label(n, s)}" for n, s in hl["survived"]]
    return "\n".join(lines)


# ---------- シングルス完結報告 ----------

def result_caption(data, details_path, champ, runner, final_rows):
    label = CAT_LABEL.get(_cat(details_path), "シングルス")
    pmap, emap = L.maps(data)
    out = [f"【{label} 終了】優勝が決定。"]
    if champ is not None:
        cn, cs = S.entry_label(emap[champ], pmap)
        out.append(f"優勝: {_label(cn, cs)}")
    for _, wno, lno, score, ret in final_rows:
        if lno is None:
            continue
        wn, ws = S.entry_label(emap[wno], pmap)
        ln, ls = S.entry_label(emap[lno], pmap)
        out.append(f"決勝: {_label(wn, ws)} {score} {_label(ln, ls)}")
    out.append(HASHTAGS)
    return "\n".join(out)


def result_thread(data, top8_entries):
    pmap, emap = L.maps(data)
    pref, _ = L.by_pref_school(top8_entries, data)
    lines = ["［ベスト8の都道府県］"]
    lines += [f"・{k} {v}" for k, v in pref.most_common(12)]
    sf = [r for r in L.decided_results(data) if r[0] == "準決勝"]
    if sf:
        lines.append("［準決勝］")
        for _, wno, lno, score, ret in sf:
            if lno is None:
                continue
            wn, ws = S.entry_label(emap[wno], pmap)
            ln, ls = S.entry_label(emap[lno], pmap)
            lines.append(f"・{_label(wn, ws)} {score} {_label(ln, ls)}")
    return "\n".join(lines)
