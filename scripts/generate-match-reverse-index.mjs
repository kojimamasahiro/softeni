// 本体ページ（大会・選手）→ 試合詳細 の逆引き表を生成する。
//
// 入力: public/data/beta-matches/index.json（siteLink 付き試合サマリ）
// 出力:
//   public/data/beta-matches/reverse/by-tournament.json
//     tournamentPath -> 試合リンク配列
//   public/data/beta-matches/reverse/by-player.json
//     playerId(number, 文字列キー) -> 試合リンク配列
//
// 掲載大会に紐づく試合（siteLink あり）だけを対象にする。
// 選手 ID 解決は data/players/index.json（count>=5、同姓同名は最初の ID）に従う。
// 仕様: docs/wiki/score-site-link.md
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const betaMatchesRoot = path.join(
  projectRoot,
  'public',
  'data',
  'beta-matches',
);
const reverseRoot = path.join(betaMatchesRoot, 'reverse');
const playersIndexPath = path.join(
  projectRoot,
  'data',
  'players',
  'index.json',
);

const readJsonIfExists = (filePath) => {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
};

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
};

// data/tournaments の playerIndexMap と同じ規約（count>=5、同姓同名は最初の ID）
const buildPlayerIndexMap = () => {
  const map = new Map();
  const playersIndex = readJsonIfExists(playersIndexPath);
  if (!Array.isArray(playersIndex)) return map;

  for (const player of playersIndex) {
    if (!player || (player.count ?? 0) < 5) continue;
    const key = `${player.lastName}::${player.firstName}`;
    if (!map.has(key)) {
      map.set(key, player.id);
    }
  }
  return map;
};

// ラウンドの表示順位（小さいほど決勝に近く、リスト先頭に来る）。
// 決勝 → 準決勝 → 準々決勝 → 6回戦 → 5回戦 → … → 1回戦 → その他
const roundRank = (roundName) => {
  if (!roundName) return 1000;
  if (roundName === '決勝') return 0;
  if (roundName === '準決勝') return 1;
  if (roundName === '準々決勝') return 2;
  const roundMatch = roundName.match(/^(\d+)回戦$/);
  if (roundMatch) {
    // 回戦数が大きいほど決勝に近い（6回戦を5回戦より前に）
    return 100 - Number(roundMatch[1]);
  }
  return 1000;
};

const sortLinksByRound = (links) =>
  links.sort((a, b) => roundRank(a.round) - roundRank(b.round));

const joinPlayerName = (lastName, firstName) => {
  const last = (lastName ?? '').toString().trim();
  const first = (firstName ?? '').toString().trim();
  if (last && first) return `${last} ${first}`;
  return last || first;
};

const buildTeamDisplayName = (match, side) => {
  const p1Last = match[`team_${side}_player1_last_name`];
  if (p1Last) {
    return [
      joinPlayerName(p1Last, match[`team_${side}_player1_first_name`]),
      joinPlayerName(
        match[`team_${side}_player2_last_name`],
        match[`team_${side}_player2_first_name`],
      ),
    ]
      .filter(Boolean)
      .join('・');
  }
  return match[`team_${side}`] ?? '';
};

// 試合に含まれる選手（最大 4 名）を { lastName, firstName } で列挙
const listMatchPlayers = (match) => {
  const players = [];
  for (const side of ['a', 'b']) {
    for (const slot of ['player1', 'player2']) {
      const lastName = match[`team_${side}_${slot}_last_name`];
      const firstName = match[`team_${side}_${slot}_first_name`];
      if (lastName && firstName) {
        players.push({ lastName, firstName });
      }
    }
  }
  return players;
};

const buildReverseIndex = () => {
  const index = readJsonIfExists(path.join(betaMatchesRoot, 'index.json'));
  const matches = Array.isArray(index?.matches) ? index.matches : [];
  const playerIndexMap = buildPlayerIndexMap();

  const byTournament = {};
  const byPlayer = {};

  for (const match of matches) {
    const tournamentPath = match.siteLink?.tournamentPath;
    if (!tournamentPath) continue;

    const detailPath = `${tournamentPath}/matches/${match.id}`;
    const link = {
      matchId: match.id,
      detailPath,
      round: match.round_name ?? null,
      entryNos: match.siteLink?.entryNos ?? [],
      teamA: buildTeamDisplayName(match, 'a'),
      teamB: buildTeamDisplayName(match, 'b'),
    };

    (byTournament[tournamentPath] ??= []).push(link);

    const seenPlayerIds = new Set();
    for (const player of listMatchPlayers(match)) {
      const playerId = playerIndexMap.get(
        `${player.lastName}::${player.firstName}`,
      );
      if (playerId === undefined) continue;
      if (seenPlayerIds.has(playerId)) continue;
      seenPlayerIds.add(playerId);

      (byPlayer[String(playerId)] ??= []).push(link);
    }
  }

  // ラウンド順（決勝→準決勝→準々決勝→…）に並べ替える
  Object.values(byTournament).forEach(sortLinksByRound);
  Object.values(byPlayer).forEach(sortLinksByRound);

  return { byTournament, byPlayer };
};

const main = () => {
  console.log('Starting match reverse index generation...');

  if (!fs.existsSync(path.join(betaMatchesRoot, 'index.json'))) {
    console.warn('beta-matches index.json not found. Skipping reverse index.');
    return;
  }

  const { byTournament, byPlayer } = buildReverseIndex();
  const generatedAt = new Date().toISOString();

  fs.mkdirSync(reverseRoot, { recursive: true });
  writeJson(path.join(reverseRoot, 'by-tournament.json'), {
    generatedAt,
    tournaments: byTournament,
  });
  writeJson(path.join(reverseRoot, 'by-player.json'), {
    generatedAt,
    players: byPlayer,
  });

  console.log(
    `✓ Generated match reverse index (${Object.keys(byTournament).length} tournaments, ${Object.keys(byPlayer).length} players)`,
  );
};

main();
