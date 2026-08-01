import type { Match, MatchPlayer } from '../../src/types/database';
import {
  DEFAULT_GROWTH_VISIBILITY,
  type GrowthBuildOptions,
  type GrowthTarget,
  type GrowthTargetKind,
  type GrowthVisibility,
  type PlayerIdentity,
  type TeamKey,
} from './types';

export const toExcludedKeySet = (excludedKeys?: ReadonlySet<string> | string[]): ReadonlySet<string> => {
  if (!excludedKeys) return new Set();
  return Array.isArray(excludedKeys) ? new Set(excludedKeys) : excludedKeys;
};

export const getRequiredWins = (bestOf: number) => Math.ceil(bestOf / 2);

export const normalizeText = (value: string | null | undefined) => (value ?? '').trim().replace(/\s+/g, ' ');

export const normalizeKeyText = (value: string | null | undefined) => normalizeText(value).toLowerCase();

const formatPlayerName = (player: MatchPlayer | PlayerIdentity) => {
  const name = normalizeText('last_name' in player ? `${player.last_name ?? ''} ${player.first_name ?? ''}` : player.name);
  return name || '選手名不明';
};

const getTeamPlayers = (match: Match, team: TeamKey): PlayerIdentity[] => {
  const structuredPlayers = match.teams?.[team]?.players ?? [];
  if (structuredPlayers.length > 0) {
    return structuredPlayers.map((player) => ({
      name: formatPlayerName(player),
      teamName: normalizeText(player.team_name),
      region: normalizeText(player.region),
    }));
  }

  const prefix = `team_${team.toLowerCase()}`;
  const players = [1, 2]
    .map((playerIndex) => {
      const lastName = normalizeText(match[`${prefix}_player${playerIndex}_last_name` as keyof Match] as string | null | undefined);
      const firstName = normalizeText(match[`${prefix}_player${playerIndex}_first_name` as keyof Match] as string | null | undefined);
      if (!lastName && !firstName) return null;

      return {
        name: normalizeText(`${lastName} ${firstName}`),
        teamName: normalizeText(match[`${prefix}_player${playerIndex}_team_name` as keyof Match] as string | null | undefined),
        region: normalizeText(match[`${prefix}_player${playerIndex}_region` as keyof Match] as string | null | undefined),
      };
    })
    .filter((player): player is PlayerIdentity => Boolean(player));

  if (players.length > 0) return players;

  const fallbackName = normalizeText(team === 'A' ? match.team_a : match.team_b);
  return fallbackName ? [{ name: fallbackName, teamName: '', region: '' }] : [{ name: `チーム${team}`, teamName: '', region: '' }];
};

const getPlayerIdentityKey = (player: PlayerIdentity) => normalizeKeyText(player.name);

const getSideTargetBase = (match: Match, side: TeamKey) => {
  const players = getTeamPlayers(match, side);
  const kind: GrowthTargetKind = players.length > 1 || match.game_type === 'doubles' ? 'pair' : 'player';
  const playerKeys = kind === 'pair' ? players.map(getPlayerIdentityKey).sort() : [getPlayerIdentityKey(players[0])];
  const playerNames = players.map((player) => player.name);
  const teamNames = [...new Set(players.map((player) => player.teamName).filter(Boolean))];
  const regions = [...new Set(players.map((player) => player.region).filter(Boolean))];

  return {
    key: `${kind}:${playerKeys.join('&')}`,
    kind,
    displayName: playerNames.join('・'),
    playerNames,
    teamNames,
    regions,
    visibility: DEFAULT_GROWTH_VISIBILITY as GrowthVisibility,
  };
};

export const getMatchDate = (match: Match) => match.match_date ?? match.completed_at ?? match.created_at ?? null;

export const getMatchWinner = (match: Match): TeamKey | null => {
  const games = match.games ?? [];
  const gamesWonA = games.filter((game) => game.winner_team === 'A').length;
  const gamesWonB = games.filter((game) => game.winner_team === 'B').length;
  const requiredWins = getRequiredWins(match.best_of);

  if (gamesWonA >= requiredWins) return 'A';
  if (gamesWonB >= requiredWins) return 'B';
  return null;
};

export const isCompletedMatch = (match: Match) => match.status === 'completed' || getMatchWinner(match) !== null;

export const getGrowthTargetForSide = (match: Match, side: TeamKey): GrowthTarget => {
  const base = getSideTargetBase(match, side);
  const date = getMatchDate(match);

  return {
    ...base,
    matchCount: 1,
    completedMatchCount: isCompletedMatch(match) ? 1 : 0,
    latestMatchDate: date,
  };
};

export const getGrowthTargetsForMatch = (match: Match): GrowthTarget[] => [getGrowthTargetForSide(match, 'A'), getGrowthTargetForSide(match, 'B')];

export const buildGrowthTargets = (matches: Match[], options: GrowthBuildOptions = {}): GrowthTarget[] => {
  const targetMap = new Map<string, GrowthTarget>();
  const excludedKeys = toExcludedKeySet(options.excludedKeys);
  const featuredKeys = toExcludedKeySet(options.featuredKeys);

  matches.forEach((match) => {
    getGrowthTargetsForMatch(match).forEach((target) => {
      // 撤回（オプトアウト）された対象は生成しない（ADR-004 Decision 5）。
      if (excludedKeys.has(target.key)) return;

      const existing = targetMap.get(target.key);
      if (!existing) {
        targetMap.set(target.key, target);
        return;
      }

      const latestMatchDate =
        !existing.latestMatchDate || (target.latestMatchDate && target.latestMatchDate > existing.latestMatchDate)
          ? target.latestMatchDate
          : existing.latestMatchDate;

      targetMap.set(target.key, {
        ...existing,
        teamNames: [...new Set([...existing.teamNames, ...target.teamNames])],
        regions: [...new Set([...existing.regions, ...target.regions])],
        matchCount: existing.matchCount + 1,
        completedMatchCount: existing.completedMatchCount + target.completedMatchCount,
        latestMatchDate,
      });
    });
  });

  return [...targetMap.values()]
    .map((target) =>
      // ショーケース対象は公開（インデックス対象）に引き上げる（ADR-004）。
      featuredKeys.has(target.key) ? { ...target, visibility: 'public' as GrowthVisibility } : target,
    )
    .sort((left, right) => {
      const dateOrder = (right.latestMatchDate ?? '').localeCompare(left.latestMatchDate ?? '');
      if (dateOrder !== 0) return dateOrder;
      return right.completedMatchCount - left.completedMatchCount;
    });
};
