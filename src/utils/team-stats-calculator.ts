import { EventResult, TeamInfo } from '@/utils/team-data-aggregator';

export type PlayerStats = {
  id: string;
  name: string;
  appearances: number;
  wins: number;
  losses: number;
  winsByRound: Record<string, number>;
};

export type YearlySummary = {
  tournaments: number;
  champions: number;
  runnersUp: number;
  top8OrBetter: number;
  totalPairs: number;
};

export function calculateTeamYearlySummary(results: EventResult[], info: TeamInfo): YearlySummary {
  let champions = 0,
    runnersUp = 0,
    top8OrBetter = 0,
    totalPairs = 0;

  results.forEach((event) => {
    const validResults = event.results.filter((r) => r.playerIds.some((pid) => pid in info.players));

    validResults.forEach((r) => {
      const teamPlayerCount = r.playerIds.filter((pid) => pid in info.players).length;

      if (r.result === '優勝') champions += teamPlayerCount;
      if (r.result === '準優勝') runnersUp += teamPlayerCount;
      if (['優勝', '準優勝', 'ベスト4', 'ベスト8'].includes(r.result)) {
        top8OrBetter += teamPlayerCount;
      }

      totalPairs += teamPlayerCount;
    });
  });

  return {
    tournaments: results.length,
    champions,
    runnersUp,
    top8OrBetter,
    totalPairs,
  };
}

export function calculatePlayerStats(results: EventResult[], info: TeamInfo): Record<string, PlayerStats> {
  // Group stats by player name instead of ID to handle duplicate IDs
  const statsByName: Record<string, PlayerStats> = {};

  const initializePlayerStats = (playerName: string, pid: string) => {
    if (!statsByName[playerName]) {
      statsByName[playerName] = {
        id: pid, // Use the first ID encountered
        name: playerName,
        appearances: 0,
        wins: 0,
        losses: 0,
        winsByRound: {},
      };
    }
  };

  // 名前の無い参加者（チーム単位レコード等の不正データ）は除外し、"null null" の行を防ぐ
  const hasName = (player?: { lastName?: string | null; firstName?: string | null }) => !!player && !!(player.lastName || player.firstName);

  // Initialize stats for ALL players in info.players
  if (info.players) {
    Object.entries(info.players).forEach(([pid, player]) => {
      if (!hasName(player)) return;
      const playerName = `${player.lastName} ${player.firstName}`;
      initializePlayerStats(playerName, pid);
    });
  }

  // First, collect all player IDs that appear in the filtered results
  // We keep this to efficiently filter matches, but initialization happened above
  const relevantPlayerIds = new Set<string>();
  if (info.players) {
    Object.keys(info.players).forEach((pid) => relevantPlayerIds.add(pid));
  }

  results.forEach((event) => {
    event.results.forEach((summry) => {
      summry.playerIds.forEach((pid) => {
        // Only process players that appear in this gender's results
        if (!relevantPlayerIds.has(pid)) return;

        const player = info.players?.[pid];
        if (!player || !hasName(player)) return;

        const playerName = `${player.lastName} ${player.firstName}`;
        // Ensure initialized (though should be already if in info.players)
        initializePlayerStats(playerName, pid);

        if (summry.result) {
          statsByName[playerName].winsByRound[summry.result] = (statsByName[playerName].winsByRound[summry.result] || 0) + 1;
        }
      });
    });

    const countedPlayers = new Set<string>(); // Count appearances only once per event

    event.matches.forEach((match) => {
      match.pair.forEach((pid) => {
        // Only process players that appear in this gender's results
        if (!relevantPlayerIds.has(pid)) return;

        const player = info.players?.[pid];
        if (!player || !hasName(player)) return;

        const playerName = `${player.lastName} ${player.firstName}`;
        initializePlayerStats(playerName, pid);

        // Count wins and losses for all matches
        if (match.result === 'win') statsByName[playerName].wins++;
        else statsByName[playerName].losses++;

        // Count appearances only once per event
        if (!countedPlayers.has(playerName)) {
          statsByName[playerName].appearances++;
          countedPlayers.add(playerName);
        }
      });
    });
  });

  return statsByName;
}
