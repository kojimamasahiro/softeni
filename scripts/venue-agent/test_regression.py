"""
決定的チェック(checks.py)の回帰テスト。

SKILL.mdに載っている実例(全日本シニア2025年度、福山市/福知山市の誤記、
東舞鶴公園のTEL桁落ち)を使い、機械検証が確実にNGを検出できることを確認する。
ここはLLMを使わないので `python3 test_regression.py` だけで実行できる
(Ollamaが無くても動作確認できる)。
"""
import checks


def test_prefecture_mismatch_is_caught():
    # 出典の括弧書き「福山市」を鵜呑みにした誤った構造化(実際に起きた失敗例)
    wrong_entry = {
        "prefecture": "広島県",  # 「福山市」から誤って広島県と判断してしまったケース
        "city": "福山市",
        "name": "三段池科研電機テニスコート",
        "address": "京都府福知山市字猪崎377-1",
        "postalCode": "620-0017",
    }
    result = checks.check_prefecture_address(wrong_entry)
    assert not result.ok, "誤記を検出できていない"
    assert result.level == "error"
    print(f"OK (誤りを検出): {result.message}")


def test_prefecture_corrected_passes():
    # SKILL.md記載の正しい修正結果
    correct_entry = {
        "prefecture": "京都府",
        "city": "福知山市",
        "name": "三段池科研電機テニスコート",
        "aliases": ["福知山市三段池公園テニスコート"],
        "nameRaw": "三段池科研電機（福山市三段池公園）テニスコート",
        "address": "京都府福知山市字猪崎377-1",
        "postalCode": "620-0017",
        "note": "要項の括弧書き「福山市三段池公園」は誤記。住所・郵便番号は福知山市三段池公園のもの",
    }
    result = checks.check_prefecture_address(correct_entry)
    assert result.ok, f"正しいのに誤検出: {result.message}"
    print(f"OK (正しいと判定): {result.message}")


def test_tel_digit_loss_is_caught():
    # 東舞鶴公園の実例: 「0773-63-764」は9桁で桁落ち
    entry = {
        "prefecture": "京都府",
        "address": "京都府舞鶴市字余部下",
        "tel": "0773-63-764",
    }
    result = checks.check_tel_digits(entry)
    assert not result.ok, "桁落ちを検出できていない"
    assert result.level == "warn"
    print(f"OK (桁落ちを検出): {result.message}")

    # noteが無いのに桁落ちの値をそのまま埋めていたらerrorで止める
    guard_result = checks.check_no_guessed_broken_values(entry)
    assert not guard_result.ok, "note無しの桁落ち値をブロックできていない"
    print(f"OK (noteの有無をガード): {guard_result.message}")


def test_postal_code_digit_loss_is_caught():
    entry = {"prefecture": "京都府", "address": "京都府福知山市字猪崎377-1", "postalCode": "62017"}
    result = checks.check_postal_code(entry)
    assert not result.ok
    print(f"OK (郵便番号の桁不足を検出): {result.message}")


def test_new_surface_vocab_flagged():
    known = {"クレー", "ハード", "砂入り人工芝", "木床フローリング"}
    entry = {"surface": "オムニコート"}  # 語彙に無い新表記
    result = checks.check_surface_vocab(entry, known)
    assert not result.ok
    print(f"OK (未知の表記を検出): {result.message}")

    entry_ok = {"surface": "クレー"}
    result_ok = checks.check_surface_vocab(entry_ok, known)
    assert result_ok.ok
    print(f"OK (既知の表記は素通り): {result_ok.message}")


if __name__ == "__main__":
    tests = [v for k, v in list(globals().items()) if k.startswith("test_")]
    failed = 0
    for t in tests:
        try:
            t()
        except AssertionError as e:
            failed += 1
            print(f"NG {t.__name__}: {e}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    if failed:
        raise SystemExit(1)
