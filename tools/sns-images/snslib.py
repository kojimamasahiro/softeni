# -*- coding: utf-8 -*-
"""SNS画像生成の共有モジュール（フォント・配色・共通描画）"""
import os
from PIL import Image, ImageDraw, ImageFont

# ---- ブランドカラー（Softeni Pick ロゴ準拠） ----
NAVY = (27, 42, 74)        # #1B2A4A
NAVY_LIGHT = (85, 114, 172)
YELLOW = (248, 181, 0)     # #F8B500
BG = (250, 250, 248)
WHITE = (255, 255, 255)
GRAY = (110, 116, 130)
LINE = (190, 196, 208)

# 濃淡スケール（薄→濃）
HEAT = [(242, 242, 240), (232, 236, 244), (195, 207, 230), (143, 166, 207), (85, 114, 172), (27, 42, 74)]

_FONT_CANDIDATES_BOLD = [
    "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "C:/Windows/Fonts/meiryob.ttc",
]
_FONT_CANDIDATES_REG = [
    "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "C:/Windows/Fonts/meiryo.ttc",
]

_font_cache = {}


def font(size, bold=False):
    key = (size, bold)
    if key in _font_cache:
        return _font_cache[key]
    candidates = (_FONT_CANDIDATES_BOLD if bold else _FONT_CANDIDATES_REG) + \
                 (_FONT_CANDIDATES_REG if bold else _FONT_CANDIDATES_BOLD)
    for path in candidates:
        if os.path.exists(path):
            f = ImageFont.truetype(path, size)
            _font_cache[key] = f
            return f
    raise RuntimeError("日本語フォントが見つかりません。snslib.py の _FONT_CANDIDATES_* にパスを追加してください。")


def text_w(draw, s, f):
    return draw.textlength(s, font=f)


def fit_font(draw, s, max_width, size, bold=False, min_size=12):
    """max_width に収まるフォントを返す（収まらなければ縮小）"""
    while size > min_size:
        f = font(size, bold)
        if text_w(draw, s, f) <= max_width:
            return f
        size -= 1
    return font(min_size, bold)


def draw_header(draw, w, title, subtitle="", h=120):
    draw.rectangle([0, 0, w, h], fill=NAVY)
    draw.rectangle([0, h, w, h + 6], fill=YELLOW)
    tf = fit_font(draw, title, w - 60, 40, bold=True)
    if subtitle:
        draw.text((30, 22), title, font=tf, fill=WHITE)
        sf = fit_font(draw, subtitle, w - 60, 24)
        draw.text((30, 76), subtitle, font=sf, fill=(200, 210, 230))
    else:
        draw.text((30, (h - 44) // 2), title, font=tf, fill=WHITE)
    return h + 6


def draw_footer(draw, w, h, note="softeni-pick.com"):
    fh = 54
    draw.rectangle([0, h - fh, w, h], fill=NAVY)
    f = font(22, bold=True)
    tw = text_w(draw, note, f)
    draw.text((w - tw - 30, h - fh + 14), note, font=f, fill=WHITE)
    draw.ellipse([24, h - fh + 18, 24 + 18, h - fh + 36], fill=YELLOW)


def new_canvas(w, h):
    img = Image.new("RGB", (w, h), BG)
    return img, ImageDraw.Draw(img)


# ---- データ補助 ----

def participants_map(data):
    return {p["id"]: p for p in data["participants"]}


def entry_label(entry, pmap):
    """entry -> (名前行, 所属行)。団体戦はチーム名を名前行に。"""
    pids = entry.get("playerIds") or []
    ps = [pmap[p] for p in pids if p in pmap]
    if not ps:
        return ("不明", "")
    if ps[0].get("lastName"):
        names = "・".join((p.get("lastName") or "") for p in ps)
        team = ps[0].get("team") or ""
        pref = ps[0].get("prefecture") or ""
        sub = f"{team}（{pref}）" if team and pref else (team or pref)
        return (names, sub)
    # 団体戦
    team = ps[0].get("team") or "不明"
    pref = ps[0].get("prefecture") or ""
    return (team, f"（{pref}）" if pref else "")
