// 希少イベント検知の「ハーネス」: 定義（RARE_EVENT_CONFIG）を変えて再実行し、
// カテゴリ別の候補数・値の分布・動画リンク有無（歩留まり）を確認するためのレポート。
// 併せて postable（動画あり）なイベントの SNS 手動投稿用テンプレ文を出力する。
//
// 使い方:
//   npm run rare-events:report
//   （lib/rareEvents.mjs の RARE_EVENT_CONFIG を編集 → 再実行、で閾値を調整する）
//
// 仕様: docs/wiki/rare-events.md / docs/raw/2026-07-11-rare-event-sns-plan.md
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { buildPostText, buildScopePools, detectRareEvents, RARE_EVENT_CONFIG } from '../lib/rareEvents.mjs';
import { loadAllMatches } from './generate-rare-events.mjs';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');

// 大会表示名（data/tournaments/index.json の label）。無ければ tournamentId のまま。
const buildTournamentLabelMap = () => {
  const map = new Map();
  for (const file of ['index.json', 'local_index.json']) {
    const filePath = path.join(projectRoot, 'data', 'tournaments', file);
    if (!fs.existsSync(filePath)) continue;
    try {
      const entries = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (entry?.tournamentId && entry?.label && !map.has(entry.tournamentId)) {
          map.set(entry.tournamentId, entry.label);
        }
      }
    } catch {
      // 表示名は任意情報のため読めなくても続行
    }
  }
  return map;
};

const distribution = (values) => {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([value, count]) => `${value}×${count}`)
    .join(', ');
};

const main = () => {
  const matches = loadAllMatches();
  if (matches.length === 0) {
    console.log('No beta match data found.');
    return;
  }

  const labelMap = buildTournamentLabelMap();
  const pools = buildScopePools(matches, RARE_EVENT_CONFIG);
  const skipped = matches.filter((m) => !m.tournament_id || m.tournament_year == null).length;

  console.log('=== 希少イベント収穫レポート ===');
  console.log(`対象: ${matches.length}試合（大会紐付けなしのため対象外: ${skipped}試合） / scope=${RARE_EVENT_CONFIG.scope}（${pools.length}プール）`);
  console.log(`config: lib/rareEvents.mjs RARE_EVENT_CONFIG`);
  console.log(JSON.stringify(RARE_EVENT_CONFIG.categories));

  const allPostable = [];
  let totalEvents = 0;

  for (const pool of pools) {
    const { events, stats } = detectRareEvents(pool, RARE_EVENT_CONFIG);
    totalEvents += events.length;

    const header =
      pool.key === 'all-time' ? '記録済み全試合（大会紐付けあり）' : `${labelMap.get(pool.tournamentId) ?? pool.tournamentId} ${pool.year}（${pool.key}）`;
    console.log(`\n--- ${header} ---`);
    console.log(`  試合: ${stats.matchCount} / ポイント: ${stats.pointCount}`);
    console.log(`  [分布] ラリー上位: ${stats.ralliesTop.map((r) => r.rally).join(', ') || 'なし'}`);
    console.log(`  [分布] サービスエース: ${stats.aceCount}件`);
    console.log(`  [分布] デュースゲーム総ポイント: ${distribution(stats.deuceGames.map((d) => d.totalPoints)) || 'なし'}`);
    console.log(`  [分布] 逆転ゲームの最大ビハインド: ${distribution(stats.comebacks.map((c) => c.deficit)) || 'なし'}`);
    console.log(`  [分布] 試合内最長連続ポイント: ${distribution(stats.streaks.map((s) => s.streak)) || 'なし'}`);
    for (const s of stats.suppressed ?? []) {
      console.log(`  [抑制] ${s.kind}: 同値タイ${s.ties}件 > maxTies=${s.maxTies} のため非表示（希少性なしと判定）`);
    }

    if (events.length === 0) {
      console.log('  イベント: 0件（閾値を見直す場合は config を編集して再実行）');
      continue;
    }
    console.log(`  イベント: ${events.length}件`);
    for (const event of events) {
      const video = event.videoUrl ? '📹' : '—';
      const tLabel = labelMap.get(event.tournamentId) ?? event.tournamentId;
      console.log(
        `   ${video} [${event.kind}] ${event.label} | ${event.teamA} vs ${event.teamB}${event.round ? `（${event.round}）` : ''} | ${tLabel} ${event.year}`,
      );
      if (event.postable) allPostable.push({ event, label: tLabel });
    }
  }

  console.log(`\n=== 合計: ${totalEvents}件（うち投稿可能=動画あり: ${allPostable.length}件） ===`);

  if (allPostable.length > 0) {
    console.log('\n=== SNS 手動投稿テンプレ（コピペ用） ===');
    allPostable.forEach(({ event, label }, i) => {
      console.log(`\n----- 投稿候補 ${i + 1} -----`);
      console.log(buildPostText(event, { tournamentLabel: label }));
    });
    console.log('\n※投稿前レビュー必須。実名の扱いは大会結果として公開済みの範囲と同一に保つこと（ADR-003/004）。');
  }
};

main();
