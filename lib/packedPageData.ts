import type {
  TournamentDetailData,
  TournamentEntry,
  TournamentMatch,
  TournamentParticipant,
  TournamentResult,
} from '@/types';

type StringId = number;
type NullableStringId = StringId | null;

type MaybeId = string | number | null | undefined;

export type PackablePlayerResult = {
  fullName?: string;
  team: string;
  prefecture?: string | null;
  result: string;
  tournamentName: string;
  tournamentId: string;
  generation: string;
  year: string;
  gameCategory: string;
  ageCategory: string;
  gender: string;
  categoryLabel: string;
  playerId?: MaybeId;
};

export type PackableSameNameGroup = {
  fullName: string;
  players: PackablePlayerResult[];
  count: number;
  differentTeams: string[];
  playerId?: MaybeId;
};

type PackedPlayerResult = [
  team: StringId,
  prefecture: NullableStringId,
  result: StringId,
  tournamentName: StringId,
  tournamentId: StringId,
  generation: StringId,
  year: number,
  gameCategory: StringId,
  ageCategory: StringId,
  gender: StringId,
  categoryLabel: StringId,
  playerId: MaybeId,
];

type PackedSameNameGroup = [
  fullName: StringId,
  count: number,
  playerId: MaybeId,
  differentTeams: StringId[],
  players: PackedPlayerResult[],
];

export type PackedSameNameGroups = {
  strings: string[];
  groups: PackedSameNameGroup[];
};

type PackedParticipant = [
  lastName: NullableStringId,
  firstName: NullableStringId,
  team: NullableStringId,
  prefecture: NullableStringId,
  playerId: number | null,
];

type PackedEntry = [
  entryNo: number,
  playerIndexes: number[],
  type: NullableStringId,
];

type PackedMatch = [
  entries: number[],
  scores: Array<number | null>,
  round: NullableStringId,
  winnerEntryNo: number | null,
  stage: NullableStringId,
  group: NullableStringId,
  matchId: NullableStringId,
  nextMatchId: NullableStringId,
];

type PackedResult = [
  entryNo: number,
  tournamentLabel: NullableStringId,
  rankKind: NullableStringId,
  rankValue: number | null,
  rankBestLevel: number | null,
  rankRound: number | null,
  roundrobinGroup: NullableStringId,
  roundrobinRank: number | null,
];

export type PackedTournamentDetailData = {
  strings: string[];
  participants: PackedParticipant[];
  entries: PackedEntry[];
  matches: PackedMatch[];
  results: PackedResult[];
};

function createStringTable() {
  const strings: string[] = [];
  const indexes = new Map<string, number>();

  const add = (value: string | null | undefined): NullableStringId => {
    if (value === null || value === undefined) return null;
    const existing = indexes.get(value);
    if (existing !== undefined) return existing;

    const index = strings.length;
    strings.push(value);
    indexes.set(value, index);
    return index;
  };

  return { strings, add };
}

function readString(strings: string[], index: NullableStringId): string {
  if (index === null) return '';
  return strings[index] ?? '';
}

function readNullableString(
  strings: string[],
  index: NullableStringId,
): string | null {
  if (index === null) return null;
  return strings[index] ?? null;
}

export function packSameNameGroups(
  groups: PackableSameNameGroup[],
): PackedSameNameGroups {
  const table = createStringTable();

  return {
    strings: table.strings,
    groups: groups.map((group) => [
      table.add(group.fullName) ?? 0,
      group.count,
      group.playerId ?? null,
      group.differentTeams.map((team) => table.add(team) ?? 0),
      group.players.map((player) => [
        table.add(player.team) ?? 0,
        table.add(player.prefecture),
        table.add(player.result) ?? 0,
        table.add(player.tournamentName) ?? 0,
        table.add(player.tournamentId) ?? 0,
        table.add(player.generation) ?? 0,
        Number(player.year),
        table.add(player.gameCategory) ?? 0,
        table.add(player.ageCategory) ?? 0,
        table.add(player.gender) ?? 0,
        table.add(player.categoryLabel) ?? 0,
        player.playerId ?? null,
      ]),
    ]),
  };
}

export function unpackSameNameGroups(
  packed: PackedSameNameGroups,
): PackableSameNameGroup[] {
  const strings = packed.strings;

  return packed.groups.map(
    ([fullNameId, count, playerId, teamIds, packedPlayers]) => {
      const fullName = readString(strings, fullNameId);

      return {
        fullName,
        count,
        playerId,
        differentTeams: teamIds.map((teamId) => readString(strings, teamId)),
        players: packedPlayers.map(
          ([
            team,
            prefecture,
            result,
            tournamentName,
            tournamentId,
            generation,
            year,
            gameCategory,
            ageCategory,
            gender,
            categoryLabel,
            playerResultId,
          ]) => ({
            firstName: '',
            lastName: '',
            fullName,
            team: readString(strings, team),
            prefecture: readNullableString(strings, prefecture),
            result: readString(strings, result),
            tournamentName: readString(strings, tournamentName),
            tournamentId: readString(strings, tournamentId),
            generation: readString(strings, generation),
            year: String(year),
            gameCategory: readString(strings, gameCategory),
            ageCategory: readString(strings, ageCategory),
            gender: readString(strings, gender),
            categoryLabel: readString(strings, categoryLabel),
            playerId: playerResultId,
          }),
        ),
      };
    },
  );
}

export function packTournamentDetailData(
  detailData: TournamentDetailData,
): PackedTournamentDetailData {
  const table = createStringTable();
  const participantIndexById = new Map<string, number>();

  const participants = (detailData.participants ?? []).map(
    (participant, index): PackedParticipant => {
      participantIndexById.set(participant.id, index);

      return [
        table.add(participant.lastName),
        table.add(participant.firstName),
        table.add(participant.team),
        table.add(participant.prefecture),
        participant.playerId ?? null,
      ];
    },
  );

  const entries = (detailData.entries ?? []).map(
    (entry): PackedEntry => [
      entry.entryNo,
      (entry.playerIds ?? []).map((id) => participantIndexById.get(id) ?? -1),
      table.add(entry.type),
    ],
  );

  const matches = (detailData.matches ?? []).map((match): PackedMatch => {
    const entries = match.entries ?? [];
    const scores = entries.map((entryNo) => {
      const score = match.scores?.[String(entryNo)] ?? match.scores?.[entryNo];
      return typeof score === 'number' ? score : null;
    });

    return [
      entries,
      scores,
      table.add(match.round),
      match.winnerEntryNo ?? null,
      table.add(match.stage),
      table.add(match.group),
      table.add(match.matchId),
      table.add(match.nextMatchId),
    ];
  });

  const results = (detailData.results ?? []).map((result): PackedResult => {
    const rank = result.tournament?.rank as
      | {
          kind?: string;
          value?: number;
          bestLevel?: number;
          round?: number;
        }
      | undefined;

    return [
      result.entryNo,
      table.add(result.tournament?.label),
      table.add(rank?.kind),
      rank?.value ?? null,
      rank?.bestLevel ?? null,
      rank?.round ?? null,
      table.add(result.roundrobin?.group),
      result.roundrobin?.rank ?? null,
    ];
  });

  return {
    strings: table.strings,
    participants,
    entries,
    matches,
    results,
  };
}

export function unpackTournamentDetailData(
  packed: PackedTournamentDetailData,
): TournamentDetailData {
  const strings = packed.strings;
  const participantIds = packed.participants.map((_, index) => `p${index}`);

  const participants: TournamentParticipant[] = packed.participants.map(
    ([lastName, firstName, team, prefecture, playerId], index) => ({
      id: participantIds[index],
      lastName: readString(strings, lastName),
      firstName: readString(strings, firstName),
      team: readString(strings, team),
      prefecture: readNullableString(strings, prefecture),
      ...(playerId !== null ? { playerId } : {}),
    }),
  );

  const entries: TournamentEntry[] = packed.entries.map(
    ([entryNo, playerIndexes, type]) => ({
      entryNo,
      playerIds: playerIndexes
        .map((index) => participantIds[index])
        .filter((id): id is string => Boolean(id)),
      ...(type !== null ? { type: readString(strings, type) } : {}),
    }),
  );

  const matches: TournamentMatch[] = packed.matches.map(
    ([
      entries,
      packedScores,
      round,
      winnerEntryNo,
      stage,
      group,
      matchId,
      nextMatchId,
    ]) => {
      const scores: Record<string, number> = {};
      entries.forEach((entryNo, index) => {
        const score = packedScores[index];
        if (typeof score === 'number') {
          scores[String(entryNo)] = score;
        }
      });

      return {
        entries,
        scores,
        round: readNullableString(strings, round),
        winnerEntryNo: winnerEntryNo ?? -1,
        retired: false,
        stage: readString(strings, stage),
        group: readNullableString(strings, group),
        matchId: readString(strings, matchId),
        nextMatchId: readNullableString(strings, nextMatchId),
        prevMatchIds: [],
        prevMatchId: null,
      };
    },
  );

  const results: TournamentResult[] = packed.results.map(
    ([
      entryNo,
      tournamentLabel,
      rankKind,
      rankValue,
      rankBestLevel,
      rankRound,
      roundrobinGroup,
      roundrobinRank,
    ]) => {
      const label = readNullableString(strings, tournamentLabel);
      const kind = readNullableString(strings, rankKind);
      const result: TournamentResult = { entryNo };

      if (label !== null) {
        result.tournament = {
          label,
          rank: {
            ...(kind !== null ? { kind } : {}),
            ...(rankValue !== null ? { value: rankValue } : {}),
            ...(rankBestLevel !== null ? { bestLevel: rankBestLevel } : {}),
            ...(rankRound !== null ? { round: rankRound } : {}),
          } as NonNullable<TournamentResult['tournament']>['rank'],
        };
      }

      if (roundrobinGroup !== null || roundrobinRank !== null) {
        result.roundrobin = {
          group: readString(strings, roundrobinGroup),
          rank: roundrobinRank ?? 0,
        };
      }

      return result;
    },
  );

  return {
    participants,
    entries,
    matches,
    results,
  };
}
