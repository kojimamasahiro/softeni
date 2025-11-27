// src/utils/team-data-aggregator.ts

import fs from 'fs';
import path from 'path';

import type { TournamentDetailData } from '@/types/tournament';

import {
  getAllTournamentFiles,
  getAllTournamentIndex,
  getTournamentLabel,
  loadTournamentData,
} from './tournament-data-loader';

type Player = {
  firstName: string;
  lastName: string;
};

type TeamInfo = {
  id: string;
  name: string;
  players: Record<string, Player>;
};

type MatchOpponent = {
  lastName: string;
  firstName: string;
  team: string;
  playerId: string | null;
  tempId: string;
  prefecture?: string | null;
  originalTeam?: string | null;
};

type EventResult = {
  year: number;
  gender: string;
  tournament: string;
  link?: string;
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
  const normalized = normalizeTeamName(teamName, mappings);
  return normalized === targetTeamId;
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
export function aggregateTeamResults(teamId: string): EventResult[] {
  const teamNameMappings = loadTeamNameMappings();
  const tournamentFiles = getAllTournamentFiles();
  const tournamentIndex = getAllTournamentIndex();
  const eventResults: EventResult[] = [];

  // Pass 1: Identify player genders
  const playerGenders = new Map<string, 'boys' | 'girls'>();

  for (const file of tournamentFiles) {
    const tournamentData = loadTournamentData(file.filePath);
    if (!tournamentData) continue;

    const extracted = extractTeamDataFromTournament(
      tournamentData,
      file.tournamentId,
      file.year,
      file.category,
      teamId,
      teamNameMappings,
    );

    let gender: 'boys' | 'girls' | 'mixed' | 'unknown' = 'unknown';
    if (file.category.includes('boys') || file.category.includes('men')) {
      gender = 'boys';
    } else if (
      file.category.includes('girls') ||
      file.category.includes('women')
    ) {
      gender = 'girls';
    }

    if (gender === 'boys' || gender === 'girls') {
      for (const playerId of extracted.players.keys()) {
        playerGenders.set(playerId, gender);
      }
    }
  }

  // Pass 2: Generate results
  for (const file of tournamentFiles) {
    const tournamentData = loadTournamentData(file.filePath);
    if (!tournamentData) continue;

    const extracted = extractTeamDataFromTournament(
      tournamentData,
      file.tournamentId,
      file.year,
      file.category,
      teamId,
      teamNameMappings,
    );

    // Skip if no data for this team
    if (
      extracted.players.size === 0 &&
      extracted.results.length === 0 &&
      extracted.matches.length === 0
    ) {
      continue;
    }

    // Get tournament information
    const tournamentLabel = getTournamentLabel(file.tournamentId);

    const tournamentName = `${tournamentLabel} ${file.year}`;

    // Construct internal link
    const tournamentEntry = tournamentIndex.find(
      (t) => t.tournamentId === file.tournamentId,
    );
    const generationId = tournamentEntry?.generationId || 'all';

    // Parse category filename to extract parts
    // Format: [gameCategory]-[ageCategory]-[gender].json or [gameCategory]-[gender].json
    // e.g. doubles-u14-boys.json, team-none-boys.json
    const categoryParts = file.category.split('-');
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

    const link = `/tournaments/${generationId}/${file.tournamentId}/${file.year}/${gameCategory}/${ageCategory}/${genderPart}`;

    // Determine gender from category ID (filename)
    let gender = 'unknown';
    if (file.category.includes('boys') || file.category.includes('men')) {
      gender = 'boys';
    } else if (
      file.category.includes('girls') ||
      file.category.includes('women')
    ) {
      gender = 'girls';
    } else if (file.category.includes('mixed')) {
      gender = 'mixed';
    }

    if (gender === 'mixed') {
      // Distribute mixed results to boys/girls based on player gender
      const boysEvent: EventResult = {
        year: file.year,
        gender: 'boys',
        tournament: tournamentName,
        link,
        results: [],
        matches: [],
      };
      const girlsEvent: EventResult = {
        year: file.year,
        gender: 'girls',
        tournament: tournamentName,
        link,
        results: [],
        matches: [],
      };

      // Distribute results
      extracted.results.forEach((r) => {
        const isBoy = r.playerIds.some(
          (pid) => playerGenders.get(pid) === 'boys',
        );
        const isGirl = r.playerIds.some(
          (pid) => playerGenders.get(pid) === 'girls',
        );

        if (isBoy) boysEvent.results.push(r);
        if (isGirl) girlsEvent.results.push(r);
      });

      // Distribute matches
      extracted.matches.forEach((m) => {
        const isBoy = m.pair.some((pid) => playerGenders.get(pid) === 'boys');
        const isGirl = m.pair.some((pid) => playerGenders.get(pid) === 'girls');

        if (isBoy) boysEvent.matches.push(m);
        if (isGirl) girlsEvent.matches.push(m);
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
        year: file.year,
        gender,
        tournament: tournamentName,
        link,
        results: extracted.results,
        matches: extracted.matches,
      });
    }
  }

  return eventResults;
}

/**
 * Generate team information from tournament data
 */
export function generateTeamInfo(teamId: string): TeamInfo {
  const teamNameMappings = loadTeamNameMappings();
  const tournamentFiles = getAllTournamentFiles();
  const allPlayers = new Map<string, Player>();

  // Get canonical team name from mappings
  const key =
    Object.keys(teamNameMappings).find((id) => id === teamId) || teamId;
  const teamName = teamNameMappings[key][0];

  for (const file of tournamentFiles) {
    const tournamentData = loadTournamentData(file.filePath);
    if (!tournamentData) continue;

    const extracted = extractTeamDataFromTournament(
      tournamentData,
      file.tournamentId,
      file.year,
      file.category,
      teamId,
      teamNameMappings,
    );

    // Merge players
    for (const [playerId, player] of extracted.players) {
      if (!allPlayers.has(playerId)) {
        allPlayers.set(playerId, player);
      }
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
