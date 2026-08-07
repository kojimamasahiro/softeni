// src/components/PlayerResults.tsx
// PlayerSummaryStats is intentionally not imported here anymore.

import Link from 'next/link';

import MajorTitles from '@/components/MajorTitles';
import PlayerLiteLink from '@/components/PlayerLiteLink';
import ResultsTable from '@/components/ResultsTable';
import type { MajorTitleData } from '@/lib/majorTitles';
import { MatchResult } from '@/types/common';
import { MatchRow, TournamentParticipant } from '@/types/tournament';

export type PlayerMatch = {
  tournamentId: string;
  category?: string;
  tournamentName: string;
  year?: number | string;
  round: string | null;
  entryNo: number;
  opponentNames: string[];
  opponents: TournamentParticipant[];
  score: string;
  result: 'win' | 'lose' | 'unknown';
  partnerId?: string | null;
  /**
   * 直近の他大会で同じ相手と対戦していた場合の説明（例:「近畿高等学校ソフトテニス選手権大会 2026 準々決勝の再戦（前回は勝利）」）。
   * 大会をまたいだ試合データを持っていて初めて出せる文脈。lib/priorMeetings.ts / docs/wiki/news-context-blocks.md ⑥
   */
  rematchOf?: string | null;
};

export type PlayerTournament = {
  id: string;
  tournamentName: string;
  tournamentId?: string; // short id
  year?: number | string;
  team?: string | null; // その大会当時の所属
  dateRange?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  location?: string | null;
  link?: string | null;
  partnerId?: string | null;
  // 結果ページを持たない（count<5）ペアの id。モーダル表示に使う（results リンクは張らない）
  partnerLiteId?: string | null;
  partnerName?: string | null;
  finalResult?: string | null;
  matches?: MatchResult[];
};

type PlayerResultsProps = {
  playerMatches: PlayerMatch[];
  playerTournaments: PlayerTournament[];
  // 主要タイトル（4大全日本大会×年度のマトリクス）。2026-08-07: 独立セクションから
  // ここ（大会結果の中）へ移設。「どの大会でどう勝ち上がったか」という大会結果と
  // 同じ関心事のため。詳しくは docs/raw/2026-08-07-idea-player-results-page-hierarchy.md。
  majorTitlesData?: MajorTitleData[];
};

export default function PlayerResults({ playerMatches, playerTournaments, majorTitlesData = [] }: PlayerResultsProps) {
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
  }

  for (const m of playerMatches) {
    const id = m.year ? (m.category ? `${m.tournamentId}/${m.year}/${m.category}` : `${m.tournamentId}/${m.year}`) : m.tournamentId || m.tournamentName || '';
    if (!tournamentsById[id]) tournamentsById[id] = [];
    tournamentsById[id].push({
      round: m.round ?? '',
      opponent: m.opponentNames.join('・') || '不明',
      score: m.score || '',
      result: m.result === 'win' ? '勝' : m.result === 'lose' ? '敗' : '',
      partner: undefined,
      rematchOf: m.rematchOf ?? null,
    });
  }

  // Re-group by year so we can render years in descending order and show a year label.
  const byYear: { [year: string]: string[] } = {};
  for (const key of Object.keys(tournamentsById)) {
    const info = tournamentInfoById[key];
    const year = info?.year ?? (key.includes('/') ? key.split('/')[1] : undefined) ?? '不明';
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
      if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    }
    // slashed
    const slash = s.match(/(\d{4}\/\d{1,2}\/\d{1,2})/);
    if (slash) {
      const ds = slash[1].replace(/\//g, '-');
      const d = new Date(ds);
      if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
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
      if (ta === tb) return (ib?.tournamentName || '').localeCompare(ia?.tournamentName || '');
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

      <MajorTitles majorTitlesData={majorTitlesData} />

      {sortedYears.map((year) => (
        <div key={year} className="mb-8">
          <h3 className="text-xl font-semibold text-text mb-3">{year === '不明' ? '年不明' : `${year}年`}</h3>
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
                  rematchOf: mr.rematchOf ?? null,
                  games: { won: parts[0] ?? '', lost: parts[1] ?? '' },
                  result: mr.result === '勝' ? 'win' : mr.result === '敗' ? 'lose' : 'draw',
                };
              });

              // If any rows look like round-robin / league matches, prioritize them.
              const rrPattern = /予選|リーグ|ラウンドロビン|round\s*-?robin|roundrobin|round-robin|\bRR\b|pool|グループ/i;
              const hasRR = rows.some((r) => typeof r.round === 'string' && rrPattern.test(r.round || ''));
              if (hasRR) {
                rows.sort((a, b) => {
                  const aIsRR = typeof a.round === 'string' && rrPattern.test(a.round || '') ? 0 : 1;
                  const bIsRR = typeof b.round === 'string' && rrPattern.test(b.round || '') ? 0 : 1;
                  if (aIsRR !== bIsRR) return aIsRR - bIsRR;
                  return 0;
                });
              }

              return (
                <div key={i} className="mb-6 border border-border rounded-xl p-4 shadow-sm bg-surface">
                  <h3 className="text-lg font-bold text-text mb-2">{tournamentName}</h3>
                  {(info?.startDate || info?.dateRange) && (
                    <div className="text-sm text-text-secondary mb-1">
                      日程{' '}
                      {info.startDate ? `${formatDate(info.startDate)}${info.endDate ? ' - ' + formatDate(info.endDate) : ''}` : formatDate(info.dateRange)}
                    </div>
                  )}
                  {info?.location && <div className="text-sm text-text-secondary mb-1">場所 {info.location}</div>}
                  {info?.link && (
                    <div className="text-sm text-text-secondary mb-1">
                      詳細{' '}
                      <Link href={info.link} className="underline text-primary">
                        大会ページ
                      </Link>
                    </div>
                  )}
                  {info?.partnerName && (
                    <div className="text-sm text-text-secondary mb-1">
                      ペア{' '}
                      {info?.partnerId ? (
                        <Link
                          href={`/players/${info.partnerId}/results`}
                          className="text-inherit underline underline-offset-2 decoration-dotted hover:decoration-solid"
                        >
                          {info.partnerName}
                        </Link>
                      ) : info?.partnerLiteId && info?.partnerName ? (
                        <PlayerLiteLink id={info.partnerLiteId} name={info.partnerName} />
                      ) : (
                        <>{info?.partnerName}</>
                      )}
                    </div>
                  )}
                  {info?.team && <div className="text-sm text-text-secondary mb-1">所属 {info.team}</div>}
                  {info?.finalResult && <div className="text-sm text-text-secondary mb-2 mt-1">最終結果：{info.finalResult}</div>}

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
