// src/utils/team-data-aggregator.ts

import fs from 'fs';
import path from 'path';

import type {
  TournamentDetailData,
  TournamentInformationEntry,
} from '@/types/tournament';

import {
  getAllTournamentFiles,
  getAllTournamentIndex,
  getTournamentLabel,
  loadTournamentData,
  PreloadedTournamentData,
} from './tournament-data-loader';

export type Player = {
  firstName: string;
  lastName: string;
};

export type TeamInfo = {
  id: string;
  name: string;
  players: Record<string, Player>;
};

export type MatchOpponent = {
  lastName: string;
  firstName: string;
  team: string;
  playerId: string | null;
  tempId: string;
  prefecture?: string | null;
  originalTeam?: string | null;
};

export type EventResult = {
  year: number;
  gender: string;
  gameCategory: string;
  tournament: string;
  categoryLabel?: string;
  link?: string;
  startDate?: string;
  endDate?: string;
  results: {
    playerIds: string[];
    result: string;
  }[];
  matches: {
    round: string;
    pair: string[];
    opponents: MatchOpponent[];
    result: 'win' | 'lose';
    games: { won: string; lost: string };
  }[];
};

type TeamNameMappings = Record<string, string[]>;

/**
 * Load team name mappings from configuration file
 */
export function loadTeamNameMappings(): TeamNameMappings {
  const mappingsPath = path.join(
    process.cwd(),
    'data/teams/team-name-mappings.json',
  );

  if (!fs.existsSync(mappingsPath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(mappingsPath, 'utf-8');
    return JSON.parse(content) as TeamNameMappings;
  } catch (error) {
    console.error('Failed to load team name mappings:', error);
    return {};
  }
}

/**
 * Normalize team name to canonical team ID
 */
export function normalizeTeamName(
  teamName: string,
  mappings: TeamNameMappings,
): string | null {
  // Check if team name matches any mapping
  for (const [teamId, variations] of Object.entries(mappings)) {
    if (variations.includes(teamName)) {
      return teamId;
    }
    // Also check if the teamId itself matches
    if (teamId === teamName) {
      return teamId;
    }
  }
  return null;
}

/**
 * Check if a team name matches the target team ID
 */
function isTeamMatch(
  teamName: string,
  targetTeamId: string,
  mappings: TeamNameMappings,
): boolean {
  // Try exact match first
  if (!teamName) return false;

  let normalized = normalizeTeamName(teamName, mappings);
  if (normalized === targetTeamId) return true;

  // Try stripping suffix (e.g. "Name_Prefecture")
  // Many tournament files use "TeamName_Prefecture" in the team field
  if (teamName.includes('_')) {
    const cleanName = teamName.split('_')[0];
    normalized = normalizeTeamName(cleanName, mappings);
    if (normalized === targetTeamId) return true;
  }

  // Also try matching if the teamName starts with any of the variations
  // This helps when the suffix format is irregular but the prefix is clear
  // We must be careful not to match "Yonex Niigata" to "Yonex" if "Yonex Niigata" is distinct
  // But usually participants.json defines the exact names for distinct teams.
  // If we only have "Yonex" defined, "Yonex Niigata" probably shouldn't match unless specified.
  // So sticking to underscore stripping is safer than generic startsWith.

  return false;
}

/**
 * Extract team data from a single tournament
 */
export function extractTeamDataFromTournament(
  tournamentData: TournamentDetailData,
  tournamentId: string,
  year: number,
  category: string,
  teamId: string,
  teamNameMappings: TeamNameMappings,
): {
  players: Map<string, Player>;
  results: Array<{ playerIds: string[]; result: string }>;
  matches: EventResult['matches'];
} {
  const players = new Map<string, Player>();
  const results: Array<{ playerIds: string[]; result: string }> = [];
  const matches: EventResult['matches'] = [];

  // Extract players from this team
  for (const participant of tournamentData.participants) {
    if (isTeamMatch(participant.team, teamId, teamNameMappings)) {
      players.set(participant.id, {
        firstName: participant.firstName,
        lastName: participant.lastName,
      });
    }
  }

  // If no players found, return early
  if (players.size === 0) {
    return { players, results, matches };
  }

  // Build entry number to player IDs mapping
  const entryToPlayers = new Map<number, string[]>();
  for (const entry of tournamentData.entries) {
    entryToPlayers.set(entry.entryNo, entry.playerIds);
  }

  // Extract results for this team
  for (const result of tournamentData.results) {
    const playerIds = entryToPlayers.get(result.entryNo);
    if (!playerIds) continue;

    // Check if any player in this entry belongs to our team
    const hasTeamPlayer = playerIds.some((pid) => players.has(pid));
    if (!hasTeamPlayer) continue;

    // Determine result label
    let resultLabel = '';
    if (result.tournament) {
      resultLabel = result.tournament.label;
    } else if (result.roundrobin) {
      resultLabel = `${result.roundrobin.group}グループ ${result.roundrobin.rank}位`;
    }

    if (resultLabel) {
      results.push({
        playerIds,
        result: resultLabel,
      });
    }
  }

  // Extract matches for this team
  for (const match of tournamentData.matches) {
    const playerIds = entryToPlayers.get(match.entries[0]) || [];
    const opponentIds = entryToPlayers.get(match.entries[1]) || [];

    // Check if this match involves our team
    const isTeamMatch = playerIds.some((pid) => players.has(pid));
    const isOpponentMatch = opponentIds.some((pid) => players.has(pid));

    let pair: string[];
    let opponents: MatchOpponent[];
    let result: 'win' | 'lose';
    let scores: { won: string; lost: string };

    if (isTeamMatch) {
      pair = playerIds;
      opponents = opponentIds.map((opId) => {
        const participant = tournamentData.participants.find(
          (p) => p.id === opId,
        );
        return {
          lastName: participant?.lastName || '',
          firstName: participant?.firstName || '',
          team: participant?.team || '',
          playerId: null,
          tempId: opId,
          prefecture: participant?.prefecture || null,
        };
      });
      result = match.winnerEntryNo === match.entries[0] ? 'win' : 'lose';
      scores = {
        won: String(match.scores[match.entries[0]] || 0),
        lost: String(match.scores[match.entries[1]] || 0),
      };
    } else if (isOpponentMatch) {
      pair = opponentIds;
      opponents = playerIds.map((pId) => {
        const participant = tournamentData.participants.find(
          (p) => p.id === pId,
        );
        return {
          lastName: participant?.lastName || '',
          firstName: participant?.firstName || '',
          team: participant?.team || '',
          playerId: null,
          tempId: pId,
          prefecture: participant?.prefecture || null,
        };
      });
      result = match.winnerEntryNo === match.entries[1] ? 'win' : 'lose';
      scores = {
        won: String(match.scores[match.entries[1]] || 0),
        lost: String(match.scores[match.entries[0]] || 0),
      };
    } else {
      continue;
    }

    matches.push({
      round: match.round || '',
      pair,
      opponents,
      result,
      games: scores,
    });
  }

  return { players, results, matches };
}

/**
 * Aggregate all tournament results for a team
 */
export function aggregateTeamResults(
  teamId: string,
  customMappings?: TeamNameMappings,
  preloadedData?: PreloadedTournamentData[],
): EventResult[] {
  const globalMappings = loadTeamNameMappings();
  const teamNameMappings = { ...globalMappings, ...customMappings };
  const tournamentIndex = getAllTournamentIndex();
  const eventResults: EventResult[] = [];

  // Load tournament information to get category labels
  const informationMap = new Map<string, TournamentInformationEntry[]>();
  const informationRoot = path.join(
    process.cwd(),
    'data/tournaments/information',
  );
  if (fs.existsSync(informationRoot)) {
    const files = fs
      .readdirSync(informationRoot)
      .filter((f) => f.endsWith('.json'));
    for (const f of files) {
      try {
        const tid = path.basename(f, '.json');
        const raw = fs.readFileSync(path.join(informationRoot, f), 'utf-8');
        const parsed = JSON.parse(raw);
        informationMap.set(tid, parsed || []);
      } catch {
        // ignore
      }
    }
  }

  // Pass 1: Identify player genders from explicitly gendered tournaments
  const playerGenders = new Map<string, 'boys' | 'girls'>();

  // Helper to process tournament data for caching
  const processTournament = (
    data: TournamentDetailData,
    descriptor: { tournamentId: string; year: number; category: string },
  ) => {
    const extracted = extractTeamDataFromTournament(
      data,
      descriptor.tournamentId,
      descriptor.year,
      descriptor.category,
      teamId,
      teamNameMappings,
    );

    let gender: 'boys' | 'girls' | 'mixed' | 'unknown' = 'unknown';
    if (
      descriptor.category.includes('boys') ||
      descriptor.category.includes('men')
    ) {
      gender = 'boys';
    } else if (
      descriptor.category.includes('girls') ||
      descriptor.category.includes('women')
    ) {
      gender = 'girls';
    }

    if (gender === 'boys' || gender === 'girls') {
      for (const playerId of extracted.players.keys()) {
        playerGenders.set(playerId, gender);
      }
    }
  };

  if (preloadedData) {
    for (const item of preloadedData) {
      processTournament(item.data, item.descriptor);
    }
  } else {
    // Fallback to reading files
    const tournamentFiles = getAllTournamentFiles();
    for (const file of tournamentFiles) {
      const tournamentData = loadTournamentData(file.filePath);
      if (!tournamentData) continue;
      processTournament(tournamentData, file);
    }
  }

  // Helper function to normalize player ID by removing prefecture suffix
  // Player IDs can be: "name_team" or "name_team_prefecture"
  const normalizePlayerId = (playerId: string): string => {
    const parts = playerId.split('_');
    if (parts.length >= 3) {
      // Return name_team (first 3 parts: lastName_firstName_team)
      return parts.slice(0, 3).join('_');
    }
    return playerId;
  };

  // Helper function to find a player's gender by normalized ID
  const findGenderByNormalizedId = (
    playerId: string,
    genderMap: Map<string, 'boys' | 'girls'>,
  ): 'boys' | 'girls' | undefined => {
    // First try exact match
    if (genderMap.has(playerId)) {
      return genderMap.get(playerId);
    }

    // Try normalized match
    const normalizedId = normalizePlayerId(playerId);
    for (const [knownId, gender] of genderMap.entries()) {
      if (normalizePlayerId(knownId) === normalizedId) {
        return gender;
      }
    }

    return undefined;
  };

  // Pass 1.5: Infer player genders from mixed tournament pair structures
  // In mixed doubles, each pair consists of one male and one female player
  // We can infer gender by cross-referencing with known genders
  let inferredNewGenders = true;
  while (inferredNewGenders) {
    inferredNewGenders = false;

    const inferFromData = (data: TournamentDetailData, category: string) => {
      // Only process mixed tournaments
      if (!category.includes('mixed')) return;

      // Check each entry (pair) in the mixed tournament
      for (const entry of data.entries) {
        // Mixed doubles should have exactly 2 players
        if (entry.playerIds.length !== 2) continue;

        const [player1Id, player2Id] = entry.playerIds;
        const player1Gender = findGenderByNormalizedId(
          player1Id,
          playerGenders,
        );
        const player2Gender = findGenderByNormalizedId(
          player2Id,
          playerGenders,
        );

        // If one player has known gender and the other doesn't, infer the opposite gender
        if (player1Gender && !player2Gender) {
          const oppositeGender = player1Gender === 'boys' ? 'girls' : 'boys';
          playerGenders.set(player2Id, oppositeGender);
          inferredNewGenders = true;
        } else if (player2Gender && !player1Gender) {
          const oppositeGender = player2Gender === 'boys' ? 'girls' : 'boys';
          playerGenders.set(player1Id, oppositeGender);
          inferredNewGenders = true;
        }
      }
    };

    if (preloadedData) {
      for (const item of preloadedData) {
        inferFromData(item.data, item.descriptor.category);
      }
    } else {
      const tournamentFiles = getAllTournamentFiles();
      for (const file of tournamentFiles) {
        const tournamentData = loadTournamentData(file.filePath);
        if (!tournamentData) continue;
        inferFromData(tournamentData, file.category);
      }
    }
  }

  // Pass 2: Generate results
  const generateResults = (
    data: TournamentDetailData,
    descriptor: {
      tournamentId: string;
      year: number;
      category: string;
      filePath: string;
    },
  ) => {
    const extracted = extractTeamDataFromTournament(
      data,
      descriptor.tournamentId,
      descriptor.year,
      descriptor.category,
      teamId,
      teamNameMappings,
    );

    // Skip if no data for this team
    if (
      extracted.players.size === 0 &&
      extracted.results.length === 0 &&
      extracted.matches.length === 0
    ) {
      return;
    }

    // Get tournament information
    const tournamentLabel = getTournamentLabel(descriptor.tournamentId);

    const tournamentName = `${tournamentLabel} ${descriptor.year}`;

    // Construct internal link
    const tournamentEntry = tournamentIndex.find(
      (t) => t.tournamentId === descriptor.tournamentId,
    );
    const generationId = tournamentEntry?.generationId || 'all';

    // Parse category filename to extract parts
    // Format: [gameCategory]-[ageCategory]-[gender].json or [gameCategory]-[gender].json
    // e.g. doubles-u14-boys.json, team-none-boys.json
    const categoryParts = descriptor.category.split('-');
    let gameCategory = 'doubles';
    let ageCategory = 'none';
    let genderPart = 'boys';

    if (categoryParts.length === 3) {
      gameCategory = categoryParts[0];
      ageCategory = categoryParts[1];
      genderPart = categoryParts[2];
    } else if (categoryParts.length === 2) {
      gameCategory = categoryParts[0];
      genderPart = categoryParts[1];
    }

    const link = `/tournaments/${generationId}/${descriptor.tournamentId}/${descriptor.year}/${gameCategory}/${ageCategory}/${genderPart}`;

    // Get category label from information map
    let categoryLabel: string | undefined;
    let fiscalYear = descriptor.year;
    let startDate: string | undefined;
    let endDate: string | undefined;

    const tournamentInfo = informationMap.get(descriptor.tournamentId);
    if (tournamentInfo) {
      // Try to find by exact match first (assuming directory is fiscal year)
      let yearInfo = tournamentInfo.find(
        (info) => info.year === descriptor.year,
      );

      // If not found, try to find by calendar year matching start/end date
      // This handles cases where directory is named after calendar year (e.g. 2024)
      // but belongs to fiscal year (e.g. 2023) because it's in Jan-March.
      // We need startDate to resolve this ambiguity.
      if (!yearInfo) {
        yearInfo = tournamentInfo.find((info) => {
          if (!info.startDate) return false;
          const startYear = parseInt(info.startDate.split('-')[0], 10);
          const endYear = info.endDate
            ? parseInt(info.endDate.split('-')[0], 10)
            : startYear;
          return startYear === descriptor.year || endYear === descriptor.year;
        });
      }

      if (yearInfo) {
        fiscalYear = yearInfo.year;
        startDate = yearInfo.startDate;
        endDate = yearInfo.endDate;
        if (yearInfo.categories) {
          const category = yearInfo.categories.find(
            (cat) => cat.categoryId === descriptor.category,
          );
          if (category) {
            categoryLabel = category.label;
          }
        }
      }
    }

    // Determine gender from category ID (filename)
    let gender = 'unknown';
    if (
      descriptor.category.includes('boys') ||
      descriptor.category.includes('men')
    ) {
      gender = 'boys';
    } else if (
      descriptor.category.includes('girls') ||
      descriptor.category.includes('women')
    ) {
      gender = 'girls';
    } else if (descriptor.category.includes('mixed')) {
      gender = 'mixed';
    }

    if (gender === 'mixed') {
      // Distribute mixed results to boys/girls based on player gender
      const boysEvent: EventResult = {
        year: fiscalYear,
        gender: 'boys',
        gameCategory,
        tournament: tournamentName,
        categoryLabel,
        link,
        startDate,
        endDate,
        results: [],
        matches: [],
      };
      const girlsEvent: EventResult = {
        year: fiscalYear,
        gender: 'girls',
        gameCategory,
        tournament: tournamentName,
        categoryLabel,
        link,
        startDate,
        endDate,
        results: [],
        matches: [],
      };

      // Distribute results
      extracted.results.forEach((r) => {
        // Filter player IDs by gender
        const boyPlayerIds = r.playerIds.filter(
          (pid) => findGenderByNormalizedId(pid, playerGenders) === 'boys',
        );
        const girlPlayerIds = r.playerIds.filter(
          (pid) => findGenderByNormalizedId(pid, playerGenders) === 'girls',
        );

        // Add to boys event if there are any boys
        if (boyPlayerIds.length > 0) {
          boysEvent.results.push({
            ...r,
            playerIds: boyPlayerIds,
          });
        }

        // Add to girls event if there are any girls
        if (girlPlayerIds.length > 0) {
          girlsEvent.results.push({
            ...r,
            playerIds: girlPlayerIds,
          });
        }
      });

      // Distribute matches
      extracted.matches.forEach((m) => {
        // Filter pair by gender
        const boyPair = m.pair.filter(
          (pid) => findGenderByNormalizedId(pid, playerGenders) === 'boys',
        );
        const girlPair = m.pair.filter(
          (pid) => findGenderByNormalizedId(pid, playerGenders) === 'girls',
        );

        // Add to boys event if there are any boys
        if (boyPair.length > 0) {
          boysEvent.matches.push({
            ...m,
            pair: boyPair,
          });
        }

        // Add to girls event if there are any girls
        if (girlPair.length > 0) {
          girlsEvent.matches.push({
            ...m,
            pair: girlPair,
          });
        }
      });

      if (boysEvent.results.length > 0 || boysEvent.matches.length > 0) {
        eventResults.push(boysEvent);
      }
      if (girlsEvent.results.length > 0 || girlsEvent.matches.length > 0) {
        eventResults.push(girlsEvent);
      }
    } else {
      // Add as is for non-mixed events
      eventResults.push({
        year: fiscalYear,
        gender,
        gameCategory,
        tournament: tournamentName,
        categoryLabel,
        link,
        startDate,
        endDate,
        results: extracted.results,
        matches: extracted.matches,
      });
    }
  };

  if (preloadedData) {
    for (const item of preloadedData) {
      generateResults(item.data, item.descriptor);
    }
  } else {
    const tournamentFiles = getAllTournamentFiles();
    for (const file of tournamentFiles) {
      const tournamentData = loadTournamentData(file.filePath);
      if (!tournamentData) continue;
      generateResults(tournamentData, file);
    }
  }

  return eventResults;
}

/**
 * Generate team information from tournament data
 */
export function generateTeamInfo(
  teamId: string,
  customMappings?: TeamNameMappings,
  preloadedData?: PreloadedTournamentData[],
): TeamInfo {
  const globalMappings = loadTeamNameMappings();
  const teamNameMappings = { ...globalMappings, ...customMappings };
  const allPlayers = new Map<string, Player>();

  // Get canonical team name from mappings
  const key =
    Object.keys(teamNameMappings).find((id) => id === teamId) || teamId;
  const teamName = teamNameMappings[key]?.[0] || teamId;

  const processFile = (
    data: TournamentDetailData,
    descriptor: { tournamentId: string; year: number; category: string },
  ) => {
    const extracted = extractTeamDataFromTournament(
      data,
      descriptor.tournamentId,
      descriptor.year,
      descriptor.category,
      teamId,
      teamNameMappings,
    );

    // Merge players
    for (const [playerId, player] of extracted.players) {
      if (!allPlayers.has(playerId)) {
        allPlayers.set(playerId, player);
      }
    }
  };

  if (preloadedData) {
    for (const item of preloadedData) {
      processFile(item.data, item.descriptor);
    }
  } else {
    const tournamentFiles = getAllTournamentFiles();
    for (const file of tournamentFiles) {
      const tournamentData = loadTournamentData(file.filePath);
      if (!tournamentData) continue;
      processFile(tournamentData, file);
    }
  }

  // Convert Map to Record
  const players: Record<string, Player> = {};
  for (const [playerId, player] of allPlayers) {
    players[playerId] = player;
  }

  return {
    id: teamId,
    name: teamName,
    players,
  };
}
