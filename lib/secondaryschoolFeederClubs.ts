// lib/secondaryschoolFeederClubs.ts
//
// 「この中学の選手はどの小学生クラブから来ているか」の逆引き。
// 小学生カテゴリの進路データ（data/primaryschool/pathways.json）を中学名で引き直したもの。
// 生成は scripts/build-primaryschool-pathways.mjs、採用条件もそちらのヘッダに書いてある。
//
// 位置づけは lib/highschoolFeederSchools.ts（高校ページ→出身中学）の1段下。
// これが入ると **小 → 中 → 高の3段接続**が当サイトで初めて成立する。
// 新規URLを増やさずに既存の中学チームページを厚くする施策。
//
// 高校版と違い**性別で分けない**。中学のチームページは男女を1枚にまとめているため
// （高校の学校ページは `/highschool/[gender]/...` と男女別なので、あちらは出し分けが要る）。
//
// 掲載閾値によるフィルタは生成側でしていない。閾値5で絞るとレコードの19%・
// 節が付く中学チームの35枚が落ちるため（2026-09-13 実測）。リンクの有無だけをここで出し分ける。
//
// fs を使うため getStaticProps からのみ import すること。

import fs from 'fs';
import path from 'path';

export interface FeederClub {
  /** 出身の小学生クラブ名 */
  team: string;
  prefecture: string | null;
  /**
   * そのクラブのページ。小学生カテゴリのチームページ（Step 2）が入るまでは常に null。
   * data/primaryschool/index.json が生成されるようになったら自動でリンクが付く。
   */
  href: string | null;
  /** そのクラブから来た選手（中学の初出場年が新しい順） */
  players: { name: string; primaryLastYear: number; secondaryschoolFirstYear: number }[];
}

interface PathwayRecord {
  player: string;
  primaryLastYear: number;
  secondaryschool: string;
  secondaryschoolPrefecture: string | null;
  secondaryschoolFirstYear: number;
}

/** `中学名\t都道府県` -> 出身の小学生クラブ */
let cache: Map<string, FeederClub[]> | null = null;

function build(): Map<string, FeederClub[]> {
  const root = process.cwd();
  let pathways: Record<string, PathwayRecord[]> = {};
  try {
    pathways = JSON.parse(fs.readFileSync(path.join(root, 'data', 'primaryschool', 'pathways.json'), 'utf-8')).pathways ?? {};
  } catch {
    pathways = {};
  }
  // 小学生クラブのページ実在確認（デッドリンク防止）。Step 2 まで index.json は存在しない
  let clubs: { name: string; prefecture: string; prefectureId: string; id: string }[] = [];
  try {
    clubs = JSON.parse(fs.readFileSync(path.join(root, 'data', 'primaryschool', 'index.json'), 'utf-8')).teams ?? [];
  } catch {
    clubs = [];
  }
  const hrefByClub = new Map(clubs.map((c) => [`${c.name}\t${c.prefecture}`, `/primaryschool/${c.prefectureId}/${c.id}/`]));

  const out = new Map<string, Map<string, FeederClub>>();
  for (const [clubKey, records] of Object.entries(pathways)) {
    const [clubName, clubPref] = clubKey.split('\t');
    for (const r of records) {
      const jhsKey = `${r.secondaryschool}\t${r.secondaryschoolPrefecture ?? ''}`;
      const byClub = out.get(jhsKey) ?? new Map<string, FeederClub>();
      const entry = byClub.get(clubKey) ?? {
        team: clubName,
        prefecture: clubPref || null,
        href: hrefByClub.get(clubKey) ?? null,
        players: [],
      };
      entry.players.push({
        name: r.player,
        primaryLastYear: r.primaryLastYear,
        secondaryschoolFirstYear: r.secondaryschoolFirstYear,
      });
      byClub.set(clubKey, entry);
      out.set(jhsKey, byClub);
    }
  }

  const result = new Map<string, FeederClub[]>();
  for (const [jhsKey, byClub] of out) {
    const list = [...byClub.values()];
    for (const e of list) e.players.sort((a, b) => b.secondaryschoolFirstYear - a.secondaryschoolFirstYear || a.name.localeCompare(b.name, 'ja'));
    // 人数の多いクラブが先。同数なら新しい進学が先
    list.sort(
      (a, b) =>
        b.players.length - a.players.length ||
        b.players[0].secondaryschoolFirstYear - a.players[0].secondaryschoolFirstYear ||
        a.team.localeCompare(b.team, 'ja'),
    );
    result.set(jhsKey, list);
  }
  return result;
}

/** 中学のチームページに出す「出身クラブ」。 */
export function getFeederClubs(secondaryschoolName: string, prefecture: string | null): FeederClub[] {
  if (!cache) cache = build();
  return cache.get(`${secondaryschoolName}\t${prefecture ?? ''}`) ?? [];
}
