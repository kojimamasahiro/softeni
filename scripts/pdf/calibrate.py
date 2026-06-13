"""
calibrate.py — master.py のX座標調整を補助するキャリブレーションツール

master.py では選手情報を抽出するために X_LEFT_* / X_RIGHT_* など多数のX座標を
PDFごとに手動で調整する必要がある。本スクリプトはその調整を「目視＋試行錯誤」から
「自動検出された候補値の確認」に変えるための補助ツール。

やること:
  1. ページ内容から Y_CROP（上下端）を自動検出
  2. 中央の広い空白帯から左右分割位置を自動検出
  3. 左右それぞれで、文字の占有幅から列(カラム)を自動検出
  4. '(' ')' などのデリミタ位置も候補境界として検出（都道府県列の判定に有用）
  5. X軸ルーラーと検出境界を描いた注釈付きデバッグ画像を出力
  6. master.py にそのまま貼り付けられる定数ブロックを標準出力に表示

このツールは master.py を一切変更しない（非破壊）。出力された値を確認のうえ
master.py に転記して使う想定。

使い方:
  python3 calibrate.py tournament.pdf            # 1ページ目
  python3 calibrate.py tournament.pdf --page 2
  python3 calibrate.py tournament.pdf --gap 8    # 列分割のギャップ閾値を変更
"""

import argparse
import logging
import os

import numpy as np
import pandas as pd
import pdfplumber

# pdfplumber が PDF 内の不正なカラー指定で大量の警告を出すため抑制
logging.disable(logging.WARNING)

# --- 既定パラメータ（必要なら CLI で上書き）---
COLUMN_GAP = 6        # 列とみなす最小の空白幅(pt)。これ未満の隙間は同一列に併合
SPLIT_GAP = 15        # 左右分割とみなす中央空白帯の最小幅(pt)
Y_MARGIN = 6          # 自動検出した Y 範囲に付ける余白(pt)
RULER_STEP = 25       # デバッグ画像のX軸目盛り間隔(pt)


def load_chars(pdf_path, page_num):
    """指定ページの文字情報を DataFrame で返す（空白文字は除外）"""
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_num - 1]
        df = pd.DataFrame(page.chars)[["text", "x0", "top", "x1", "size"]]
        df = df.rename(columns={"x0": "left"})
        df = df[df["text"].str.strip() != ""].reset_index(drop=True)
        return df, page.width, page.height


def detect_y_crop(df, margin=Y_MARGIN):
    """文字の存在範囲から Y_CROP_MIN / MAX を推定する"""
    return max(0, int(df["top"].min() - margin)), int(df["top"].max() + margin)


def occupancy(df, width):
    """X方向の占有マスク(各pxに文字があるか)を返す"""
    occ = np.zeros(int(np.ceil(width)) + 2, dtype=bool)
    for left, x1 in zip(df["left"].values, df["x1"].values):
        occ[int(np.floor(left)):int(np.ceil(x1))] = True
    return occ


def find_empty_bands(occ, min_width):
    """占有マスク中の、min_width 以上の空白帯 (start, end) を返す"""
    bands, start = [], None
    for x in range(len(occ)):
        if not occ[x] and start is None:
            start = x
        elif occ[x] and start is not None:
            if x - start >= min_width:
                bands.append((start, x))
            start = None
    return bands


def detect_split(df, width):
    """中央付近の最も広い空白帯から左右分割X座標を返す。無ければ中央。"""
    occ = occupancy(df, width)
    center = width / 2
    # 中央の 1/3 領域にかかる空白帯のうち最も広いものを採用
    candidates = [
        (s, e) for (s, e) in find_empty_bands(occ, SPLIT_GAP)
        if s < center * 1.5 and e > center * 0.5
    ]
    if not candidates:
        return center
    s, e = max(candidates, key=lambda b: b[1] - b[0])
    return (s + e) / 2


def detect_columns(df, x_lo, x_hi, gap=COLUMN_GAP):
    """[x_lo, x_hi] 内の文字を占有幅でクラスタリングし列 (start, end) のリストを返す"""
    s = df[(df["left"] >= x_lo) & (df["x1"] <= x_hi)]
    if s.empty:
        return []
    occ = occupancy(s, x_hi + 2)
    runs, start = [], None
    for x in range(len(occ)):
        if occ[x] and start is None:
            start = x
        elif not occ[x] and start is not None:
            runs.append([start, x])
            start = None
    if start is not None:
        runs.append([start, len(occ)])
    # gap 未満の隙間で隣接列を併合
    merged = [runs[0]]
    for a, b in runs[1:]:
        if a - merged[-1][1] < gap:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    return [(a, b) for a, b in merged]


def column_text(df, x_lo, x_hi):
    """列に含まれる全文字を上から結合して返す"""
    s = df[(df["left"] >= x_lo - 1) & (df["x1"] <= x_hi + 1)].sort_values(["top", "left"])
    return "".join(s["text"].tolist())


def sample_text(df, x_lo, x_hi, n=40):
    """列の中身を確認するためのサンプルテキスト（上から数行ぶん）"""
    return column_text(df, x_lo, x_hi)[:n]


def digit_ratio(text):
    """テキスト中の数字の割合（空文字なら0）"""
    if not text:
        return 0.0
    return sum(c.isdigit() for c in text) / len(text)


def classify_entry_column(df, cols):
    """数字主体かつ細い列をエントリー番号列として返す（無ければ None）。
    スコア列(勝敗数)は数字主体だが横幅が広いので幅で除外する。"""
    best, best_ratio = None, 0.0
    for (a, b) in cols:
        if b - a > 30:           # 幅が広い列はエントリー番号ではない(スコア列など)
            continue
        r = digit_ratio(column_text(df, a, b))
        if r >= 0.8 and r > best_ratio:
            best, best_ratio = (a, b), r
    return best


def delimiter_positions(df, x_lo, x_hi, ch):
    """指定範囲内に出現する区切り文字 ch の代表X座標（左端）を返す"""
    s = df[(df["text"] == ch) & (df["left"] >= x_lo) & (df["x1"] <= x_hi)]
    if s.empty:
        return []
    # ほぼ同じ位置に集中するため四捨五入してユニーク化
    return sorted(set(s["left"].round(0).astype(int).tolist()))


def analyze_side(df, name, x_lo, x_hi, gap):
    """片側のカラムとデリミタを検出して結果を表示し、列情報を返す"""
    cols = detect_columns(df, x_lo, x_hi, gap)
    print(f"\n=== {name} 側 (x {x_lo:.0f}–{x_hi:.0f}) ===")
    print(f"  検出カラム数: {len(cols)}")
    for i, (a, b) in enumerate(cols):
        print(f"   [{i}] x {a:>4}–{b:<4} (幅{b - a:>3})  例: {sample_text(df, a, b)!r}")
    open_p = delimiter_positions(df, x_lo, x_hi, "(")
    close_p = delimiter_positions(df, x_lo, x_hi, ")")
    if open_p or close_p:
        print(f"  区切り '(' x={open_p}  ')' x={close_p}  ← 都道府県/カッコ列の境界候補")
    entry = classify_entry_column(df, cols)
    if entry:
        print(f"  エントリー番号列(数字主体): x {entry[0]}–{entry[1]}")
    return cols, open_p, close_p, entry


def emit_side(side, cols, paren_open, paren_close, entry):
    """片側の定数候補を出力する。エントリー列は位置(左/右)に依存せず数字列から特定し、
    エリアは '(' ')' 区切りから、本文(チーム/名前)はその残りから割り当てる。"""
    if not cols:
        return
    print(f"\n# --- {side} 側 (検出値・要確認) ---")

    if entry:
        print(f"X_{side}_ENTRY_MIN = {entry[0] - 2}")
        print(f"X_{side}_ENTRY_MAX = {entry[1] + 2}")

    # 本文列 = エントリー列を除いた最も幅の広いテキスト列
    text_cols = [c for c in cols if c != entry]
    if not text_cols:
        return
    body = max(text_cols, key=lambda c: c[1] - c[0])
    body_lo, body_hi = body

    if paren_open:
        # 本文は '(' の手前まで、エリアは '('〜')' 区間
        team_hi = paren_open[0] - 2
        area_lo = paren_open[0] - 2
        area_hi = (paren_close[-1] + 6) if paren_close else body_hi + 2
    else:
        team_hi = body_hi + 2
        area_lo = area_hi = None

    print(f"X_{side}_TEAM_MIN = {body_lo - 2}        # 名前列ならNAME/SURNAMEとして転記")
    print(f"X_{side}_TEAM_MAX = {team_hi}")
    if area_lo is not None:
        print(f"X_{side}_AREA_MIN = {area_lo}")
        print(f"X_{side}_AREA_MAX = {area_hi}")


def suggest_constants(left, right, y_min, y_max):
    """master.py に貼り付け可能な定数ブロックを生成する（あくまで初期候補）"""
    print("\n" + "=" * 70)
    print("master.py への貼り付け候補（要確認・要調整）")
    print("=" * 70)
    print(f"Y_CROP_MIN = {y_min}")
    print(f"Y_CROP_MAX = {y_max}")
    emit_side("LEFT", *left)
    emit_side("RIGHT", *right)
    print("\n※ 姓/名を別列に分ける必要がある場合は、本文領域内のカラムを")
    print("  デバッグ画像で確認して SURNAME/FIRSTNAME に手動で割り当ててください。")


def draw_debug_image(pdf_path, page_num, out_path, split_x, y_min, y_max,
                     left_cols, right_cols, left_paren, right_paren):
    """X軸ルーラーと検出境界を描いた注釈付きデバッグ画像を保存する"""
    from PIL import ImageDraw

    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_num - 1]
        im = page.to_image(resolution=150)
        base = im.original.convert("RGB")   # PILイメージに直接描画して保存する
        scale = base.size[0] / float(page.width)
        draw = ImageDraw.Draw(base)
        H = base.size[1]

        def vline(x, color, label=None, label_y=2, width=1):
            px = x * scale
            draw.line([(px, 0), (px, H)], fill=color, width=width)
            if label:
                draw.text((px + 1, label_y), label, fill=color)

        # X軸ルーラー(薄いグレー)＋目盛り値
        for x in range(0, int(page.width), RULER_STEP):
            vline(x, (170, 170, 170), str(x), label_y=H - 14)

        # 左右分割(マゼンタ)
        vline(split_x, (255, 0, 255), f"split {split_x:.0f}", label_y=16, width=2)

        # Y_CROP(黒の水平線)
        for y in (y_min, y_max):
            draw.line([(0, y * scale), (base.size[0], y * scale)],
                      fill=(0, 0, 0), width=2)

        # 検出カラム(青/赤の縦線、左=青系・右=赤系)
        for (a, b) in left_cols:
            vline(a, (0, 80, 255), f"{a}", width=2)
            vline(b, (0, 160, 255), width=2)
        for (a, b) in right_cols:
            vline(a, (220, 0, 0), f"{a}", width=2)
            vline(b, (255, 120, 0), width=2)

        # デリミタ(緑)
        for x in left_paren + right_paren:
            vline(x, (0, 170, 0), width=2)

        base.save(out_path)
    print(f"\n✅ 注釈付きデバッグ画像を保存: {out_path}")
    print("   グレー=X軸目盛り / マゼンタ=左右分割 / 青=左カラム / 赤=右カラム / 緑='(' ')' / 黒=Y_CROP")


def main():
    ap = argparse.ArgumentParser(description="master.py のX座標調整を補助するキャリブレーションツール")
    ap.add_argument("pdf", help="入力PDFファイル")
    ap.add_argument("--page", type=int, default=1, help="解析するページ番号(1始まり)")
    ap.add_argument("--gap", type=int, default=COLUMN_GAP, help=f"列分割のギャップ閾値pt(既定{COLUMN_GAP})")
    ap.add_argument("--out", default=None, help="デバッグ画像の出力先(既定 output/calibrate_pageN.png)")
    args = ap.parse_args()

    if not os.path.exists(args.pdf):
        raise SystemExit(f"エラー: ファイルが見つかりません: {args.pdf}")

    df, width, height = load_chars(args.pdf, args.page)
    if df.empty:
        raise SystemExit("エラー: 文字データが取得できませんでした。")

    y_min, y_max = detect_y_crop(df)
    split_x = detect_split(df, width)
    print(f"ページサイズ: {width:.0f} x {height:.0f}  / 文字数: {len(df)}")
    print(f"自動検出 Y_CROP: {y_min} – {y_max}")
    print(f"自動検出 左右分割X: {split_x:.0f}")

    left_df = df[df["left"] < split_x]
    right_df = df[df["left"] >= split_x]
    # analyze_side -> (cols, paren_open, paren_close, entry)
    left = analyze_side(left_df, "LEFT", left_df["left"].min(), split_x, args.gap)
    right = analyze_side(right_df, "RIGHT", split_x, right_df["x1"].max(), args.gap)

    suggest_constants(left, right, y_min, y_max)

    out = args.out or f"output/calibrate_page{args.page}.png"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    draw_debug_image(args.pdf, args.page, out, split_x, y_min, y_max,
                     left[0], right[0], left[1], right[1])


if __name__ == "__main__":
    main()
