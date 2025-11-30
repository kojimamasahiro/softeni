import fs from 'fs/promises';
import path from 'path';

// node scripts/generate-og-json.mjs

const BASE_DIR = path.join(process.cwd(), 'data', 'tournaments', 'details');

/**
 * Recursively find all JSON files in a directory
 */
async function findJsonFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'og') {
      // Skip 'og' directories
      files.push(...(await findJsonFiles(full)));
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.json')) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Format pair name for doubles (e.g., "鈴木優花・助田日菜子")
 */
function pairName(info) {
  const names = info.map((p) => `${p.lastName}${p.firstName}`);
  return names.join('・');
}

/**
 * Format team name for doubles (e.g., "ＹＫＫ" or "東北高校・宮城高校")
 */
function pairTeam(info) {
  const teams = [...new Set(info.map((p) => p.team))];
  return teams.length === 1 ? teams[0] : teams.join('・');
}

/**
 * Get team name for team competition
 */
function getTeamName(entry) {
  return entry.team || '';
}

/**
 * Get prefecture for team competition
 */
function getTeamPrefecture(entry) {
  return entry.prefecture || '';
}

/**
 * Detect category type (doubles or team) from data structure
 */
function detectCategory(data) {
  const { participants, entries, matches } = data;

  // Check entries structure
  if (entries && entries.length > 0) {
    const e0 = entries[0];
    // Check type field first - team competitions also have playerIds (containing team IDs)
    if (e0.type === 'team') {
      return 'team';
    }
    // For doubles, playerIds will contain individual player IDs
    if (e0.playerIds && e0.type !== 'team') {
      return 'doubles';
    }
  }

  // Check matches structure
  if (matches && matches.length > 0) {
    const m0 = matches[0];
    if (m0.team1 && m0.team2) {
      return 'team';
    }
    if (m0.player1 && m0.player2) {
      return 'doubles';
    }
  }

  return 'doubles';
}

/**
 * Generate OG data from tournament detail JSON
 */
function generateOgData(data) {
  const { participants, entries, matches } = data;
  const category = detectCategory(data);

  const roundOrder = {
    準々決勝: 1,
    準決勝: 2,
    決勝: 3,
  };

  // Filter matches to only include quarterfinals, semifinals, and finals
  const filteredMatches = matches.filter(
    (m) => roundOrder[m.round] !== undefined && roundOrder[m.round] >= 1,
  );

  // Build entries map
  let entriesMap;
  if (category === 'team') {
    // For team competitions, map entryNo to team info from participants
    entriesMap = {};
    for (const e of entries) {
      // Get the first (and usually only) participant for this team entry
      const participant = participants.find((p) => p.id === e.playerIds[0]);
      if (participant) {
        entriesMap[e.entryNo] = {
          team: participant.team || '',
          prefecture: participant.prefecture || '',
        };
      }
    }
  } else {
    // doubles: map entryNo to participant information
    entriesMap = {};
    for (const e of entries) {
      const playerInfo = e.playerIds.map((playerId) =>
        participants.find((p) => p.id === playerId),
      );
      entriesMap[e.entryNo] = playerInfo;
    }
  }

  const topScores = [];
  const bottomScores = [];
  const entryNos = [];

  // Process matches to extract scores and entry numbers
  for (const match of filteredMatches) {
    const [entryNo1, entryNo2] = match.entries;
    const score1 = match.scores[entryNo1.toString()] || 0;
    const score2 = match.scores[entryNo2.toString()] || 0;

    topScores.push(score1.toString());
    bottomScores.push(score2.toString());
    entryNos.push(entryNo1, entryNo2);
  }

  // Get unique entry numbers while preserving order
  const uniqueEntryNos = [...new Set(entryNos)];
  const half = Math.floor(uniqueEntryNos.length / 2);
  const leftEntryNos = uniqueEntryNos.slice(0, half);
  const rightEntryNos = uniqueEntryNos.slice(half);

  // Format entries based on category
  const formatEntry =
    category === 'team'
      ? (no) => ({
          name: entriesMap[no].team, // team name
          team: entriesMap[no].prefecture, // prefecture
        })
      : (no) => ({
          name: pairName(entriesMap[no]),
          team: pairTeam(entriesMap[no]),
        });

  return {
    leftPairs: leftEntryNos.map(formatEntry),
    rightPairs: rightEntryNos.map(formatEntry),
    topScores,
    bottomScores,
  };
}

/**
 * Main function
 */
async function main() {
  try {
    const files = await findJsonFiles(BASE_DIR);
    console.log(`Found ${files.length} JSON files to process`);

    let processed = 0;
    let skipped = 0;

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content);

        // Check if this is a tournament detail file
        if (!data.participants || !data.entries || !data.matches) {
          console.log(
            `⏭️  Skipping ${path.relative(BASE_DIR, filePath)} (not a tournament detail file)`,
          );
          skipped++;
          continue;
        }

        const ogData = generateOgData(data);

        // Create output path: same directory, og subdirectory, same filename
        const dir = path.dirname(filePath);
        const filename = path.basename(filePath);

        // Skip files containing 'team' or 'versus'
        if (filename.includes('team') || filename.includes('versus')) {
          // console.log(`⏭️  Skipping ${path.relative(BASE_DIR, filePath)} (excluded filename)`);
          skipped++;
          continue;
        }

        const ogDir = path.join(dir, 'og');
        const ogPath = path.join(ogDir, filename);

        // Create og directory if it doesn't exist
        await fs.mkdir(ogDir, { recursive: true });

        // Write OG JSON file
        await fs.writeFile(
          ogPath,
          JSON.stringify(ogData, null, 2) + '\n',
          'utf8',
        );

        console.log(`✅ Generated ${path.relative(BASE_DIR, ogPath)}`);
        processed++;
      } catch (err) {
        console.error(
          `❌ Error processing ${path.relative(BASE_DIR, filePath)}:`,
          err.message,
        );
        skipped++;
      }
    }

    console.log(
      `\n📊 Summary: ${processed} files processed, ${skipped} skipped`,
    );
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
