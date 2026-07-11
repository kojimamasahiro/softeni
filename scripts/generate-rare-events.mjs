// 希少ポイント/ゲームイベントの公開 JSON を生成する（prebuild）。
//
// 入力: public/data/beta-matches/matches/*.json（フルの試合データ）
// 出力: public/data/beta-matches/rare-events.json
//   { generatedAt, config, events: RareEvent[], byMatch: { [matchId]: RareEvent[] } }
//
// 検知ロジック・定義は lib/rareEvents.mjs（RARE_EVENT_CONFIG）に集約。
// 閾値調整（ハーネス）は scripts/rare-events-report.mjs を使う。
// 仕様: docs/wiki/rare-events.md
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { detectAllRareEvents, RARE_EVENT_CONFIG } from '../lib/rareEvents.mjs';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');
const matchesDir = path.join(projectRoot, 'public', 'data', 'beta-matches', 'matches');
const outputPath = path.join(projectRoot, 'public', 'data', 'beta-matches', 'rare-events.json');

export const loadAllMatches = () => {
  if (!fs.existsSync(matchesDir)) return [];
  const matches = [];
  for (const file of fs.readdirSync(matchesDir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(matchesDir, file), 'utf8'));
      if (data?.match) matches.push(data.match);
    } catch {
      console.warn(`  ! skipped unreadable match file: ${file}`);
    }
  }
  return matches;
};

const main = () => {
  console.log('Starting rare events generation...');

  const matches = loadAllMatches();
  if (matches.length === 0) {
    console.warn('No beta match data found. Skipping rare events generation.');
    return;
  }

  const { events, pools } = detectAllRareEvents(matches, RARE_EVENT_CONFIG);

  const byMatch = {};
  for (const event of events) {
    (byMatch[event.matchId] ??= []).push(event);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        config: RARE_EVENT_CONFIG,
        events,
        byMatch,
      },
      null,
      2,
    ),
  );

  const postable = events.filter((e) => e.postable).length;
  console.log(
    `✓ Generated rare events (scope=${RARE_EVENT_CONFIG.scope}, ${pools.length} pool(s), ${events.length} events, ${postable} postable) -> ${path.relative(projectRoot, outputPath)}`,
  );
};

// レポートスクリプトから loadAllMatches を再利用できるよう、直接実行時のみ main を動かす
if (process.argv[1] === __filename) {
  main();
}
