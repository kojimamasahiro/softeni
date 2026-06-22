// 選手名（姓・名）の結合ユーティリティ。
// 日本語名は姓名を詰めて表示（例: 内本貴文）、ローマ字（英語表記）の
// 国際選手は姓名の間に半角スペースを入れる（例: UCHIMOTO TAKAFUMI）。

// ひらがな・カタカナ・CJK統合漢字・CJK拡張A・互換漢字・半角カナを日本語文字とみなす
const JAPANESE_CHAR_RE = /[぀-ヿ㐀-鿿豈-﫿ｦ-ﾟ]/;

/**
 * 姓と名を結合した表示用フルネームを返す。
 * - 日本語名: スペースなしで結合（内本貴文）
 * - ローマ字名: 半角スペースで結合（UCHIMOTO TAKAFUMI）
 */
export function joinPlayerName(
  lastName?: string | null,
  firstName?: string | null,
): string {
  const last = (lastName ?? '').trim();
  const first = (firstName ?? '').trim();
  if (!last) return first;
  if (!first) return last;

  const isJapanese =
    JAPANESE_CHAR_RE.test(last) || JAPANESE_CHAR_RE.test(first);
  return isJapanese ? `${last}${first}` : `${last} ${first}`;
}
