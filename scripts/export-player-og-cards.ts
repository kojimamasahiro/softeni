// scripts/export-player-og-cards.ts
// 選手結果ページの OG 画像（tools/sns-images/player_og.py）の入力を書き出す。
//
// 画像生成は Python（Pillow）だが、全国優勝の判定と通算成績は TS の Player Statistics Engine が正なので、
// 描く内容はここで確定させて JSON で渡す（判定を二重に持たない）。
// 対象は全国大会優勝者だけ（2026-09-22 ユーザー判断「選手ページから」。1枚約40KBで、
// index 対象の全選手に作ると約70MBを git に積むため、まず優勝者に絞る）。
//
// 実行: npm run og:players:export  →  .playerstats/og-cards.json（git 管理外）

import fs from 'fs';
import path from 'path';

import { groupNationalTitles } from '../lib/nationalTitles';
import { getPlayerStatistics } from '../lib/playerStats/playerStatistics';

type IndexEntry = { id: number; lastName: string; firstName: string; count?: number };

(async () => {
  const root = process.cwd();
  const index = JSON.parse(fs.readFileSync(path.join(root, 'data', 'players', 'index.json'), 'utf8')) as IndexEntry[];
  const cards = [];
  for (const p of index) {
    if ((p.count ?? 0) < 5) continue; // 結果ページが生成される選手だけ（results.tsx の getStaticPaths と同じ条件）
    const st = await getPlayerStatistics(p.id, { sections: ['titles', 'career'] }, root);
    const national = st.titles?.national?.titles ?? [];
    if (national.length === 0) continue;
    const overall = st.career?.overall?.matches;
    cards.push({
      id: p.id,
      name: `${p.lastName}${p.firstName}`,
      team: st.identity?.currentTeam ?? null,
      titleCount: national.length,
      titles: groupNationalTitles(national).map((g) => ({ label: g.badgeLabel, years: g.years })),
      matches: overall ? { total: overall.total, wins: overall.wins, losses: overall.losses } : null,
    });
  }
  const out = path.join(root, '.playerstats', 'og-cards.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(cards, null, 1));
  console.log(`${cards.length} 人ぶんを ${path.relative(root, out)} に書き出しました`);
})();
