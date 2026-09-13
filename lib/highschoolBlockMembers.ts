// lib/highschoolBlockMembers.ts
//
// 高校の学校ページ「年度別メンバー」に、地区大会（ブロック大会）の出場選手を足すための索引。
//
// 高校カテゴリは地区大会を**成績・ランキング・主な卒業生には統合しない**方針（docs/wiki/highschool.md）で、
// data/highschool/prefectures/*/summary.json にも地区大会は入っていない。
// ただし「メンバー」は順位ではなく出場の事実なので、2026-09-14 にメンバー一覧だけ例外として足した。
// 「◯◯高校 ソフトテニス メンバー」は新チームの時期（地区大会の直後）に最も調べられるが、
// 全国大会だけだとその年のメンバーが載っていないため。
// 実測（2026-09-14）: 361ページ（学校×性別）に延べ1,383名が加わる（うち2026年が1,299名）。
// 155ページは最新年のメンバーが地区大会からしか取れない（全国大会だけだと前年までしか載らなかった）。
// 経緯: docs/raw/2026-09-14-highschool-members-seo.md
//
// 集計パイプライン（scripts/highschool/run-pipeline.sh）を通さず、ビルド時に details を直接読む。
// パイプラインに入れると成績サマリー・分析・ランキングにも地区大会が混ざるため。
//
// fs を使うため getStaticProps からのみ import すること。

import fs from 'fs';
import path from 'path';

/** 地区大会として扱う大会。9地区のブロック大会（`highschool-*-block`）と東海選抜 */
const isBlockTournament = (tournamentId: string) => /^highschool-.+-block$/.test(tournamentId) || tournamentId === 'highschool-tokai-senbatsu';

export interface BlockMember {
  year: number;
  lastName: string;
  firstName: string;
}

/** `学校名\t都道府県\t性別` -> メンバー（年×氏名で重複なし） */
let cache: Map<string, BlockMember[]> | null = null;

function build(): Map<string, BlockMember[]> {
  const index = new Map<string, Map<string, BlockMember>>();
  const detailsRoot = path.join(process.cwd(), 'data', 'tournaments', 'details');
  let tournamentIds: string[] = [];
  try {
    tournamentIds = fs.readdirSync(detailsRoot).filter(isBlockTournament);
  } catch {
    return new Map();
  }

  for (const tid of tournamentIds) {
    const tDir = path.join(detailsRoot, tid);
    for (const year of fs.readdirSync(tDir).filter((y) => /^\d{4}$/.test(y))) {
      for (const file of fs.readdirSync(path.join(tDir, year)).filter((f) => f.endsWith('.json'))) {
        // ファイル名 `category-age-gender.json` の末尾が性別。学校ページは男女別
        const gender = file
          .replace(/\.json$/, '')
          .split('-')
          .pop();
        if (gender !== 'boys' && gender !== 'girls') continue;
        let participants: { lastName?: string | null; firstName?: string | null; team?: string | null; prefecture?: string | null }[] = [];
        try {
          participants = JSON.parse(fs.readFileSync(path.join(tDir, year, file), 'utf-8')).participants ?? [];
        } catch {
          continue;
        }
        for (const p of participants) {
          // 団体戦のチーム単位エントリー（氏名が null）は選手ではないので飛ばす
          if (!p.lastName || !p.firstName || !p.team) continue;
          const key = `${p.team}\t${p.prefecture ?? ''}\t${gender}`;
          const members = index.get(key) ?? new Map<string, BlockMember>();
          members.set(`${year}\t${p.lastName}\t${p.firstName}`, { year: Number(year), lastName: p.lastName, firstName: p.firstName });
          index.set(key, members);
        }
      }
    }
  }

  return new Map([...index.entries()].map(([key, members]) => [key, [...members.values()]]));
}

/**
 * 学校（学校ページの正準名・都道府県名・性別）の地区大会出場選手。
 * 学校名は地区大会の participants[].team と完全一致で引く（表記ゆれは名寄せ側で吸収する前提）。
 */
export function getBlockTournamentMembers(teamName: string, prefectureName: string, gender: 'boys' | 'girls'): BlockMember[] {
  if (!cache) cache = build();
  return cache.get(`${teamName}\t${prefectureName}\t${gender}`) ?? [];
}
