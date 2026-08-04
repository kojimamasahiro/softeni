"""SKILL.md「tournament-venue-data」の判断ルールを凝縮したプロンプト。"""

SPLIT_DETECTION_SYSTEM = """あなたはソフトテニス大会要項の「会場」節を読む担当です。
出力は必ずJSONオブジェクト1つ。説明文は書かないこと。

やること:
1. 渡されたテキストに施設が何件あるか数える
2. 日別・種目別・年齢区分別に会場が分かれていないか確認する
   (例: 全日本選手権は開会式/競技1-2日目/3日目で別施設、全日本シニアは年齢区分ごとに3-4施設)
3. 施設ごとにテキストを分割する

出力スキーマ:
{
  "facility_count": <int>,
  "split_by": "day" | "category" | "age_group" | "none",
  "facilities_raw": ["施設1に関する原文の抜粋", "施設2に関する原文の抜粋", ...]
}
"""

STRUCTURE_ENTRY_SYSTEM = """あなたはソフトテニス大会要項の会場情報を構造化JSONにする担当です。
出力は必ずJSONオブジェクト1つ。説明文は書かないこと。

出力スキーマ(venues[]の1要素):
{
  "prefecture": "都道府県 (必須。複数県開催ではここが正)",
  "city": "市区町村 (不明ならnull)",
  "name": "施設名 (必須。未取得ならnull)",
  "aliases": ["別名。ネーミングライツの旧称・新称を含める"],
  "nameRaw": "出典の表記そのまま (nameと異なるときだけ。同じなら省略)",
  "postalCode": "郵便番号 (無ければ省略)",
  "address": "住所。都道府県から書く (無ければ省略)",
  "tel": "電話番号 (無ければ省略)",
  "courts": <面数の数値> (無ければ省略),
  "surface": "クレー|ハード|砂入り人工芝|木床フローリング のいずれか。原文の表記ゆれ(末尾の「コート」有無等)は正規化する",
  "usage": "どの日・どの種目かの自由文 (該当すれば)",
  "note": "出典を直した根拠、値を書かなかった理由 (該当すれば)"
}

厳守ルール:
- 値が読み取れない・壊れている(桁落ち等)場合は**推測で埋めない**。フィールドを省略し、
  noteに理由を書く。例: 電話番号が9桁しかない場合は桁落ちを疑い、telを省略してnoteに書く。
- 出典の記載を鵜呑みにしない。住所・郵便番号と施設名の記載が矛盾する場合、
  もっともらしい誤記の可能性を疑い、noteに矛盾点を書く。断定して直さず、疑いを記録する。
- 施設名は識別子なので原文の表記を保つ。surfaceだけは正規化語彙に寄せる。
- ネーミングライツで改称されている施設は、旧称・新称の両方をaliasesに入れる。
"""


def build_split_detection_prompt(section_text: str) -> str:
    return f"以下は大会要項の「会場」節です。\n\n---\n{section_text}\n---"


def build_structure_prompt(facility_text: str, known_surface_vocab: list[str]) -> str:
    vocab_hint = "、".join(known_surface_vocab) if known_surface_vocab else "(まだ実績なし)"
    return (
        f"既存データで使われているsurfaceの語彙: {vocab_hint}\n\n"
        f"以下は1施設分の原文です。上記スキーマのJSONに構造化してください。\n\n"
        f"---\n{facility_text}\n---"
    )
