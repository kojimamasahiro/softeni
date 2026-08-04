#!/usr/bin/env python3
"""
tournament-venue-data をローカルLLM(Ollama)で回すためのオーケストレーター。

役割分担 (SKILL.mdの思想をそのまま踏襲):
  抽出   -> スクリプト(決定的)
  判断   -> ローカルLLM(狭い1件ずつの問い合わせ。ツール呼び出しは使わない)
  検証   -> スクリプト(決定的、checks.py)
  公開判断 -> 人 (extract は draft を作るだけ。apply で人が確認してから本番JSONへ)

使い方:
  # 1. PDFから会場節を抜き出し、LLMに構造化させ、draftを作る
  python venue_agent.py extract 要項.pdf --tournament-id zennihon-senior --year 2026 \
      -o draft-zennihon-senior-2026.json

  # 2. draftを目で見て(必要ならdraft.json中のvenuesを直接編集して)から本番へ反映
  python venue_agent.py apply draft-zennihon-senior-2026.json \
      --tournament-id zennihon-senior --year 2026 \
      --data-dir /path/to/data/tournaments/information
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import checks
import prompts
from llm_client import DEFAULT_MODEL, OllamaError, chat_json

SECTION_HEADING_RE = re.compile(
    r"(?:^|\n)\s*[４4][.．、]?\s*会\s*場", re.MULTILINE
)
NEXT_HEADING_RE = re.compile(r"(?:^|\n)\s*[５5][.．、]?\s*", re.MULTILINE)


def extract_venue_section(pdf_path: Path) -> str:
    """PDFから「4. 会場」節らしきテキストを抜き出す(ベストエフォート)。

    見出しの表記ゆれが大きいため、必ず抽出結果を人に見せて確認を取ること
    (このスクリプトはコンソールに全文表示してから先に進む)。
    """
    import pdfplumber

    full_text = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            t = page.extract_text() or ""
            full_text.append(t)
    text = "\n".join(full_text)

    m = SECTION_HEADING_RE.search(text)
    if not m:
        print(
            "[警告] 「4. 会場」の見出しを自動検出できませんでした。"
            "全文を対象にします。--section-text で手貼りする方が確実です。",
            file=sys.stderr,
        )
        return text

    start = m.start()
    m2 = NEXT_HEADING_RE.search(text, m.end())
    end = m2.start() if m2 else len(text)
    return text[start:end].strip()


def confirm(prompt_text: str) -> bool:
    ans = input(f"{prompt_text} [y/N] ").strip().lower()
    return ans == "y"


def run_extract(args: argparse.Namespace) -> None:
    if args.section_text:
        section_text = Path(args.section_text).read_text(encoding="utf-8")
    else:
        section_text = extract_venue_section(Path(args.pdf))

    print("=" * 60)
    print("抽出した「会場」節のテキスト (これを元にLLMが判断します):")
    print("=" * 60)
    print(section_text)
    print("=" * 60)
    if not args.yes and not confirm("この範囲で進めますか?"):
        print("中断しました。--section-text で正しい範囲を手貼りしてやり直してください。")
        sys.exit(1)

    data_dir = Path(args.data_dir)
    known_vocab = checks.load_known_surface_vocab(data_dir) if data_dir.exists() else set()

    # Step 1: 分割検出
    try:
        split_info = chat_json(
            prompts.SPLIT_DETECTION_SYSTEM,
            prompts.build_split_detection_prompt(section_text),
            model=args.model,
        )
    except OllamaError as e:
        print(f"[エラー] {e}", file=sys.stderr)
        sys.exit(1)

    print(f"\n検出結果: {json.dumps(split_info, ensure_ascii=False, indent=2)}")
    facilities_raw = split_info.get("facilities_raw") or [section_text]
    if not args.yes and not confirm(
        f"{len(facilities_raw)}施設として進めますか? "
        f"(split_by={split_info.get('split_by')})"
    ):
        print("中断しました。--section-text を調整するか、draftを手動で分割してください。")
        sys.exit(1)

    # Step 2: 施設ごとに構造化 + 即検証
    entries = []
    for i, facility_text in enumerate(facilities_raw, 1):
        print(f"\n--- 施設 {i}/{len(facilities_raw)} を構造化中 ---")
        try:
            entry = chat_json(
                prompts.STRUCTURE_ENTRY_SYSTEM,
                prompts.build_structure_prompt(facility_text, sorted(known_vocab)),
                model=args.model,
            )
        except OllamaError as e:
            print(f"[エラー] LLM呼び出し失敗: {e}", file=sys.stderr)
            entry = {"_raw_text": facility_text, "_status": "llm_failed"}
            entries.append(entry)
            continue

        report = checks.run_all_checks(entry, known_vocab)
        entry["_status"] = "needs_review" if report.needs_review else "ok"
        entry["_check_results"] = [
            {"level": r.level, "message": r.message} for r in report.results if r.level != "ok"
        ]

        print(json.dumps(entry, ensure_ascii=False, indent=2))
        if report.blocking:
            print("!! ブロッキングな不整合があります。draft保存後に必ず内容を修正してください。")
        elif report.needs_review:
            print("!! 要確認項目があります。")
        entries.append(entry)

    out_path = Path(args.output)
    out_path.write_text(
        json.dumps(
            {
                "tournamentId": args.tournament_id,
                "year": args.year,
                "venues": entries,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    needs_review = sum(1 for e in entries if e.get("_status") != "ok")
    print(f"\ndraftを書き出しました: {out_path}")
    print(f"要確認: {needs_review}/{len(entries)}件。中身を見てから `apply` してください。")


def run_apply(args: argparse.Namespace) -> None:
    draft = json.loads(Path(args.draft).read_text(encoding="utf-8"))
    venues = draft.get("venues", [])

    unresolved = [v for v in venues if v.get("_status") == "needs_review"]
    if unresolved and not args.force:
        print(
            f"[中断] {len(unresolved)}件が要確認のままです。"
            f"draft内のvenuesを直接編集して_statusを消すか、--force で強制反映してください。",
            file=sys.stderr,
        )
        sys.exit(1)

    clean_venues = []
    for v in venues:
        v = dict(v)
        for k in ("_status", "_check_results", "_raw_text"):
            v.pop(k, None)
        clean_venues.append(v)

    data_dir = Path(args.data_dir)
    target = data_dir / f"{args.tournament_id}.json"
    if not target.exists():
        print(f"[エラー] {target} が見つかりません。", file=sys.stderr)
        sys.exit(1)

    records = json.loads(target.read_text(encoding="utf-8"))
    hit = None
    for rec in records:
        if rec.get("year") == args.year:
            hit = rec
            break
    if hit is None:
        print(f"[エラー] {args.tournament_id} に year={args.year} のレコードがありません。", file=sys.stderr)
        sys.exit(1)

    hit["venues"] = clean_venues
    if args.guideline_url:
        hit["guidelineUrl"] = args.guideline_url

    target.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")

    # 反映後、SKILL.mdの検算(進め方 手順4-5)を必ず全ファイルに通す
    problems = checks.validate_json_files(data_dir)
    if problems:
        print("[警告] JSON構文エラーがあります:")
        for p in problems:
            print(f"  {p}")
    prefecture_ng = []
    for f in data_dir.glob("*.json"):
        recs = json.loads(f.read_text(encoding="utf-8"))
        for rec in recs:
            for v in rec.get("venues") or []:
                r = checks.check_prefecture_address(v)
                if not r.ok:
                    prefecture_ng.append((f.name, rec.get("year"), v.get("name"), r.message))
    if prefecture_ng:
        print("[警告] prefecture/address不整合が残っています:")
        for f, y, n, msg in prefecture_ng:
            print(f"  {f} {y} {n}: {msg}")
    else:
        print("prefecture/address検算: 全件OK")

    print(f"\n{target} に書き込みました。")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    p_extract = sub.add_parser("extract", help="PDFから会場情報を抽出しdraftを作る")
    p_extract.add_argument("pdf", nargs="?", help="要項PDFのパス")
    p_extract.add_argument("--section-text", help="会場節を手貼りしたテキストファイル(PDF自動抽出が外れる場合用)")
    p_extract.add_argument("--tournament-id", required=True)
    p_extract.add_argument("--year", type=int, required=True)
    p_extract.add_argument("-o", "--output", required=True)
    p_extract.add_argument("--data-dir", default="data/tournaments/information")
    p_extract.add_argument("--model", default=DEFAULT_MODEL)
    p_extract.add_argument("-y", "--yes", action="store_true", help="確認プロンプトを省略")
    p_extract.set_defaults(func=run_extract)

    p_apply = sub.add_parser("apply", help="draftを本番のinformation/*.jsonへ反映する")
    p_apply.add_argument("draft")
    p_apply.add_argument("--tournament-id", required=True)
    p_apply.add_argument("--year", type=int, required=True)
    p_apply.add_argument("--data-dir", default="data/tournaments/information")
    p_apply.add_argument("--guideline-url")
    p_apply.add_argument("--force", action="store_true", help="要確認項目が残っていても強制反映")
    p_apply.set_defaults(func=run_apply)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
