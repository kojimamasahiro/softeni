import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const playersRoot = path.join(projectRoot, 'data', 'players');
const tournamentsRoot = path.join(projectRoot, 'data', 'tournaments');

const calculateRate = (numerator, denominator) => {
  if (denominator <= 0) return 0;

  const factor = 1000;
  const scaled = numerator * factor;
  const quotient = Math.floor(scaled / denominator);
  const remainder = scaled % denominator;
  const doubledRemainder = remainder * 2;

  if (doubledRemainder < denominator) {
    return quotient / factor;
  }

  if (doubledRemainder > denominator) {
    return (quotient + 1) / factor;
  }

  return (quotient % 2 === 0 ? quotient : quotient + 1) / factor;
};

const parseStartTime = (value) => {
  if (!value) return 0;

  const iso = String(value).match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) {
    const date = new Date(iso[1]);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }

  const slash = String(value).match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slash) {
    const date = new Date(
      Number(slash[1]),
      Number(slash[2]) - 1,
      Number(slash[3]),
    );
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }

  const japanese = String(value).match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (japanese) {
    const date = new Date(
      Number(japanese[1]),
      Number(japanese[2]) - 1,
      Number(japanese[3]),
    );
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }

  const yearOnly = String(value).match(/(19|20)\d{2}/);
  if (yearOnly) {
    const date = new Date(Number(yearOnly[0]), 0, 1);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }

  return 0;
};

const formatJapaneseDate = (value) => {
  if (!value) return '';

  const iso = String(value).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return `${Number(iso[1])}年${Number(iso[2])}月${Number(iso[3])}日`;
  }

  const slash = String(value).match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slash) {
    return `${Number(slash[1])}年${Number(slash[2])}月${Number(slash[3])}日`;
  }

  const japanese = String(value).match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (japanese) {
    return `${Number(japanese[1])}年${Number(japanese[2])}月${Number(japanese[3])}日`;
  }

  return String(value);
};

const formatDateRange = (startDate, endDate, fallbackYear) => {
  if (startDate && endDate) {
    if (startDate === endDate) {
      return formatJapaneseDate(startDate);
    }
    return `${formatJapaneseDate(startDate)}〜${formatJapaneseDate(endDate)}`;
  }

  if (startDate) return formatJapaneseDate(startDate);
  if (fallbackYear) return `${fallbackYear}年`;
  return '';
};

const readJson = (filePath, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
};

const loadTournamentIndex = () => {
  const indexPath = path.join(tournamentsRoot, 'index.json');
  const localIndexPath = path.join(tournamentsRoot, 'local_index.json');
  const index = readJson(indexPath, []);
  const localIndex = readJson(localIndexPath, []);
  return [
    ...(Array.isArray(index) ? index : []),
    ...(Array.isArray(localIndex) ? localIndex : []),
  ];
};

const loadInformationMap = () => {
  const informationRoot = path.join(tournamentsRoot, 'information');
  const map = new Map();

  if (!fs.existsSync(informationRoot)) return map;

  const files = fs
    .readdirSync(informationRoot)
    .filter((file) => file.endsWith('.json'));
  for (const file of files) {
    const tournamentId = file.replace(/\.json$/i, '');
    const entries = readJson(path.join(informationRoot, file), []);
    map.set(tournamentId, Array.isArray(entries) ? entries : []);
  }

  return map;
};

const getAllDetailRecords = (tournamentIndex) => {
  const detailsRoot = path.join(tournamentsRoot, 'details');
  const records = [];
  const tournamentMap = new Map();

  for (const entry of tournamentIndex) {
    if (entry?.tournamentId) {
      tournamentMap.set(entry.tournamentId, entry);
    }
  }

  if (!fs.existsSync(detailsRoot)) return records;

  const tournamentDirs = fs
    .readdirSync(detailsRoot)
    .filter((entry) =>
      fs.statSync(path.join(detailsRoot, entry)).isDirectory(),
    );

  for (const tournamentId of tournamentDirs) {
    const tournamentDir = path.join(detailsRoot, tournamentId);
    const yearDirs = fs
      .readdirSync(tournamentDir)
      .filter((entry) =>
        fs.statSync(path.join(tournamentDir, entry)).isDirectory(),
      );

    for (const year of yearDirs) {
      const yearDir = path.join(tournamentDir, year);
      const files = fs
        .readdirSync(yearDir)
        .filter((file) => file.endsWith('.json'));

      for (const fileName of files) {
        const detail = readJson(path.join(yearDir, fileName), null);
        if (!detail) continue;

        records.push({
          tournamentId,
          year,
          fileName,
          detail,
          tournamentName:
            tournamentMap.get(tournamentId)?.label || tournamentId,
        });
      }
    }
  }

  return records;
};

const buildPlayerDirectoryEntries = () => {
  const entries = fs
    .readdirSync(playersRoot)
    .filter((entry) =>
      fs.statSync(path.join(playersRoot, entry)).isDirectory(),
    );

  return entries
    .map((slug) => {
      const information = readJson(
        path.join(playersRoot, slug, 'information.json'),
        null,
      );
      if (!information?.lastName || !information?.firstName) return null;

      return {
        slug,
        lastName: information.lastName,
        firstName: information.firstName,
      };
    })
    .filter(Boolean);
};

const createEmptyAggregate = () => ({
  matches: { total: 0, wins: 0, losses: 0, winRate: 0 },
  games: { total: 0, won: 0, lost: 0, gameRate: 0 },
});

const processMatchAggregate = (aggregate, score, result) => {
  aggregate.matches.total += 1;
  if (result === 'win') {
    aggregate.matches.wins += 1;
  } else if (result === 'lose') {
    aggregate.matches.losses += 1;
  }

  if (!score) return;

  const parts = String(score)
    .split('-')
    .map((value) => Number(value));
  if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
    return;
  }

  aggregate.games.won += parts[0];
  aggregate.games.lost += parts[1];
  aggregate.games.total += parts[0] + parts[1];
};

const normalizeAggregate = (aggregate) => ({
  matches: {
    total: aggregate.matches.total,
    wins: aggregate.matches.wins,
    losses: aggregate.matches.losses,
    winRate: calculateRate(aggregate.matches.wins, aggregate.matches.total),
  },
  games: {
    total: aggregate.games.total,
    won: aggregate.games.won,
    lost: aggregate.games.lost,
    gameRate: calculateRate(aggregate.games.won, aggregate.games.total),
  },
});

const buildAnalysisForPlayer = (
  player,
  playerIndexByName,
  tournamentIndex,
  informationMap,
  detailRecords,
) => {
  const playerMatches = [];
  const playerTournamentsMap = new Map();
  const tournamentFinalResult = new Map();
  const tournamentPartnerCounts = new Map();
  const tournamentMeta = new Map();

  for (const tournament of tournamentIndex) {
    if (tournament?.tournamentId) {
      tournamentMeta.set(tournament.tournamentId, {
        label: tournament.label,
      });
    }
  }

  for (const record of detailRecords) {
    const participants = Array.isArray(record.detail?.participants)
      ? record.detail.participants
      : [];

    const matchingParticipantIds = participants
      .filter(
        (participant) =>
          participant.lastName === player.lastName &&
          participant.firstName === player.firstName,
      )
      .map((participant) => participant.id);

    if (matchingParticipantIds.length === 0) continue;

    const participantById = new Map();
    for (const participant of participants) {
      participantById.set(participant.id, participant);
    }

    const entries = Array.isArray(record.detail?.entries)
      ? record.detail.entries
      : [];

    const matches = Array.isArray(record.detail?.matches)
      ? record.detail.matches
      : [];
    for (const match of matches) {
      if (!Array.isArray(match.entries) || match.entries.length === 0) continue;

      const intersection = match.entries.filter((entryNo) =>
        entries.some(
          (entry) =>
            Array.isArray(entry.playerIds) &&
            entry.playerIds.some((participantId) =>
              matchingParticipantIds.includes(participantId),
            ) &&
            entry.entryNo === entryNo,
        ),
      );

      if (intersection.length === 0) continue;

      const playerEntryNo = intersection[0];
      const opponentEntryNos = match.entries.filter(
        (entryNo) => entryNo !== playerEntryNo,
      );

      let score = '';
      if (match.scores && typeof match.scores === 'object') {
        const playerScore = match.scores[String(playerEntryNo)];
        const opponentScore = match.scores[String(opponentEntryNos[0])];
        if (
          typeof playerScore === 'number' &&
          typeof opponentScore === 'number'
        ) {
          score = `${playerScore}-${opponentScore}`;
        }
      }

      const result =
        typeof match.winnerEntryNo === 'number'
          ? match.winnerEntryNo === playerEntryNo
            ? 'win'
            : 'lose'
          : 'unknown';

      let partnerId = null;
      for (const entry of entries) {
        if (!Array.isArray(entry.playerIds)) continue;
        if (!entry.playerIds.includes(matchingParticipantIds[0])) continue;
        if (entry.playerIds.length <= 1) continue;

        const otherParticipantId = entry.playerIds.find(
          (participantId) => participantId !== matchingParticipantIds[0],
        );
        if (!otherParticipantId) continue;

        const partner = participantById.get(otherParticipantId);
        if (!partner) continue;

        partnerId =
          playerIndexByName.get(`${partner.lastName}\t${partner.firstName}`)
            ?.id ?? null;
      }

      const tournamentKey = `${record.tournamentId}/${record.year}/${record.fileName.replace('.json', '')}`;

      playerMatches.push({
        tournamentId: record.tournamentId,
        year: Number(record.year),
        score,
        result,
        partnerId,
        tournamentKey,
      });

      if (partnerId) {
        if (!tournamentPartnerCounts.has(tournamentKey)) {
          tournamentPartnerCounts.set(tournamentKey, new Map());
        }
        const countMap = tournamentPartnerCounts.get(tournamentKey);
        countMap.set(partnerId, (countMap.get(partnerId) || 0) + 1);
      }
    }

    const results = Array.isArray(record.detail?.results)
      ? record.detail.results
      : [];
    const targetEntryNos = entries
      .filter(
        (entry) =>
          Array.isArray(entry.playerIds) &&
          entry.playerIds.includes(matchingParticipantIds[0]),
      )
      .map((entry) => entry.entryNo);

    for (const result of results) {
      const resultEntryNo =
        typeof result?.entryNo === 'number' ? result.entryNo : undefined;
      const playerIdsField = Array.isArray(result?.playerIds)
        ? result.playerIds
        : undefined;

      let isTarget = false;
      if (
        typeof resultEntryNo === 'number' &&
        targetEntryNos.includes(resultEntryNo)
      ) {
        isTarget = true;
      }
      if (
        !isTarget &&
        Array.isArray(playerIdsField) &&
        playerIdsField.some((participantId) =>
          matchingParticipantIds.includes(participantId),
        )
      ) {
        isTarget = true;
      }
      if (!isTarget) continue;

      let resultField;
      if (result?.tournament && typeof result.tournament === 'object') {
        if (
          typeof result.tournament.label === 'string' &&
          result.tournament.label.trim().length > 0
        ) {
          resultField = result.tournament.label;
        }
      } else if (result?.roundrobin && typeof result.roundrobin === 'object') {
        if (typeof result.roundrobin.rank === 'number') {
          resultField = `予選${result.roundrobin.rank}位`;
        }
      }

      if (!resultField && typeof result?.result === 'string') {
        resultField = result.result;
      }

      const tournamentKey = `${record.tournamentId}/${record.year}/${record.fileName.replace('.json', '')}`;
      tournamentFinalResult.set(tournamentKey, resultField ?? '不明');
    }
  }

  for (const match of playerMatches) {
    if (playerTournamentsMap.has(match.tournamentKey)) continue;

    const [tournamentId, year, category] = match.tournamentKey.split('/');
    const informationEntries = informationMap.get(tournamentId) ?? [];
    const infoForYear = informationEntries.find(
      (entry) => String(entry.year) === String(year),
    );

    let partnerId = null;
    const partnerCounts = tournamentPartnerCounts.get(match.tournamentKey);
    if (partnerCounts) {
      let maxCount = 0;
      for (const [candidatePartnerId, count] of partnerCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          partnerId = candidatePartnerId;
        }
      }
    }

    playerTournamentsMap.set(match.tournamentKey, {
      id: match.tournamentKey,
      tournamentId,
      year: Number(year),
      category,
      tournamentName: tournamentMeta.get(tournamentId)?.label || tournamentId,
      startDate: infoForYear?.startDate ?? null,
      endDate: infoForYear?.endDate ?? null,
      location: infoForYear?.location ?? null,
      link: infoForYear?.sourceUrl ?? null,
      finalResult: tournamentFinalResult.get(match.tournamentKey) ?? null,
      partnerId,
    });
  }

  const overall = createEmptyAggregate();
  const byPartner = {};
  const byYear = {};

  for (const match of playerMatches) {
    processMatchAggregate(overall, match.score, match.result);

    const partnerKey = match.partnerId ?? 'singles';
    if (!byPartner[partnerKey]) {
      byPartner[partnerKey] = createEmptyAggregate();
    }
    processMatchAggregate(byPartner[partnerKey], match.score, match.result);

    const yearKey = String(match.year || 'unknown');
    if (!byYear[yearKey]) {
      byYear[yearKey] = createEmptyAggregate();
    }
    processMatchAggregate(byYear[yearKey], match.score, match.result);
  }

  const sortedTournaments = Array.from(playerTournamentsMap.values()).sort(
    (left, right) => {
      const leftTime =
        parseStartTime(left.startDate) || parseStartTime(String(left.year));
      const rightTime =
        parseStartTime(right.startDate) || parseStartTime(String(right.year));
      if (leftTime !== rightTime) return rightTime - leftTime;
      return String(right.tournamentName || '').localeCompare(
        String(left.tournamentName || ''),
        'ja',
      );
    },
  );

  const latestTournament = sortedTournaments[0] ?? null;

  const analysis = {
    totalMatches: overall.matches.total,
    wins: overall.matches.wins,
    losses: overall.matches.losses,
    totalWinRate: calculateRate(overall.matches.wins, overall.matches.total),
    games: {
      total: overall.games.total,
      won: overall.games.won,
      lost: overall.games.lost,
      gameRate: calculateRate(overall.games.won, overall.games.total),
    },
    byPartner: Object.fromEntries(
      Object.entries(byPartner).map(([key, aggregate]) => [
        key,
        normalizeAggregate(aggregate),
      ]),
    ),
    byYear: Object.fromEntries(
      Object.entries(byYear).map(([key, aggregate]) => [
        key,
        normalizeAggregate(aggregate),
      ]),
    ),
  };

  if (latestTournament) {
    analysis.latestMatch = {
      tournament: latestTournament.tournamentName ?? '',
      date: formatDateRange(
        latestTournament.startDate,
        latestTournament.endDate,
        latestTournament.year,
      ),
      location: latestTournament.location ?? '',
      partner: latestTournament.partnerId ?? undefined,
      result: latestTournament.finalResult ?? '',
      link: latestTournament.link ?? '',
    };
  }

  return analysis;
};

const main = () => {
  const tournamentIndex = loadTournamentIndex();
  const informationMap = loadInformationMap();
  const detailRecords = getAllDetailRecords(tournamentIndex);
  const playersIndex = readJson(path.join(playersRoot, 'index.json'), []);
  const playerIndexByName = new Map();
  for (const player of playersIndex) {
    if (!player?.lastName || !player?.firstName) continue;
    playerIndexByName.set(`${player.lastName}\t${player.firstName}`, player);
  }

  const playerDirectories = buildPlayerDirectoryEntries();
  let generatedCount = 0;

  for (const player of playerDirectories) {
    const analysis = buildAnalysisForPlayer(
      player,
      playerIndexByName,
      tournamentIndex,
      informationMap,
      detailRecords,
    );
    const outputPath = path.join(playersRoot, player.slug, 'analysis.json');
    fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2), 'utf-8');
    generatedCount += 1;
    console.log(`✓ Generated analysis.json for ${player.slug}`);
  }

  console.log(`✓ Player analysis generated for ${generatedCount} players`);
};

main();
