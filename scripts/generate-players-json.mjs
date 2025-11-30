// scripts/generate-players-json.mjs
// ビルド時に複数パターンの選手JSONファイルを生成するスクリプト
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// API Routeのロジックをそのまま移植
const parseCombinedCategory = (raw) => {
  if (!raw) return { gameCategory: '', ageCategory: 'none', gender: 'none' };
  const cleaned = String(raw).replace(/\.json$/i, '');
  const parts = cleaned.split('-');
  if (parts.length >= 3) {
    return {
      gameCategory: parts[0] || '',
      ageCategory: parts[1] || 'none',
      gender: parts[2] || 'none',
    };
  }
  return { gameCategory: cleaned, ageCategory: 'none', gender: 'none' };
};

const makeNameKey = (last, first) => {
  return `${String(last || '')}::${String(first || '')}`;
};

// Tournament data helper functions (lib/tournamentData.tsから移植)
function getAllDetailRecords(cwd) {
  const detailsRoot = path.join(cwd, 'data', 'tournament', 'details');
  const indexPath = path.join(cwd, 'data', 'tournament', 'index.json');

  if (!fs.existsSync(detailsRoot)) {
    return [];
  }

  let tournamentIndex = [];
  if (fs.existsSync(indexPath)) {
    try {
      tournamentIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    } catch {
      tournamentIndex = [];
    }
  }

  const tournamentMap = new Map();
  for (const entry of tournamentIndex) {
    if (entry && entry.tournamentId) {
      tournamentMap.set(entry.tournamentId, entry);
    }
  }

  const records = [];
  const tournamentDirs = fs.readdirSync(detailsRoot);

  for (const tournamentId of tournamentDirs) {
    const tournamentDir = path.join(detailsRoot, tournamentId);
    if (!fs.statSync(tournamentDir).isDirectory()) continue;

    const yearDirs = fs.readdirSync(tournamentDir);
    for (const year of yearDirs) {
      const yearDir = path.join(tournamentDir, year);
      if (!fs.statSync(yearDir).isDirectory()) continue;

      const files = fs.readdirSync(yearDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        const filePath = path.join(yearDir, file);
        try {
          const detail = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          const entry = tournamentMap.get(tournamentId);
          records.push({
            tournamentId,
            year,
            fileName: file,
            detail,
            tournamentName: entry?.label || tournamentId,
            generation: entry?.generationId || 'all',
          });
        } catch (error) {
          console.warn(`Failed to parse ${filePath}:`, error.message);
        }
      }
    }
  }

  return records;
}

function loadInformationMap(cwd) {
  const informationRoot = path.join(cwd, 'data', 'tournament', 'information');
  const map = new Map();

  if (!fs.existsSync(informationRoot)) {
    return map;
  }

  const files = fs.readdirSync(informationRoot).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const tournamentId = file.replace(/\.json$/i, '');
    const filePath = path.join(informationRoot, file);
    try {
      const entries = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      map.set(tournamentId, entries);
    } catch (error) {
      console.warn(`Failed to parse ${filePath}:`, error.message);
    }
  }

  return map;
}

async function generatePlayersData(minMatchCount) {
  console.log(`Generating players data for minMatchCount=${minMatchCount}...`);

  const records = getAllDetailRecords(projectRoot);
  const informationMap = loadInformationMap(projectRoot);

  // Load base player index
  const playersIndexPath = path.join(
    projectRoot,
    'data',
    'players',
    'index.json',
  );
  let playersIndex = [];
  if (fs.existsSync(playersIndexPath)) {
    try {
      playersIndex = JSON.parse(fs.readFileSync(playersIndexPath, 'utf-8'));
    } catch {
      playersIndex = [];
    }
  }

  // Build index map
  const indexMap = new Map();
  for (const p of playersIndex) {
    const key = makeNameKey(p.lastName, p.firstName);
    if (!indexMap.has(key)) indexMap.set(key, []);
    indexMap.get(key).push(p.id);
  }

  const playerMap = new Map();

  for (const r of records) {
    const tournamentId = r.tournamentId;
    const year = r.year;
    const detail = r.detail;
    const categoryInfo = parseCombinedCategory(r.fileName);
    const categoryId = String(r.fileName).replace(/\.json$/i, '');
    let humanLabel = undefined;

    try {
      const infoEntries = informationMap.get(r.tournamentId);
      if (infoEntries && Array.isArray(infoEntries)) {
        const yr = parseInt(year, 10);
        const infoForYear = infoEntries.find((ie) => Number(ie.year) === yr);
        if (infoForYear && Array.isArray(infoForYear.categories)) {
          const cat = infoForYear.categories.find(
            (c) => c.categoryId === categoryId,
          );
          if (cat && cat.label) humanLabel = cat.label;
        }
      }
    } catch {
      humanLabel = undefined;
    }

    const participants = Array.isArray(detail.participants)
      ? detail.participants
      : [];
    const participantById = new Map();
    for (const p of participants) {
      if (p && p.id) participantById.set(String(p.id), p);
    }

    const entries = Array.isArray(detail.entries) ? detail.entries : [];
    const entryByNo = new Map();
    for (const e of entries) {
      entryByNo.set(e.entryNo, e);
    }

    if (detail.results && Array.isArray(detail.results)) {
      for (const res of detail.results) {
        let resultPlayerIds;
        if (typeof res.entryNo === 'number' && entryByNo.has(res.entryNo)) {
          const ent = entryByNo.get(res.entryNo);
          resultPlayerIds = ent?.playerIds;
        }

        if (Array.isArray(resultPlayerIds)) {
          for (const pid of resultPlayerIds) {
            const participant = participantById.get(pid);
            if (!participant?.lastName || !participant?.firstName) continue;
            const nameKey = makeNameKey(
              participant?.lastName || '',
              participant?.firstName || '',
            );
            if (!indexMap.has(nameKey)) continue;

            const playerResult = {
              firstName: participant?.firstName || '',
              lastName: participant?.lastName || '',
              fullName: `${participant?.lastName || ''}${participant?.firstName || ''}`,
              team: participant?.team || '所属不明',
              result: res.tournament?.label || '予選敗退',
              tournamentName: r.tournamentName || '大会名不明',
              tournamentId,
              generation: r.generation || 'all',
              year,
              gameCategory: categoryInfo.gameCategory,
              ageCategory: categoryInfo.ageCategory,
              gender: categoryInfo.gender,
              categoryLabel:
                humanLabel ??
                `${categoryInfo.gameCategory}-${categoryInfo.ageCategory}-${categoryInfo.gender}`,
              playerId: String(indexMap.get(nameKey)[0]),
            };

            if (!playerMap.has(nameKey)) playerMap.set(nameKey, []);
            playerMap.get(nameKey).push(playerResult);
          }
        }
      }
    }
  }

  const sameNameGroups = [];
  for (const [, players] of playerMap.entries()) {
    const fullName = `${players[0].fullName}`;
    const uniquePlayersArray = players.slice();
    const differentTeams = [...new Set(uniquePlayersArray.map((p) => p.team))];
    sameNameGroups.push({
      fullName,
      players: uniquePlayersArray.map((p) => ({
        ...p,
        playerId: p.playerId ?? null,
      })),
      count: uniquePlayersArray.length,
      differentTeams,
      playerId:
        uniquePlayersArray.find((p) => p.playerId)?.playerId ?? undefined,
    });
  }

  // Filter by minMatchCount
  const filteredGroups = sameNameGroups.filter(
    (group) => group.count >= minMatchCount,
  );

  return { sameNameGroups: filteredGroups };
}

async function main() {
  console.log('Starting players JSON generation...');

  // 出力ディレクトリを作成
  const outputDir = path.join(projectRoot, 'public', 'data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 3パターンのJSONファイルを生成
  const patterns = [
    { minMatchCount: 2, filename: 'players-min2.json' },
    { minMatchCount: 10, filename: 'players-min10.json' },
    { minMatchCount: 20, filename: 'players-min20.json' },
  ];

  for (const pattern of patterns) {
    try {
      const data = await generatePlayersData(pattern.minMatchCount);
      const outputPath = path.join(outputDir, pattern.filename);
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(
        `✓ Generated ${pattern.filename} (${data.sameNameGroups.length} groups)`,
      );
    } catch (error) {
      console.error(`✗ Failed to generate ${pattern.filename}:`, error);
      process.exit(1);
    }
  }

  console.log('✓ All players JSON files generated successfully!');
}

main();
