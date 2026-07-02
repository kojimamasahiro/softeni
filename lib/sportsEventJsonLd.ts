// lib/sportsEventJsonLd.ts
//
// SportsEvent 構造化データ（JSON-LD）の推奨項目を一元的に補うヘルパー。
//
// 背景: Google Search Console の「イベント」拡張レポートで、SportsEvent に
// eventStatus / image / endDate / location.address / organizer.url などの
// 推奨項目が無いとして警告が出ていた（必須項目 name / startDate / location は
// 充足しており、リッチリザルト自体はブロックされない警告）。
// データと矛盾しない範囲でこれらを補い、警告を減らす。
//
// 方針（docs/wiki/public-pages.md）:
// - eventStatus / eventAttendanceMode / image は常に付与（実態と矛盾しない既定値）。
// - endDate は無ければ startDate で補完（Google は endDate=startDate を許容）。
// - location には PostalAddress（最低限 addressCountry: 'JP'）を付与。
// - organizer には url を付与。
// - offers は付けない（無料の結果ページにチケット販売情報は不適切）。
//   付けないことによる offers の警告は残るが、虚偽の構造化データを避ける方を優先する。

import { siteConfig } from '@/lib/siteConfig';

/** どの SportsEvent にも付与する推奨項目の既定値。 */
export const sportsEventBaseFields = {
  eventStatus: 'https://schema.org/EventScheduled',
  eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  image: [siteConfig.ogImage],
} as const;

/** endDate を startDate で補完する（両方無ければ undefined）。 */
export function resolveEventDates(startDate?: string | null, endDate?: string | null): { startDate?: string; endDate?: string } {
  const start = startDate ?? undefined;
  const end = endDate ?? startDate ?? undefined;
  return {
    ...(start ? { startDate: start } : {}),
    ...(end ? { endDate: end } : {}),
  };
}

/**
 * 会場名（任意）から Place を作る。address を必ず含めて
 * 「location に address が無い」警告を解消する。
 * 詳細住所は持たないため addressCountry: 'JP' を最低限付与し、
 * addressRegion（都道府県など）が分かる場合のみ追加する。
 */
export function buildEventPlace(venueName?: string | null, addressRegion?: string | null) {
  return {
    '@type': 'Place',
    ...(venueName ? { name: venueName } : {}),
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'JP',
      ...(addressRegion ? { addressRegion } : {}),
    },
  };
}

/** url 付きの Organization を作る（既定は Softeni Pick）。 */
export function buildEventOrganizer(name: string = siteConfig.siteName, url: string = siteConfig.baseUrl) {
  return {
    '@type': 'Organization',
    name,
    url,
  };
}
