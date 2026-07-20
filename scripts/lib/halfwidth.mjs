// 全角ASCII（U+FF01–U+FF5E）→ 半角ASCII（U+0021–U+007E）と、全角スペース → 半角スペース。
//
// 目的: チーム表示名の `ＹＫＫ` `Ｊ－Ｋｉｄｓ` `ＮＩＫＫＯＳＴＣ` のような全角英数字を
// 読みやすい半角へ寄せる。全角英数はほぼ例外なく入力・OCR由来の揺れであり、
// 団体の正式表記が全角であるケースは実質ない。
//
// NFKC を使わない理由: NFKC は半角カナ→全角カナ、㈱→(株)、①→1 なども巻き込む。
// ここで直したいのは英数記号の幅だけなので、範囲を限定した変換にする。
// （NFKC は照合キー用途では引き続き使う。用途が違う点に注意）

/** 全角ASCIIを半角へ。日本語（かな・漢字・全角カタカナ）は一切変更しない。 */
export function toHalfWidthAscii(s) {
  if (s == null) return s;
  return String(s)
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ');
}
