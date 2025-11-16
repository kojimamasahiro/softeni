import fs from 'fs';
import path from 'path';

import {
    TournamentDetailData,
    TournamentEntry,
    TournamentIndexEntry,
    TournamentParticipant,
    TournamentResult,
} from '@/types/tournament';

interface MajorTitleYear {
  year: number;
  result: string;
}

export interface MajorTitleData {
  name: string;
  years: MajorTitleYear[];
}

// format startDate strings like "2024-11-08" -> "11/8"
const formatStartDate = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  // YYYY-MM-DD
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (ymd) {
    const month = String(Number(ymd[2]));
    const day = String(Number(ymd[3]));
    return `${month}/${day}`;
  }
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return `（${d.getMonth() + 1}/${d.getDate()}）`;
  }
  return undefined;
};

/**
 * Build minimal major titles data for a player (by name).
 * Sources:
 * - data/tournament/index.json
 * - data/tournament/details/<tournamentId>/<year>/*.json
 * - data/tournament/information/<tournamentId>.json
 */
export const getMajorTitlesForPlayer = (
  lastName: string,
  firstName: string,
): MajorTitleData[] => {
  const root = process.cwd();
  const indexPath = path.join(root, 'data', 'tournament', 'index.json');
  if (!fs.existsSync(indexPath)) return [];

  const indexRaw = fs.readFileSync(indexPath, 'utf-8');
  const index = JSON.parse(indexRaw) as TournamentIndexEntry[];

  const majors = index.filter((t) => t.isMajorTitle);
  const detailsRoot = path.join(root, 'data', 'tournament', 'details');
  const now = new Date();
  const out: MajorTitleData[] = [];

  for (const m of majors) {
    const tournamentId = m.tournamentId;
    const name = m.label || tournamentId;
    const tournamentDir = path.join(detailsRoot, tournamentId);
    const yearsResults: MajorTitleYear[] = [];

    if (fs.existsSync(tournamentDir)) {
      const yearDirs = fs
        .readdirSync(tournamentDir)
        .filter((n) => fs.statSync(path.join(tournamentDir, n)).isDirectory());

      for (const year of yearDirs) {
        if (!/^\d{4}$/.test(year)) continue;
        const yearDir = path.join(tournamentDir, year);
        const files = fs
          .readdirSync(yearDir)
          .filter((f) => f.endsWith('.json'));
        let resultStr: string | null = null;

        for (const f of files) {
          try {
            const raw = fs.readFileSync(path.join(yearDir, f), 'utf-8');
            const parsed = JSON.parse(raw) as unknown;
            const detail =
              (parsed as TournamentDetailData) || ({} as TournamentDetailData);

            const participants: TournamentParticipant[] = Array.isArray(
              detail.participants,
            )
              ? (detail.participants as TournamentParticipant[])
              : [];

            const matchingParticipantIds: string[] = participants
              .filter(
                (p: TournamentParticipant) =>
                  p.lastName === lastName && p.firstName === firstName,
              )
              .map((p: TournamentParticipant) => p.id);

            if (matchingParticipantIds.length === 0) continue;

            // results might be in different shapes; treat as unknown and guard
            const maybeResults = Array.isArray(detail.results)
              ? detail.results
              : undefined;
            if (Array.isArray(maybeResults)) {
              for (const r of maybeResults) {
                if (r && typeof r === 'object') {
                  const rec = r as unknown as Record<string, unknown>;
                  const playerIdsField = rec.playerIds;
                  const resultField = rec.result;
                  if (Array.isArray(playerIdsField)) {
                    for (const pidRaw of playerIdsField) {
                      const pid = String(pidRaw);
                      if (
                        matchingParticipantIds.includes(pid) &&
                        typeof resultField === 'string'
                      ) {
                        resultStr = resultField;
                        break;
                      }
                    }
                  }
                }
                if (resultStr) break;
              }
            }

            const maybeEntries = Array.isArray(detail.entries)
              ? detail.entries
              : undefined;
            if (
              !resultStr &&
              Array.isArray(maybeResults) &&
              Array.isArray(maybeEntries)
            ) {
              const entriesArr = maybeEntries as TournamentEntry[];
              for (const r of maybeResults) {
                if (r && typeof r === 'object') {
                  const rec = r as unknown as TournamentResult;
                  const entryNo = rec.entryNo;
                  const tournamentField = rec.tournament;

                  const entry = entriesArr.find((e) => e.entryNo === entryNo);
                  if (
                    entry &&
                    entry.playerIds.some((pid: string) =>
                      matchingParticipantIds.includes(pid),
                    )
                  ) {
                    // derive a human-friendly label from tournamentField
                    const labelFromTournament = (() => {
                      // if tournament object is present and has a non-empty label, use it
                      if (
                        tournamentField &&
                        typeof tournamentField.label === 'string'
                      ) {
                        // remove occurrences of '敗退' from the label and trim
                        const cleaned = tournamentField.label
                          .replace(/敗退/g, '')
                          .trim();
                        if (cleaned !== '') return cleaned;
                      }

                      if (!tournamentField) {
                        // try the record `roundrobin` or `roundRobin` on the existing `rec`
                        const roundRobinField = rec.roundrobin;
                        if (roundRobinField) {
                          return '予選敗退';
                        }
                      }

                      return undefined;
                    })();

                    resultStr = labelFromTournament || 'ー';
                    break;
                  }
                }
              }
            }

            if (resultStr) break;
          } catch {
            // ignore parse errors
          }
        }

        // check information for scheduled events
        if (!resultStr) {
          const infoPath = path.join(
            root,
            'data',
            'tournament',
            'information',
            `${tournamentId}.json`,
          );
          if (fs.existsSync(infoPath)) {
            try {
              const infoRaw = fs.readFileSync(infoPath, 'utf-8');
              const infos = JSON.parse(infoRaw) as Array<{
                year: number | string;
                startDate?: string;
              }>;
              const infoForYear = infos.find(
                (it) => Number(it.year) === Number(year),
              );
              if (infoForYear && infoForYear.startDate) {
                const sd = new Date(infoForYear.startDate);
                if (sd > now) {
                  // future scheduled -> show date with a marker
                  const label =
                    formatStartDate(infoForYear.startDate) ||
                    infoForYear.startDate;
                  resultStr = `${label}`;
                }
              }
            } catch {
              // ignore
            }
          }
        }

        yearsResults.push({ year: Number(year), result: resultStr || 'ー' });
      }
    } else {
      const infoPath = path.join(
        root,
        'data',
        'tournament',
        'information',
        `${tournamentId}.json`,
      );
      if (fs.existsSync(infoPath)) {
        try {
          const infoRaw = fs.readFileSync(infoPath, 'utf-8');
          const infos = JSON.parse(infoRaw) as Array<{
            year: number | string;
            startDate?: string;
          }>;
          for (const infoForYear of infos) {
            const sd = infoForYear.startDate
              ? new Date(infoForYear.startDate)
              : null;
            if (sd && sd > now) {
              yearsResults.push({
                year: Number(infoForYear.year),
                result: `${formatStartDate(infoForYear.startDate) || infoForYear.startDate}`,
              });
            } else {
              yearsResults.push({
                year: Number(infoForYear.year),
                result: 'ー',
              });
            }
          }
        } catch {
          // ignore
        }
      }
    }

    yearsResults.sort((a, b) => b.year - a.year);
    out.push({ name, years: yearsResults });
  }

  return out;
};
