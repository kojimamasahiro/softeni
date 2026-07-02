// lib/playerStats/legacyAnalysis.ts
// 既存 data/players/<slug>/analysis.json を「エンジン Facts を単一の真」として再生成する
// 互換プロジェクション（P6・二重ロジック解消）。外部 JSON 形は既存と互換維持（描画無改修）。
//
// 数値部（totalMatches/wins/losses/games/byPartner/byYear）は Facts から導く
// （retired を含む旧セマンティクスを保持し、既存値と byte 一致）。
// latestMatch は表示メタ（finalResult ラベル / 所在地 / リンク）が必要なため、
// 対象の最新大会のみ detail を読んで組み立てる（旧 generate-player-analysis.mjs と同一ロジック）。

import { calculateRate } from './aggregators/util';
import { SourceAdapter } from './sourceAdapter';
import type { PlayerFacts, PlayerMatchFact } from './types';

export interface LegacyAggregate {
  matches: { total: number; wins: number; losses: number; winRate: number };
  games: { total: number; won: number; lost: number; gameRate: number };
}

export interface LegacyAnalysis {
  totalMatches: number;
  wins: number;
  losses: number;
  totalWinRate: number;
  games: { total: number; won: number; lost: number; gameRate: number };
  byPartner: Record<string, LegacyAggregate>;
  byYear: Record<string, LegacyAggregate>;
  latestMatch?: {
    tournament: string;
    date: string;
    location: string;
    partner?: number;
    result: string;
    link: string;
  };
}

/** 旧 script と同じく partnerId が null の doubles は 'singles' に寄せる（?? 'singles'）。 */
function partnerKeyOf(m: PlayerMatchFact): string {
  return m.partner && m.partner.id != null ? String(m.partner.id) : 'singles';
}

function foldAll(matches: PlayerMatchFact[]): LegacyAggregate {
  let wins = 0;
  let losses = 0;
  let gWon = 0;
  let gLost = 0;
  for (const m of matches) {
    if (m.result === 'win') wins += 1;
    else if (m.result === 'lose') losses += 1;
    gWon += m.gamesWon;
    gLost += m.gamesLost;
  }
  const total = matches.length;
  return {
    matches: { total, wins, losses, winRate: calculateRate(wins, total) },
    games: {
      total: gWon + gLost,
      won: gWon,
      lost: gLost,
      gameRate: calculateRate(gWon, gWon + gLost),
    },
  };
}

// ---- latestMatch 用の日付ヘルパ（旧 script 移植） ----
function parseStartTime(value?: string | null): number {
  if (!value) return 0;
  const iso = String(value).match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) {
    const d = new Date(iso[1]);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }
  const yearOnly = String(value).match(/(19|20)\d{2}/);
  if (yearOnly) {
    const d = new Date(Number(yearOnly[0]), 0, 1);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }
  return 0;
}

function formatJapaneseDate(value?: string | null): string {
  if (!value) return '';
  const iso = String(value).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${Number(iso[1])}年${Number(iso[2])}月${Number(iso[3])}日`;
  return String(value);
}

function formatDateRange(startDate?: string | null, endDate?: string | null, fallbackYear?: number): string {
  if (startDate && endDate) {
    if (startDate === endDate) return formatJapaneseDate(startDate);
    return `${formatJapaneseDate(startDate)}〜${formatJapaneseDate(endDate)}`;
  }
  if (startDate) return formatJapaneseDate(startDate);
  if (fallbackYear) return `${fallbackYear}年`;
  return '';
}

/** 対象大会カテゴリの self entry の finalResult ラベルを求める（旧 script と同一規則）。 */
function resolveFinalResult(
  adapter: SourceAdapter,
  tournamentId: string,
  year: number,
  categoryId: string,
  lastName: string,
  firstName: string,
): string | null {
  const detail = adapter.readStandardDetail(tournamentId, year, categoryId);
  if (!detail) return null;
  const matchingIds = detail.participants.filter((p) => p.lastName === lastName && p.firstName === firstName).map((p) => p.id);
  if (matchingIds.length === 0) return null;
  const targetEntryNos = detail.entries.filter((e) => e.playerIds.some((id) => matchingIds.includes(id))).map((e) => e.entryNo);

  for (const r of detail.results) {
    const entryNoMatch = typeof r.entryNo === 'number' && targetEntryNos.includes(r.entryNo);
    const pidMatch = Array.isArray(r.playerIds) && r.playerIds.some((id) => matchingIds.includes(id));
    if (!entryNoMatch && !pidMatch) continue;

    if (r.tournament && typeof r.tournament === 'object') {
      const label = (r.tournament as { label?: string }).label;
      if (typeof label === 'string' && label.trim().length > 0) return label;
    } else if (r.roundrobin && typeof r.roundrobin.rank === 'number') {
      return `予選${r.roundrobin.rank}位`;
    }
    return '不明';
  }
  return null;
}

/**
 * Facts から analysis.json 互換オブジェクトを組み立てる。
 * lastName/firstName は latestMatch の finalResult 解決に使う。
 */
export function buildLegacyAnalysis(facts: PlayerFacts, adapter: SourceAdapter, lastName: string, firstName: string): LegacyAnalysis {
  const overall = foldAll(facts.matches);

  const byPartnerMatches = new Map<string, PlayerMatchFact[]>();
  const byYearMatches = new Map<string, PlayerMatchFact[]>();
  for (const m of facts.matches) {
    const pk = partnerKeyOf(m);
    (byPartnerMatches.get(pk) ?? byPartnerMatches.set(pk, []).get(pk)!).push(m);
    const yk = String(m.year);
    (byYearMatches.get(yk) ?? byYearMatches.set(yk, []).get(yk)!).push(m);
  }

  const byPartner: Record<string, LegacyAggregate> = {};
  for (const [k, arr] of byPartnerMatches) byPartner[k] = foldAll(arr);
  const byYear: Record<string, LegacyAggregate> = {};
  for (const [k, arr] of byYearMatches) byYear[k] = foldAll(arr);

  const analysis: LegacyAnalysis = {
    totalMatches: overall.matches.total,
    wins: overall.matches.wins,
    losses: overall.matches.losses,
    totalWinRate: overall.matches.winRate,
    games: overall.games,
    byPartner,
    byYear,
  };

  // ---- latestMatch ----
  interface TInfo {
    tid: string;
    year: number;
    categoryId: string;
    name: string;
    startDate: string | null;
    endDate: string | null;
    location: string | null;
    link: string | null;
    partnerCounts: Map<number, number>;
  }
  const tmap = new Map<string, TInfo>();
  for (const m of facts.matches) {
    const key = `${m.tournamentId}/${m.year}/${m.categoryId}`;
    let info = tmap.get(key);
    if (!info) {
      const yearInfo = adapter.getInfoForYear(m.tournamentId, m.year);
      info = {
        tid: m.tournamentId,
        year: m.year,
        categoryId: m.categoryId,
        name: m.tournamentName,
        startDate: yearInfo?.startDate ?? null,
        endDate: yearInfo?.endDate ?? null,
        location: yearInfo?.location ?? null,
        link: yearInfo?.sourceUrl ?? null,
        partnerCounts: new Map(),
      };
      tmap.set(key, info);
    }
    if (m.partner && m.partner.id != null) {
      info.partnerCounts.set(m.partner.id, (info.partnerCounts.get(m.partner.id) ?? 0) + 1);
    }
  }

  const sorted = Array.from(tmap.values()).sort((l, r) => {
    const lt = parseStartTime(l.startDate) || parseStartTime(String(l.year));
    const rt = parseStartTime(r.startDate) || parseStartTime(String(r.year));
    if (lt !== rt) return rt - lt;
    return String(r.name || '').localeCompare(String(l.name || ''), 'ja');
  });

  const latest = sorted[0];
  if (latest) {
    let partnerId: number | undefined;
    let maxCount = 0;
    for (const [pid, count] of latest.partnerCounts) {
      if (count > maxCount) {
        maxCount = count;
        partnerId = pid;
      }
    }
    const finalResult = resolveFinalResult(adapter, latest.tid, latest.year, latest.categoryId, lastName, firstName);
    analysis.latestMatch = {
      tournament: latest.name ?? '',
      date: formatDateRange(latest.startDate, latest.endDate, latest.year),
      location: latest.location ?? '',
      partner: partnerId,
      result: finalResult ?? '',
      link: latest.link ?? '',
    };
  }

  return analysis;
}
