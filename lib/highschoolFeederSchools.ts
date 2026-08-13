// lib/highschoolFeederSchools.ts
//
// 「この高校の選手はどの中学から来ているか」の逆引き。
// 中学カテゴリの進路データ（data/secondaryschool/pathways.json）を高校名で引き直したもの。
// 生成は scripts/build-secondaryschool-pathways.mjs、採用条件もそちらのヘッダに書いてある。
//
// **中学と高校の両方を名寄せ済みで持っているサイトにしか作れない情報**で、
// 新規URLを増やさずに既存の高校学校ページを厚くする施策（seo.md #2 の「内部リンク集約」と同型）。
//
// 実測（2026-08-12・採用条件の緩和後）: 逆引きが付くのは111グループ（高校×性別）。
// 進路346件・中学112チーム。複数の中学から集めている高校は41校。
// 上位は系列校の内部進学（昇陽→昇陽が12件など）が占める。
//
// fs を使うため getStaticProps からのみ import すること。

import fs from 'fs';
import path from 'path';

export interface FeederSchool {
  /** 出身中学のチーム名 */
  team: string;
  prefecture: string | null;
  /** その中学のページ（掲載閾値を満たす中学のみ存在する）。無ければ null */
  href: string | null;
  /** その中学から来た選手（高校の初出場年が新しい順） */
  players: { name: string; jhsLastYear: number; highschoolFirstYear: number }[];
}

interface PathwayRecord {
  player: string;
  jhsLastYear: number;
  highschool: string;
  highschoolPrefecture: string | null;
  highschoolFirstYear: number;
  highschoolGender: 'boys' | 'girls' | null;
}

/** `高校名\t都道府県` -> 出身中学 */
let cache: Map<string, FeederSchool[]> | null = null;

function build(): Map<string, FeederSchool[]> {
  const root = process.cwd();
  let pathways: Record<string, PathwayRecord[]> = {};
  let teams: { name: string; prefecture: string; prefectureId: string; id: string }[] = [];
  try {
    pathways = JSON.parse(fs.readFileSync(path.join(root, 'data', 'secondaryschool', 'pathways.json'), 'utf-8')).pathways ?? {};
  } catch {
    pathways = {};
  }
  try {
    teams = JSON.parse(fs.readFileSync(path.join(root, 'data', 'secondaryschool', 'index.json'), 'utf-8')).teams ?? [];
  } catch {
    teams = [];
  }
  // 中学チームページの実在確認（デッドリンク防止）。掲載閾値未満の中学はページが無い
  const hrefByTeam = new Map(teams.map((t) => [`${t.name}\t${t.prefecture}`, `/secondaryschool/${t.prefectureId}/${t.id}/`]));

  const out = new Map<string, Map<string, FeederSchool>>();
  for (const [jhsKey, records] of Object.entries(pathways)) {
    const [jhsName, jhsPref] = jhsKey.split('\t');
    for (const r of records) {
      // 性別ごとにキーを分ける。mixed（gender=null）は男女どちらのページにも出す
      const genders: ('boys' | 'girls')[] = r.highschoolGender ? [r.highschoolGender] : ['boys', 'girls'];
      for (const g of genders) {
        const hsKey = `${r.highschool}\t${r.highschoolPrefecture ?? ''}\t${g}`;
        const byJhs = out.get(hsKey) ?? new Map<string, FeederSchool>();
        const entry = byJhs.get(jhsKey) ?? {
          team: jhsName,
          prefecture: jhsPref || null,
          href: hrefByTeam.get(jhsKey) ?? null,
          players: [],
        };
        entry.players.push({ name: r.player, jhsLastYear: r.jhsLastYear, highschoolFirstYear: r.highschoolFirstYear });
        byJhs.set(jhsKey, entry);
        out.set(hsKey, byJhs);
      }
    }
  }

  const result = new Map<string, FeederSchool[]>();
  for (const [hsKey, byJhs] of out) {
    const list = [...byJhs.values()];
    for (const e of list) e.players.sort((a, b) => b.highschoolFirstYear - a.highschoolFirstYear || a.name.localeCompare(b.name, 'ja'));
    // 人数の多い中学が先。同数なら新しい進学が先
    list.sort(
      (a, b) =>
        b.players.length - a.players.length || b.players[0].highschoolFirstYear - a.players[0].highschoolFirstYear || a.team.localeCompare(b.team, 'ja'),
    );
    result.set(hsKey, list);
  }
  return result;
}

/**
 * 高校の学校ページに出す「出身中学」。
 * `gender` は `/highschool/[gender]/...` のセグメント（`boys` / `girls`）。
 */
export function getFeederSchools(highschoolName: string, prefecture: string | null, gender: string): FeederSchool[] {
  if (!cache) cache = build();
  return cache.get(`${highschoolName}\t${prefecture ?? ''}\t${gender}`) ?? [];
}
