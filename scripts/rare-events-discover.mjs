// 希少パターン「発見」レポート。
// 決め打ちカテゴリの大小比較（rare-events-report.mjs）と違い、特徴量の組み合わせから
// 新しい希少パターンを探索する。「条件を複雑にしただけ」の組み合わせは
// 独立仮定の期待件数で判別して分離する（lib/rareEventDiscovery.mjs 参照）。
//
// 使い方:
//   npm run rare-events:discover
//   （lib/rareEventDiscovery.mjs の DISCOVERY_CONFIG ＝複雑さ許容ノブを編集 → 再実行）
//
// 発見候補を人がレビューし、名場面として妥当なら lib/rareEvents.mjs の
// RARE_EVENT_CONFIG.patterns に {id, label, conditions} で昇格する（サイト表示に乗る）。
import { discoverRarePatterns, describeAtoms, DISCOVERY_CONFIG, maxLiftFor } from '../lib/rareEventDiscovery.mjs';
import { buildTeamDisplayName } from '../lib/rareEvents.mjs';
import { loadAllMatches } from './generate-rare-events.mjs';

const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

const printExamples = (stat) => {
  for (const { match, game, point } of stat.examples) {
    const teams = `${buildTeamDisplayName(match, 'a')} vs ${buildTeamDisplayName(match, 'b')}`;
    const where = `${match.tournament_name ?? match.tournament_id} 第${game.game_number}G #${point.point_number}`;
    const video =
      match.youtube_video_id && point.video_start_ms != null
        ? ` 📹 https://www.youtube.com/watch?v=${match.youtube_video_id}&t=${Math.floor(point.video_start_ms / 1000)}s`
        : '';
    console.log(`      例: ${teams}（${where}）${video}`);
  }
};

const printStat = (stat, index) => {
  console.log(`\n  ${index}. ${describeAtoms(stat.atoms)}`);
  console.log(
    `     実測 ${stat.count}件 / 期待 ${fmt(stat.expected)}件（独立仮定・分母${stat.universe}pt） lift=${fmt(stat.lift)}（許容≤${fmt(stat.maxLiftAllowed)}）`,
  );
  if (stat.subPatterns?.length) {
    const explained = stat.subPatterns.filter((s) => s.lift <= 1);
    if (explained.length > 0) {
      console.log(`     ⚠ サブパターンも低lift: ${explained.map((s) => `${s.key}（lift=${fmt(s.lift)}）`).join(' / ')} → サブで説明できる可能性`);
    }
  }
  printExamples(stat);
};

const main = () => {
  const matches = loadAllMatches();
  if (matches.length === 0) {
    console.log('No beta match data found.');
    return;
  }

  const result = discoverRarePatterns(matches, DISCOVERY_CONFIG);

  console.log('=== 希少パターン発見レポート ===');
  console.log(`対象: ${matches.length}試合 / ${result.totalPoints}ポイント`);
  console.log(
    `ノブ: maxConditions=${DISCOVERY_CONFIG.maxConditions}, maxCount=${DISCOVERY_CONFIG.maxCount}, minExpectedCount=${DISCOVERY_CONFIG.minExpectedCount}, maxLift(2条件)=${DISCOVERY_CONFIG.maxLift}, 3条件=${fmt(maxLiftFor(3))}`,
  );
  console.log('（lib/rareEventDiscovery.mjs の DISCOVERY_CONFIG を編集して再実行 → 複雑さの許容度を調整）');

  console.log(`\n--- ① 1条件で既に希少なもの（ベースライン: ${DISCOVERY_CONFIG.maxCount}件以下） ---`);
  if (result.singles.length === 0) console.log('  なし');
  for (const s of result.singles) {
    console.log(`  ${s.atom}: ${s.count}件 / ${s.universe}pt（${(s.rate * 100).toFixed(2)}%）`);
  }

  console.log(`\n--- ② 発見候補（希少 かつ 期待≥${DISCOVERY_CONFIG.minExpectedCount}件なのに起きていない＝条件が反相関、サブパターンに還元できないもの） ---`);
  console.log(`  ${result.candidateTotal}件中 上位${result.candidates.length}件を表示`);
  if (result.candidates.length === 0) console.log('  なし（ノブを緩めて再実行）');
  result.candidates.forEach((stat, i) => printStat(stat, i + 1));

  console.log(`\n--- ②' サブパターンに還元できる候補（条件を1つ足しただけの可能性大） ---`);
  console.log(`  ${result.reducibleTotal}件（参考に先頭${Math.min(3, result.reducible.length)}件のみ表示）`);
  result.reducible.slice(0, 3).forEach((stat, i) => {
    console.log(
      `  ${i + 1}. ${describeAtoms(stat.atoms)} — 実測${stat.count}件 lift=${fmt(stat.lift)} → 還元先: ${stat.reducibleTo.map((s) => s.key).join(' / ')}`,
    );
  });

  console.log(`\n--- ③ 「条件を複雑にしただけ」（希少だが期待件数も小さい＝各条件の掛け算で説明可能） ---`);
  console.log(`  ${result.justComplexTotal}件（発見としては扱わない。参考に先頭${Math.min(5, result.justComplex.length)}件のみ表示）`);
  result.justComplex.slice(0, 5).forEach((stat, i) => {
    console.log(`  ${i + 1}. ${describeAtoms(stat.atoms)} — 実測${stat.count}件 / 期待${fmt(stat.expected)}件 lift=${fmt(stat.lift)}`);
  });

  console.log('\n※ 多重比較の偶然当たりが混ざるため、②は必ず人がレビューすること。');
  console.log('※ 妥当と判断したら lib/rareEvents.mjs の RARE_EVENT_CONFIG.patterns に昇格（サイト表示・投稿テンプレに乗る）。');
  console.log('※ 前衛/後衛ロール・shot_type/shot_course は現行データ未収録。記録され始めると自動で探索対象に加わる。');
};

main();
