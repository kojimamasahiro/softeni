// scripts/fix-kawasaki-kohei-supabase-name.mjs
//
// 一回限りのデータ修正スクリプト（2026-08-14）。
//
// 背景: 川﨑康平選手（都城商業高校→日本体育大学）が、大会結果データ側では
// 表記揺れ（「崎」/「﨑」）により id=9(川﨑) と id=119(川崎) の2人に分裂していた。
// data/tournaments/details/** と data/players/index.json は既に「川﨑」に統一済み
// （2026-08-14 対応）。
//
// しかし matches 機能（記録試合、Supabase の matches/points/match_point_candidates
// テーブル）は選手名を平文で保存しており、上記の修正とは完全に独立している。
// このスクリプトは Supabase 側に残る「川崎康平」表記を「川﨑康平」に統一する。
//
// 使い方:
//   node scripts/fix-kawasaki-kohei-supabase-name.mjs           # dry-run（差分を表示するだけ）
//   node scripts/fix-kawasaki-kohei-supabase-name.mjs --apply   # 実際に UPDATE を実行
//
// 環境変数（.env.local から自動ロード）: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY
// テスト用DBに向けたい場合は --test を付ける（NEXT_PUBLIC_SUPABASE_TEST_URL / SUPABASE_TEST_SERVICE_KEY）。
//
// 冪等: 既に「川﨑」になっている行は対象から自然に外れるので、何度実行しても安全。

import path from 'path';
import { fileURLToPath } from 'url';

import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const { loadEnvConfig } = nextEnv;

loadEnvConfig(projectRoot);

const OLD_LAST = '川崎';
const NEW_LAST = '川﨑';
const FIRST = '康平';
const OLD_FULL = `${OLD_LAST}${FIRST}`; // 川崎康平
const NEW_FULL = `${NEW_LAST}${FIRST}`; // 川﨑康平

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const USE_TEST = args.includes('--test');

function getSupabaseConfig() {
  const url = USE_TEST ? process.env.NEXT_PUBLIC_SUPABASE_TEST_URL : (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL);
  const serviceKey = USE_TEST ? process.env.SUPABASE_TEST_SERVICE_KEY : process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      `Supabase 環境変数が見つかりません（${USE_TEST ? 'テスト用' : '本番用'}）。.env.local を確認してください。`,
    );
  }
  return { url, serviceKey };
}

function log(msg) {
  console.log(`[fix-kawasaki-kohei] ${msg}`);
}

// --- matches テーブル -------------------------------------------------

const FLAT_SLOTS = [
  ['team_a_player1_last_name', 'team_a_player1_first_name'],
  ['team_a_player2_last_name', 'team_a_player2_first_name'],
  ['team_b_player1_last_name', 'team_b_player1_first_name'],
  ['team_b_player2_last_name', 'team_b_player2_first_name'],
];

function fixPlayersArray(players) {
  if (!Array.isArray(players)) return { changed: false, players };
  let changed = false;
  const next = players.map((p) => {
    if (p && p.last_name === OLD_LAST && p.first_name === FIRST) {
      changed = true;
      return { ...p, last_name: NEW_LAST };
    }
    return p;
  });
  return { changed, players: next };
}

function planMatchUpdate(row) {
  const update = {};
  let changed = false;

  // 1) フラット列（team_a/b × player1/2 の姓・名ペア）
  for (const [lastKey, firstKey] of FLAT_SLOTS) {
    if (row[lastKey] === OLD_LAST && row[firstKey] === FIRST) {
      update[lastKey] = NEW_LAST;
      changed = true;
    }
  }

  // 2) teams JSON 列（{ A: { players: [...] }, B: { players: [...] } }）
  if (row.teams && typeof row.teams === 'object') {
    const nextTeams = { ...row.teams };
    let teamsChanged = false;
    for (const side of ['A', 'B']) {
      if (nextTeams[side] && Array.isArray(nextTeams[side].players)) {
        const { changed: sideChanged, players } = fixPlayersArray(nextTeams[side].players);
        if (sideChanged) {
          nextTeams[side] = { ...nextTeams[side], players };
          teamsChanged = true;
        }
      }
    }
    if (teamsChanged) {
      update.teams = nextTeams;
      changed = true;
    }
  }

  // 3) team_a / team_b 表示用文字列（後方互換の平文フィールド）
  for (const key of ['team_a', 'team_b']) {
    const val = row[key];
    if (typeof val === 'string' && val.includes(OLD_FULL)) {
      update[key] = val.split(OLD_FULL).join(NEW_FULL);
      changed = true;
    }
  }

  return changed ? update : null;
}

async function fixMatches(supabase) {
  // team_a / team_b の表示文字列、またはフラット列のいずれかで
  // このプレイヤーを含む可能性がある行を広めに取得し、JS側で厳密に判定する。
  const orParts = [
    `team_a.ilike.%${OLD_FULL}%`,
    `team_b.ilike.%${OLD_FULL}%`,
    ...FLAT_SLOTS.flatMap(([lastKey]) => [`${lastKey}.eq.${OLD_LAST}`]),
  ];

  const { data, error } = await supabase.from('matches').select('*').or(orParts.join(','));
  if (error) throw error;

  const rows = data ?? [];
  const plans = [];
  for (const row of rows) {
    const update = planMatchUpdate(row);
    if (update) plans.push({ row, update });
  }

  log(`matches: 候補 ${rows.length} 件中、修正対象 ${plans.length} 件`);
  for (const { row, update } of plans) {
    console.log(`  - id=${row.id} (${row.tournament_name ?? row.tournament_id ?? 'unknown'}, ${row.match_date ?? row.created_at})`);
    console.log(`    update: ${JSON.stringify(update)}`);
  }

  if (APPLY) {
    for (const { row, update } of plans) {
      const { error: updateError } = await supabase.from('matches').update(update).eq('id', row.id);
      if (updateError) throw updateError;
    }
    log(`matches: ${plans.length} 件を更新しました`);
  }

  return plans.length;
}

// --- points / match_point_candidates（自由記述の選手名列） -------------

// Postgrest の「列が存在しない」エラー（42703）メッセージから列名を抜き出す。
// 例: 'column match_point_candidates.serving_player does not exist'
function extractMissingColumn(error) {
  const m = /column\s+(?:"?[\w.]+"?\.)?"?(\w+)"?\s+does not exist/i.exec(error?.message ?? '');
  return m ? m[1] : null;
}

async function fixNameColumnsTable(supabase, table) {
  let cols = ['serving_player', 'winner_player', 'loser_player'];

  // テーブルによって実列が異なる場合がある（例: match_point_candidates に
  // serving_player が存在しない本番スキーマだった実績あり）。存在しない列は
  // エラーメッセージから検出して外し、再試行する。
  let data;
  for (;;) {
    if (cols.length === 0) {
      log(`${table}: 対象列が見つからないためスキップします`);
      return 0;
    }
    const orParts = cols.map((c) => `${c}.ilike.%${OLD_FULL}%`);
    const result = await supabase.from(table).select('*').or(orParts.join(','));
    if (!result.error) {
      data = result.data;
      break;
    }
    const missingCol = extractMissingColumn(result.error);
    if (missingCol && cols.includes(missingCol)) {
      log(`${table}: 列 ${missingCol} は存在しないため対象から外します`);
      cols = cols.filter((c) => c !== missingCol);
      continue;
    }
    throw result.error;
  }

  const rows = data ?? [];
  const plans = [];
  for (const row of rows) {
    const update = {};
    let changed = false;
    for (const col of cols) {
      const val = row[col];
      if (typeof val === 'string' && val.includes(OLD_FULL)) {
        update[col] = val.split(OLD_FULL).join(NEW_FULL);
        changed = true;
      }
    }
    if (changed) plans.push({ row, update });
  }

  log(`${table}: 候補 ${rows.length} 件中、修正対象 ${plans.length} 件`);
  for (const { row, update } of plans) {
    console.log(`  - id=${row.id} (game_id/session_id=${row.game_id ?? row.session_id ?? 'n/a'})`);
    console.log(`    update: ${JSON.stringify(update)}`);
  }

  if (APPLY) {
    for (const { row, update } of plans) {
      const { error: updateError } = await supabase.from(table).update(update).eq('id', row.id);
      if (updateError) throw updateError;
    }
    log(`${table}: ${plans.length} 件を更新しました`);
  }

  return plans.length;
}

async function main() {
  const { url, serviceKey } = getSupabaseConfig();
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  log(`対象DB: ${USE_TEST ? 'テスト用' : '本番'} (${url})`);
  log(APPLY ? '実行モード: --apply（実際に更新します）' : '実行モード: dry-run（差分表示のみ。実行するには --apply を付けてください）');

  const matchesCount = await fixMatches(supabase);
  const pointsCount = await fixNameColumnsTable(supabase, 'points');
  const candidatesCount = await fixNameColumnsTable(supabase, 'match_point_candidates');

  const total = matchesCount + pointsCount + candidatesCount;
  log(`合計 ${total} 件${APPLY ? 'を更新しました' : 'が対象です（--apply で実行）'}`);
}

main().catch((error) => {
  console.error('[fix-kawasaki-kohei] failed:', error);
  process.exitCode = 1;
});
