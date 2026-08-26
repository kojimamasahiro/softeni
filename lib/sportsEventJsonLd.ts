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

/**
 * `information` の `venues[]` から Place を作る。上の `buildEventPlace` と違い、
 * **実際の住所・郵便番号を持つ**（要項PDF由来。docs/wiki/data-model.md「大会の会場データ」）。
 *
 * `buildEventPlace` が addressCountry だけなのは「詳細住所を持たない」前提で書かれたためで、
 * `venues` が入っている大会ではその前提が崩れている。会場データがある場合はこちらを使う。
 * 会場が複数ある大会は先頭（主会場）を使う。Place を配列にすると Google が
 * location を解釈できないため。
 */
export function buildEventPlaceFromVenue(venue: {
  name?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  prefecture?: string | null;
}) {
  return {
    '@type': 'Place',
    ...(venue.name ? { name: venue.name } : {}),
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'JP',
      ...(venue.prefecture ? { addressRegion: venue.prefecture } : {}),
      ...(venue.city ? { addressLocality: venue.city } : {}),
      ...(venue.address ? { streetAddress: venue.address } : {}),
      ...(venue.postalCode ? { postalCode: venue.postalCode } : {}),
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
