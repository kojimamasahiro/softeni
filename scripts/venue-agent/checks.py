"""
決定的な検証ロジック（LLMを介さない）。

SKILL.md「tournament-venue-data」の検算手順をそのままコード化したもの。
判断はLLMに、検証は必ずここに通す。
"""
from __future__ import annotations

import glob
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

PREF_RE = re.compile(r"^(北海道|東京都|京都府|大阪府|.{2,3}県)")


@dataclass
class CheckResult:
    ok: bool
    level: str  # "ok" | "warn" | "error"
    message: str


@dataclass
class EntryReport:
    entry: dict
    results: list = field(default_factory=list)

    @property
    def needs_review(self) -> bool:
        return any(r.level in ("warn", "error") for r in self.results)

    @property
    def blocking(self) -> bool:
        return any(r.level == "error" for r in self.results)


def check_prefecture_address(entry: dict) -> CheckResult:
    """SKILL.mdの検算スクリプト本体: address先頭の都道府県とprefectureの一致。"""
    address = entry.get("address")
    prefecture = entry.get("prefecture")
    if not address:
        return CheckResult(True, "ok", "address未記載のためスキップ")
    if not prefecture:
        return CheckResult(False, "error", "prefectureが空だがaddressがある")
    if not address.startswith(prefecture):
        m = PREF_RE.match(address)
        found = m.group(1) if m else "(不明)"
        return CheckResult(
            False,
            "error",
            f"prefecture='{prefecture}' だが address は '{found}' から始まる "
            f"(address='{address}')。出典の誤記の可能性あり(福山市/福知山市の実例参照)。",
        )
    return CheckResult(True, "ok", "prefectureとaddressの都道府県が一致")


def check_postal_code(entry: dict) -> CheckResult:
    postal = entry.get("postalCode")
    if not postal:
        return CheckResult(True, "ok", "postalCode未記載のためスキップ")
    digits = re.sub(r"\D", "", postal)
    if len(digits) != 7:
        return CheckResult(
            False,
            "warn",
            f"postalCode='{postal}' の数字が{len(digits)}桁(通常7桁)。桁落ちの可能性。",
        )
    return CheckResult(True, "ok", "postalCodeは7桁")


def check_tel_digits(entry: dict) -> CheckResult:
    tel = entry.get("tel")
    if not tel:
        return CheckResult(True, "ok", "tel未記載のためスキップ")
    digits = re.sub(r"\D", "", tel)
    if not (10 <= len(digits) <= 11):
        return CheckResult(
            False,
            "warn",
            f"tel='{tel}' の数字が{len(digits)}桁(通常10桁前後)。"
            f"桁落ちの疑いがあれば推測で埋めずnoteに理由を書くこと(東舞鶴公園の実例参照)。",
        )
    return CheckResult(True, "ok", "telの桁数は妥当範囲")


def load_known_surface_vocab(data_dir: Path) -> set[str]:
    vocab: set[str] = set()
    for f in glob.glob(str(data_dir / "*.json")):
        try:
            records = json.load(open(f, encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        for rec in records:
            for v in rec.get("venues") or []:
                s = v.get("surface")
                if s:
                    vocab.add(s)
    return vocab


def check_surface_vocab(entry: dict, known_vocab: set[str]) -> CheckResult:
    surface = entry.get("surface")
    if not surface:
        return CheckResult(True, "ok", "surface未記載のためスキップ")
    if known_vocab and surface not in known_vocab:
        return CheckResult(
            False,
            "warn",
            f"surface='{surface}' は既存データに無い新しい表記。表記ゆれでないか確認。"
            f"既知の値: {sorted(known_vocab)}",
        )
    return CheckResult(True, "ok", "surfaceは既知の語彙")


def check_no_guessed_broken_values(entry: dict) -> CheckResult:
    """noteが無いのに疑わしい値(digits混じりの短すぎるtel等)が入っていないかの簡易チェック。
    本質的にはLLM側の自己申告(note)を信頼しすぎない、最後の砦。"""
    tel = entry.get("tel") or ""
    digits = re.sub(r"\D", "", tel)
    if tel and len(digits) < 10 and not entry.get("note"):
        return CheckResult(
            False,
            "error",
            f"tel='{tel}' が桁落ちして見えるのにnoteが無い。推測で埋めていないか確認。",
        )
    return CheckResult(True, "ok", "問題なし")


ALL_CHECKS = [
    check_prefecture_address,
    check_postal_code,
    check_tel_digits,
    check_no_guessed_broken_values,
]


def run_all_checks(entry: dict, known_surface_vocab: set[str] | None = None) -> EntryReport:
    report = EntryReport(entry=entry)
    for fn in ALL_CHECKS:
        report.results.append(fn(entry))
    if known_surface_vocab is not None:
        report.results.append(check_surface_vocab(entry, known_surface_vocab))
    return report


def validate_json_files(data_dir: Path) -> list[str]:
    """進め方 手順5: JSONが壊れていないかの全件チェック。"""
    problems = []
    for f in glob.glob(str(data_dir / "*.json")):
        try:
            json.load(open(f, encoding="utf-8"))
        except json.JSONDecodeError as e:
            problems.append(f"{f}: {e}")
    return problems
