import {
  getAllDetailRecords,
  loadInformationMap,
  loadTournamentIndex,
} from '@/lib/tournamentData';
import type {
  TournamentDetailData,
  TournamentEntry,
  TournamentParticipant,
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
  const index = loadTournamentIndex();
  const majors = index.filter((t) => t.isMajorTitle);
  const now = new Date();
  const out: MajorTitleData[] = [];

  const infoMap = loadInformationMap();
  const allDetails = getAllDetailRecords();

  for (const m of majors) {
    const tournamentId = m.tournamentId;
    const name = m.label || tournamentId;
    const yearsResults: MajorTitleYear[] = [];

    // collect detail records for this tournament
    const records = allDetails.filter((r) => r.tournamentId === tournamentId);
    const yearGrouped = new Map<string, TournamentDetailData[]>();
    for (const r of records) {
      const arr = yearGrouped.get(r.year) ?? [];
      arr.push(r.detail);
      yearGrouped.set(r.year, arr);
    }

    // also include years present in information files even if no details
    const infoEntries = infoMap.get(tournamentId) ?? [];
    for (const info of infoEntries) {
      if (!yearGrouped.has(String(info.year))) {
        yearGrouped.set(String(info.year), []);
      }
    }

    const years = Array.from(yearGrouped.keys()).sort(
      (a, b) => Number(b) - Number(a),
    );
    for (const year of years) {
      let resultStr: string | null = null;
      const details = yearGrouped.get(year) ?? [];

      // search details for results
      for (const d of details) {
        const participants: TournamentParticipant[] = Array.isArray(
          d.participants,
        )
          ? (d.participants as TournamentParticipant[])
          : [];
        const matchingParticipantIds = participants
          .filter((p) => p.lastName === lastName && p.firstName === firstName)
          .map((p) => p.id);
        if (matchingParticipantIds.length === 0) continue;

        const maybeResults = Array.isArray(d.results) ? d.results : undefined;
        const maybeEntries = Array.isArray(d.entries) ? d.entries : undefined;

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
                    resultStr = resultField as string;
                    break;
                  }
                }
              }
            }
            if (resultStr) break;
          }
        }

        if (
          !resultStr &&
          Array.isArray(maybeResults) &&
          Array.isArray(maybeEntries)
        ) {
          const entriesArr = maybeEntries as TournamentEntry[];
          for (const r of maybeResults) {
            if (r && typeof r === 'object') {
              const rec = r as unknown as Record<string, unknown>;
              const entryNo = rec.entryNo as unknown as number | undefined;
              const entry = entriesArr.find((e) => e.entryNo === entryNo);
              if (
                entry &&
                entry.playerIds.some((pid: string) =>
                  matchingParticipantIds.includes(pid),
                )
              ) {
                const tournamentField = rec.tournament as
                  | Record<string, unknown>
                  | undefined;
                const labelFromTournament = (() => {
                  if (
                    tournamentField &&
                    typeof tournamentField.label === 'string'
                  ) {
                    const cleaned = (tournamentField.label as string)
                      .replace(/敗退/g, '')
                      .trim();
                    if (cleaned !== '') return cleaned;
                  }
                  if (!tournamentField) {
                    if (rec['roundrobin']) return '予選敗退';
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
      }

      // if not found in details, consult information for future scheduled
      if (!resultStr) {
        const infoForYear = infoEntries.find(
          (it) => Number(it.year) === Number(year),
        );
        if (infoForYear && infoForYear.startDate) {
          const sd = new Date(infoForYear.startDate);
          if (sd > now) {
            const label =
              formatStartDate(infoForYear.startDate) || infoForYear.startDate;
            resultStr = `${label}`;
          }
        }
      }

      yearsResults.push({ year: Number(year), result: resultStr || 'ー' });
    }

    out.push({ name, years: yearsResults });
  }

  return out;
};
