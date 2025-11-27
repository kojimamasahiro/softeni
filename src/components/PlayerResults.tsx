// src/components/PlayerResults.tsx
// PlayerSummaryStats is intentionally not imported here anymore.

import Link from 'next/link';

import ResultsTable from '@/components/ResultsTable';
import { MatchResult } from '@/types/common';
import { MatchRow, TournamentParticipant } from '@/types/tournament';

export type PlayerMatch = {
  tournamentId: string;
  tournamentName: string;
  year?: number | string;
  round: string | null;
  entryNo: number;
  opponentNames: string[];
  opponents: TournamentParticipant[];
  score: string;
  result: 'win' | 'lose' | 'unknown';
  partnerId?: string | null;
};

export type PlayerTournament = {
  id: string;
  tournamentName: string;
  tournamentId?: string; // short id
  year?: number | string;
  dateRange?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  location?: string | null;
  link?: string | null;
  partnerId?: string | null;
  partnerName?: string | null;
  finalResult?: string | null;
  matches?: MatchResult[];
};

type PlayerResultsProps = {
  playerMatches: PlayerMatch[];
  playerTournaments: PlayerTournament[];
};

export default function PlayerResults({
  playerMatches,
  playerTournaments,
}: PlayerResultsProps) {
  if (!playerMatches || playerMatches.length === 0) {
    return <p>試合結果がありません。</p>;
  }

  // Build a map of tournament info and results keyed by tournament key
  // originalKey: `${tournamentId}/${year}` or t.id fallback
  const tournamentsById: { [id: string]: MatchResult[] } = {};
  const tournamentInfoById: { [id: string]: PlayerTournament } = {};

  for (const t of playerTournaments) {
    tournamentInfoById[t.id] = t;
    if (!tournamentsById[t.id]) tournamentsById[t.id] = [];
    if (t.tournamentId && (t.year || t.year === 0)) {
      const derived = `${t.tournamentId}/${t.year}`;
      if (!tournamentInfoById[derived]) tournamentInfoById[derived] = t;
      if (!tournamentsById[derived]) tournamentsById[derived] = [];
    }
  }

  for (const m of playerMatches) {
    const id = m.year
      ? `${m.tournamentId}/${m.year}`
      : m.tournamentId || m.tournamentName || '';
    if (!tournamentsById[id]) tournamentsById[id] = [];
    tournamentsById[id].push({
      round: m.round ?? '',
      opponent: m.opponentNames.join(', ') || '不明',
      score: m.score || '',
      result: m.result === 'win' ? '勝' : m.result === 'lose' ? '敗' : '',
      partner: undefined,
    });
  }

  // Re-group by year so we can render years in descending order and show a year label.
  const byYear: { [year: string]: string[] } = {};
  for (const key of Object.keys(tournamentsById)) {
    const info = tournamentInfoById[key];
    const year =
      info?.year ??
      (key.includes('/') ? key.split('/').pop() : undefined) ??
      '不明';
    const yearStr = String(year);
    if (!byYear[yearStr]) byYear[yearStr] = [];
    byYear[yearStr].push(key);
  }

  // Helpers: parse a date-like string to timestamp, and format date to Japanese form
  const parseStartTime = (s?: string | null): number => {
    if (!s) return 0;
    // Try ISO YYYY-MM-DD
    const iso = s.match(/(\d{4}-\d{2}-\d{2})/);
    if (iso) {
      const d = new Date(iso[1]);
      if (!Number.isNaN(d.getTime())) return d.getTime();
    }
    // Try slashed YYYY/MM/DD
    const slash = s.match(/(\d{4}\/\d{1,2}\/\d{1,2})/);
    if (slash) {
      const ds = slash[1].replace(/\//g, '-');
      const d = new Date(ds);
      if (!Number.isNaN(d.getTime())) return d.getTime();
    }
    // Japanese YYYY年M月D日
    const jp = s.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
    if (jp) {
      const d = new Date(Number(jp[1]), Number(jp[2]) - 1, Number(jp[3]));
      if (!Number.isNaN(d.getTime())) return d.getTime();
    }
    // Year-month
    const ym = s.match(/(\d{4})[-\/]?(\d{1,2})/);
    if (ym) {
      const d = new Date(Number(ym[1]), Number(ym[2]) - 1, 1);
      if (!Number.isNaN(d.getTime())) return d.getTime();
    }
    // Year only
    const yOnly = s.match(/(\d{4})/);
    if (yOnly) {
      const d = new Date(Number(yOnly[1]), 0, 1);
      if (!Number.isNaN(d.getTime())) return d.getTime();
    }
    return 0;
  };

  const formatDate = (s?: string | null): string => {
    if (!s) return '';
    // Prefer ISO
    const iso = s.match(/(\d{4}-\d{2}-\d{2})/);
    if (iso) {
      const d = new Date(iso[1]);
      if (!Number.isNaN(d.getTime()))
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    }
    // slashed
    const slash = s.match(/(\d{4}\/\d{1,2}\/\d{1,2})/);
    if (slash) {
      const ds = slash[1].replace(/\//g, '-');
      const d = new Date(ds);
      if (!Number.isNaN(d.getTime()))
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    }
    // Japanese already
    const jp = s.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
    if (jp) return `${jp[1]}年${Number(jp[2])}月${Number(jp[3])}日`;
    // Year-month
    const ym = s.match(/(\d{4})[-\/]?(\d{1,2})/);
    if (ym) return `${ym[1]}年${Number(ym[2])}月`;
    // Year only
    const yOnly = s.match(/(\d{4})/);
    if (yOnly) return `${yOnly[1]}年`;
    // fallback: return original
    return s;
  };

  // Sort tournaments within each year by startDate (descending: newest first)
  for (const y of Object.keys(byYear)) {
    byYear[y].sort((a, b) => {
      const ia = tournamentInfoById[a];
      const ib = tournamentInfoById[b];
      const ta = parseStartTime(ia?.startDate ?? ia?.dateRange ?? null);
      const tb = parseStartTime(ib?.startDate ?? ib?.dateRange ?? null);
      if (ta === tb)
        return (ib?.tournamentName || '').localeCompare(
          ia?.tournamentName || '',
        );
      return tb - ta;
    });
  }

  // Sort years descending (numeric when possible)
  const sortedYears = Object.keys(byYear).sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return nb - na; // numeric desc
    if (!Number.isNaN(na)) return -1; // numeric first
    if (!Number.isNaN(nb)) return 1;
    return b.localeCompare(a); // fallback lexicographic desc
  });

  return (
    <>
      <h2 className="text-xl font-bold mb-4">大会結果</h2>

      {sortedYears.map((year) => (
        <div key={year} className="mb-8">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">
            {year === '不明' ? '年不明' : `${year}年`}
          </h3>
          <div className="space-y-4">
            {byYear[year].map((tournamentKey, i) => {
              const info = tournamentInfoById[tournamentKey];
              const tournamentName = info?.tournamentName || tournamentKey;
              // build rows from aggregated MatchResult (already populated into tournamentsById)
              const matchResults = tournamentsById[tournamentKey] ?? [];
              const rows: MatchRow[] = matchResults.map((mr) => {
                const parts = String(mr.score || '').split('-');
                return {
                  matchId: undefined,
                  stage: null,
                  group: null,
                  round: mr.round ?? null,
                  opponentDisplayName: mr.opponent,
                  games: { won: parts[0] ?? '', lost: parts[1] ?? '' },
                  result:
                    mr.result === '勝'
                      ? 'win'
                      : mr.result === '敗'
                        ? 'lose'
                        : 'draw',
                };
              });

              // If any rows look like round-robin / league matches, prioritize them.
              const rrPattern =
                /予選|リーグ|ラウンドロビン|round\s*-?robin|roundrobin|round-robin|\bRR\b|pool|グループ/i;
              const hasRR = rows.some(
                (r) =>
                  typeof r.round === 'string' && rrPattern.test(r.round || ''),
              );
              if (hasRR) {
                rows.sort((a, b) => {
                  const aIsRR =
                    typeof a.round === 'string' && rrPattern.test(a.round || '')
                      ? 0
                      : 1;
                  const bIsRR =
                    typeof b.round === 'string' && rrPattern.test(b.round || '')
                      ? 0
                      : 1;
                  if (aIsRR !== bIsRR) return aIsRR - bIsRR;
                  return 0;
                });
              }

              return (
                <div
                  key={i}
                  className="mb-6 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm bg-white dark:bg-gray-800"
                >
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">
                    {tournamentName}
                  </h3>
                  {(info?.startDate || info?.dateRange) && (
                    <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                      日程{' '}
                      {info.startDate
                        ? `${formatDate(info.startDate)}${info.endDate ? ' - ' + formatDate(info.endDate) : ''}`
                        : formatDate(info.dateRange)}
                    </div>
                  )}
                  {info?.location && (
                    <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                      場所 {info.location}
                    </div>
                  )}
                  {info?.link && (
                    <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                      詳細{' '}
                      <a
                        href={info.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center underline text-blue-600 dark:text-blue-400"
                      >
                        大会ページ
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="ml-1 h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                    </div>
                  )}
                  {info?.partnerName && (
                    <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                      ペア{' '}
                      {info?.partnerId ? (
                        <Link
                          href={`/players/${info.partnerId}/results`}
                          className="text-inherit underline underline-offset-2 decoration-dotted hover:decoration-solid"
                        >
                          {info.partnerName}
                        </Link>
                      ) : (
                        <>{info.partnerName}</>
                      )}
                    </div>
                  )}
                  {info?.finalResult && (
                    <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                      最終結果：{info.finalResult}
                    </div>
                  )}

                  <ResultsTable rows={rows} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
