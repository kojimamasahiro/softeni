// scripts/playerStats/verify-facade.ts
// P4 受け入れ基準: 1 呼び出しで全セクションが返る / sections 指定で計算が減る /
// 同一プロセス反復でファイル再読しない（memo が効く）。
// 実行: ts-node --project scripts/playerStats/tsconfig.json scripts/playerStats/verify-facade.ts

import {
  __resetEngineCache,
  getPlayerStatistics,
  toPlayerJsonLd,
  toPlayerMeta,
} from '../../lib/playerStats/playerStatistics';

async function main(): Promise<void> {
  const root = process.cwd();
  let failed = 0;
  const check = (name: string, cond: boolean, extra = '') => {
    console.log(`  ${cond ? '✓' : '✗'} ${name}${extra ? ` | ${extra}` : ''}`);
    if (!cond) failed += 1;
  };

  __resetEngineCache();

  // 1 呼び出しで全セクション
  const full = await getPlayerStatistics(19, {}, root); // 上松俊貴
  check('全セクションが返る（1呼び出し）', full.career.overall.matches.total > 0 && full.titles.total > 0 && full.byYear.length > 0 && full.headToHead.length > 0);
  check('coverage/meta が埋まる', !!full.coverage.firstDate && !!full.meta.sourceHash);

  const meta = toPlayerMeta(full);
  check('toPlayerMeta: title/description が実データ由来', meta.title.includes('上松俊貴') && meta.description.includes('通算'), meta.title);
  const jsonLd = toPlayerJsonLd(full) as { dateCreated?: string; dateModified?: string };
  check('toPlayerJsonLd: 日付が coverage 由来（ビルド日不使用）', jsonLd.dateCreated === full.coverage.firstDate && jsonLd.dateModified === full.coverage.lastDate);

  // sections 指定で計算が減る（titles のみ → byYear/H2H は空）
  const only = await getPlayerStatistics(19, { sections: ['titles'] }, root);
  check('sections=titles で titles は計算、他は既定空', only.titles.total > 0 && only.headToHead.length === 0 && only.byTournament.length === 0);

  // discipline フィルタ
  const dubs = await getPlayerStatistics(19, { discipline: 'doubles' }, root);
  check('discipline=doubles で doubles のみ集計', Object.keys(dubs.career.byDiscipline).every((k) => k === 'doubles'));

  // 同一プロセス反復で facts memo（2回目が速い・同一参照）
  __resetEngineCache();
  const t0 = Date.now();
  await getPlayerStatistics(19, {}, root);
  const first = Date.now() - t0;
  const t1 = Date.now();
  const again = await getPlayerStatistics(19, {}, root);
  const second = Date.now() - t1;
  check('同一プロセス反復で memo が効く（2回目が高速）', second <= first, `1st=${first}ms 2nd=${second}ms`);
  check('stats キャッシュが同一オブジェクトを返す', again === (await getPlayerStatistics(19, {}, root)));

  console.log(`\n  facade checks: ${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}`);
  if (failed > 0) process.exitCode = 1;
}

main();
