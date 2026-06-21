# -*- coding: utf-8 -*-
"""/news 記事の OGP 画像（summary_large_image / 1200x630）を生成する。

設計: docs/raw/2026-06-22-news-ogp-image-design.md
方針（確定 2026-06-22）:
  - 対象は data/news/<id>.json のうち state=="published" かつ type=="result" のみ。
  - 画像はローカル生成して public/og/news/ に PNG をコミットする（本番ビルドに依存を増やさない）。
  - ファイル名に内容ハッシュ（PNG bytes の sha256 先頭8桁）を付け、キャッシュを確実に無効化する。
  - 生成後、記事レコードに ogImage（"/og/news/<id>-<hash>.png"）を書き戻す。
  - 優勝者は details/<tid>/<year>/<category>.json の results(kind=="winner") から決定的に抽出。

使い方:
  python tools/sns-images/news_og.py            # 全 published result を生成
  python tools/sns-images/news_og.py --article <articleId>   # 1件だけ
  python tools/sns-images/news_og.py --all-states            # draft/review も含めて生成（プレビュー確認用）
"""
import argparse
import glob
import hashlib
import io
import json
import os

import snslib as S

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
NEWS_DIR = os.path.join(ROOT, "data", "news")
DETAILS_DIR = os.path.join(ROOT, "data", "tournaments", "details")
INDEX_JSON = os.path.join(ROOT, "data", "tournaments", "index.json")
OUT_DIR = os.path.join(ROOT, "public", "og", "news")

W, H = 1200, 630  # summary_large_image 標準（1.91:1）

_CATEGORY = {"singles": "シングルス", "doubles": "ダブルス", "team": "団体"}
_GENDER = {"boys": "男子", "girls": "女子", "mixed": "混合"}


def _read_json(path, fallback=None):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return fallback


def tournament_label(tid):
    idx = _read_json(INDEX_JSON, []) or []
    for t in idx:
        if t.get("tournamentId") == tid:
            return t.get("label") or tid
    return tid


def category_label(category_id):
    """`singles-none-boys` -> `男子シングルス`。分解不能ならそのまま返す。"""
    parts = category_id.split("-")
    if len(parts) < 3:
        return category_id
    gender = _GENDER.get(parts[-1], parts[-1])
    cat = _CATEGORY.get(parts[0], parts[0])
    return f"{gender}{cat}"


def champion_of(detail):
    """details カテゴリ JSON から優勝エントリの (名前, 所属) を返す。無ければ None。"""
    results = detail.get("results") or []
    entries = {e["entryNo"]: e for e in (detail.get("entries") or [])}
    pmap = S.participants_map(detail)
    for r in results:
        rank = (r.get("tournament") or {}).get("rank") or {}
        if rank.get("kind") == "winner":
            entry = entries.get(r.get("entryNo"))
            if entry:
                return S.entry_label(entry, pmap)
    return None


def collect_champions(record):
    """記事レコードから [(categoryLabel, name, sub)] を優勝確定分だけ返す。"""
    tid, year = record["tournamentId"], record["year"]
    year_dir = os.path.join(DETAILS_DIR, tid, str(year))
    cid = record.get("categoryId")
    if cid:
        files = [os.path.join(year_dir, f"{cid}.json")]
    else:
        files = sorted(glob.glob(os.path.join(year_dir, "*.json")))
    out = []
    for fp in files:
        detail = _read_json(fp)
        if not detail:
            continue
        cat_id = os.path.splitext(os.path.basename(fp))[0]
        champ = champion_of(detail)
        if champ:
            out.append((category_label(cat_id), champ[0], champ[1]))
    return out


def _vtext(draw, x, cy, s, f, fill, right=False):
    """縦中央 cy に文字列を描く。right=True で x を右端基準に。"""
    asc, desc = f.getmetrics()
    th = asc + desc
    tx = x - S.text_w(draw, s, f) if right else x
    draw.text((tx, cy - th / 2), s, font=f, fill=fill)


def render(record, champions):
    label = tournament_label(record["tournamentId"])
    year = record["year"]
    img, draw = S.new_canvas(W, H)

    # ヘッダー（大会名＋年＋結果）
    top = S.draw_header(draw, W, f"{label} {year}", subtitle="結果・優勝者", h=140)

    footer_h = 54
    margin_x = 44
    body_top = top + 24
    body_bottom = H - footer_h - 22

    if not champions:
        mf = S.font(48, bold=True)
        draw.text((margin_x, body_top + 20), "優勝者確定", font=mf, fill=S.NAVY)
        S.draw_footer(draw, W, H, note="softeni-pick.com")
        return img

    # 1行1種目（カテゴリ左／優勝者中央／所属右）。行高は件数で可変。
    n = len(champions)
    row_h = (body_bottom - body_top) / n
    name_size = int(min(46, max(24, row_h * 0.46)))
    label_size = int(min(28, max(17, row_h * 0.30)))
    sub_size = int(min(24, max(15, row_h * 0.26)))

    label_col = 230  # カテゴリ列の幅
    sub_col = 150  # 所属列の幅
    name_x = margin_x + label_col + 16
    name_max = W - margin_x - sub_col - 16 - name_x

    label_f = S.font(label_size, bold=False)
    sub_f = S.font(sub_size, bold=False)

    for i, (cat_label, name, sub) in enumerate(champions):
        cy = body_top + row_h * (i + 0.5)
        if i > 0:
            ly = int(body_top + row_h * i)
            draw.line([(margin_x, ly), (W - margin_x, ly)], fill=S.LINE, width=1)
        # カテゴリ（左・薄）
        lf = S.fit_font(draw, cat_label, label_col, label_size, min_size=14)
        _vtext(draw, margin_x, cy, cat_label, lf, S.GRAY)
        # 優勝者（中央列・濃・幅に収める）
        nf = S.fit_font(draw, name, name_max, name_size, bold=True, min_size=18)
        _vtext(draw, name_x, cy, name, nf, S.NAVY)
        # 所属（右寄せ・薄）
        if sub:
            sf = S.fit_font(draw, sub, sub_col, sub_size, min_size=12)
            _vtext(draw, W - margin_x, cy, sub, sf, S.GRAY, right=True)

    S.draw_footer(draw, W, H, note="softeni-pick.com")
    return img


def png_bytes(img):
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def write_image(article_id, data):
    os.makedirs(OUT_DIR, exist_ok=True)
    digest = hashlib.sha256(data).hexdigest()[:8]
    fname = f"{article_id}-{digest}.png"
    # 同一記事の古いファイルを掃除（ハッシュ差し替え）
    for old in glob.glob(os.path.join(OUT_DIR, f"{article_id}-*.png")):
        if os.path.basename(old) != fname:
            try:
                os.remove(old)
            except OSError as e:
                print(f"  warn: 旧ファイル削除に失敗（手動削除可）: {old} ({e})")
    out_path = os.path.join(OUT_DIR, fname)
    with open(out_path, "wb") as f:
        f.write(data)
    return f"/og/news/{fname}"


def update_record(record_path, record, og_path):
    record["ogImage"] = og_path
    with open(record_path, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
        f.write("\n")


def target_records(args):
    out = []
    for fp in sorted(glob.glob(os.path.join(NEWS_DIR, "*.json"))):
        rec = _read_json(fp)
        if not rec:
            continue
        if args.article and rec.get("articleId") != args.article:
            continue
        if rec.get("type") != "result":
            continue
        if not args.all_states and rec.get("state") != "published":
            continue
        out.append((fp, rec))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--article", help="対象 articleId（省略時は全件）")
    ap.add_argument(
        "--all-states",
        action="store_true",
        help="draft/review も含める（確認用）",
    )
    args = ap.parse_args()

    records = target_records(args)
    if not records:
        print("対象記事なし（published かつ result）")
        return

    for fp, rec in records:
        aid = rec["articleId"]
        champs = collect_champions(rec)
        img = render(rec, champs)
        og_path = write_image(aid, png_bytes(img))
        update_record(fp, rec, og_path)
        print(f"OK {aid}: {og_path}  (優勝 {len(champs)} 種目)")


if __name__ == "__main__":
    main()
