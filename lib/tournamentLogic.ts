// src/lib/tournamentLogic.ts
import { PlayerInfo, MatchOpponent, TournamentYearData } from '@/types/index';
import { resultPriority } from '@/lib/utils';

export interface TournamentStats {
  sortedTeams: {
    team: string;
    members: { result: string; resultOrder: number; displayParts: { text: string; id?: string; noLink?: boolean }[] }[];
    bestRank: number;
  }[];
  allNames: string[];
  totalMatches: number;
  totalPlayers: number;
  uniqueTeams: number;
  totalGamesWon: number;
  totalGamesLost: number;
  rankedTeams: { rank: number; team: string; count: number }[];
}

export function processTournamentData(
  data: TournamentYearData,
  allPlayers: PlayerInfo[],
  unknownPlayers: Record<string, { firstName: string; lastName: string; team: string }>
): TournamentStats {
  const teamGroups: Record<string, {
    team: string;
    members: { result: string; resultOrder: number; displayParts: { text: string; id?: string; noLink?: boolean }[] }[];
    bestRank: number;
  }> = {};

  for (const entry of data.results ?? []) {
    const players = entry.playerIds.map((id) => {
      const player = allPlayers.find((p) => p.id === id);
      if (player) {
        return { id, name: `${player.lastName}${player.firstName}`, team: player.team ?? '所属不明', noLink: false };
      } else {
        const unknown = unknownPlayers[id];
        return { id, name: unknown ? `${unknown.lastName}${unknown.firstName}` : id, team: unknown?.team ?? '所属不明', noLink: true };
      }
    });

    const resultOrder = resultPriority(entry.result);

    if (players.length === 1 || players[0].team === players[1].team) {
      const team = players[0].team;
      const displayParts = players.flatMap((p, i) => [
        { text: p.name, id: p.noLink ? undefined : p.id, noLink: p.noLink },
        ...(i < players.length - 1 ? [{ text: '・' }] : []),
      ]);

      if (!teamGroups[team]) {
        teamGroups[team] = { team, members: [], bestRank: resultOrder };
      }
      teamGroups[team].members.push({ result: entry.result, resultOrder, displayParts });
      teamGroups[team].bestRank = Math.min(teamGroups[team].bestRank, resultOrder);
    } else {
      for (const p of players) {
        const displayParts = [{ text: p.name, id: p.noLink ? undefined : p.id, noLink: p.noLink }];
        if (!teamGroups[p.team]) {
          teamGroups[p.team] = { team: p.team, members: [], bestRank: resultOrder };
        }
        teamGroups[p.team].members.push({ result: entry.result, resultOrder, displayParts });
        teamGroups[p.team].bestRank = Math.min(teamGroups[p.team].bestRank, resultOrder);
      }
    }
  }

  const sortedTeams = Object.values(teamGroups).sort((a, b) => {
    if (a.bestRank !== b.bestRank) return a.bestRank - b.bestRank;
    return a.team.localeCompare(b.team, 'ja');
  });

  const matches = data.matches ?? [];
  const allNames = [...new Set(matches.map((m) => m.name))];
  const totalMatches = matches.filter((m) => m.result === 'win').length;

  const seenPlayers = new Set<string>();
  const teamCounter: Record<string, number> = {};
  let totalGamesWon = 0;
  let totalGamesLost = 0;

  function findOpponentById(id: string): MatchOpponent | null {
    for (const match of matches) {
      for (const op of match.opponents) {
        if (op.playerId === id || op.tempId === id) return op;
      }
    }
    return null;
  }

  for (const match of matches) {
    if (match.result === 'win') {
      const won = parseInt(match.games.won, 10);
      const lost = parseInt(match.games.lost, 10);
      if (!isNaN(won)) totalGamesWon += won;
      if (!isNaN(lost)) totalGamesLost += lost;
    }
    for (const id of match.pair) {
      if (!seenPlayers.has(id)) {
        const player = findOpponentById(id);
        if (player?.team) {
          teamCounter[player.team] = (teamCounter[player.team] || 0) + 1;
          seenPlayers.add(id);
        }
      }
    }
    for (const op of match.opponents) {
      const id = op.playerId || op.tempId;
      if (!seenPlayers.has(id)) {
        teamCounter[op.team] = (teamCounter[op.team] || 0) + 1;
        seenPlayers.add(id);
      }
    }
  }

  const totalPlayers = seenPlayers.size;
  const uniqueTeams = Object.keys(teamCounter).length;
  const sorted = Object.entries(teamCounter).sort((a, b) => b[1] - a[1]);
  const rankedTeams: { rank: number; team: string; count: number }[] = [];
  let currentRank = 1;
  let prevCount: number | null = null;
  let offset = 0;

  for (let i = 0; i < sorted.length; i++) {
    const [team, count] = sorted[i];
    if (count === prevCount) {
      offset++;
    } else {
      currentRank = i + 1 + offset;
      offset = 0;
    }
    rankedTeams.push({ rank: currentRank, team, count });
    prevCount = count;
  }

  return {
    sortedTeams,
    allNames,
    totalMatches,
    totalPlayers,
    uniqueTeams,
    totalGamesWon,
    totalGamesLost,
    rankedTeams,
  };
}
