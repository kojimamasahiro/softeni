// lib/highschoolTeamMatchMembers.ts
//
// 高校の学校ページ「年度別メンバー」に、団体戦のオーダー（ADR-020）に出た選手を足すための索引。
//
// 団体戦の `participants` は学校単位（`校名_都道府県`・氏名は null）なので、団体戦に出た選手は
// 年度別メンバーに 1 人も出ていなかった。オーダー（`matches[].matches[].playersA/B`）には
// その年に実際にコートに立った選手が姓・名で入っているので、ここから引き直して足す。
// 「メンバー」は順位ではなく出場の事実なので、地区大会と同じ扱いにできる
// （lib/highschoolBlockMembers.ts と同じ理由。docs/wiki/highschool.md）。
// 実測（2026-09-19）: 551 の学校×年に延べ 3,948 名、うち約 1,286 名はその年の個人戦の
// participants に出てこない＝この索引が無いとメンバー一覧に載らない。
//
// 成績・ランキング・選手の通算成績には入れない（ADR-020 の追記: 集計は STリーグに合わせる）。
//
// **対象は高校の大会だけ**（`index.json` / `local_index.json` の `generationId === 'highschool'`）。
// 同名の中学・小学の団体と混ざらないようにするため（ADR-013）。国際大会はエントリーが
// 国名で都道府県を持たないので、都道府県の有無でも落ちる。
//
// fs を使うため getStaticProps からのみ import すること。

import fs from 'fs';
import path from 'path';

export interface TeamMatchMember {
  year: number;
  lastName: string;
  /** 「名前だけ」の選手（個人戦の記録が無い層）で姓名を分けられないときは空文字 */
  firstName: string;
}

/** `学校名\t都道府県\t性別` -> メンバー（年×氏名で重複なし） */
let cache: Map<string, TeamMatchMember[]> | null = null;

type IndexEntry = { tournamentId?: string; generationId?: string };

/** 高校カテゴリの大会 id。`index.json` と `local_index.json`（地区大会）の両方を見る */
function loadHighschoolTournamentIds(): Set<string> {
  const ids = new Set<string>();
  for (const file of ['index.json', 'local_index.json']) {
    // 配列 spread にすると nft がリポジトリ全体を glob するため、パスはリテラルで書く
    const p =
      file === 'index.json'
        ? path.join(process.cwd(), 'data', 'tournaments', 'index.json')
        : path.join(process.cwd(), 'data', 'tournaments', 'local_index.json');
    try {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as IndexEntry[];
      for (const e of parsed) {
        if (e.generationId === 'highschool' && e.tournamentId) ids.add(e.tournamentId);
      }
    } catch {
      // 無ければ無視する（local_index.json はこのリポジトリにあるが、無くても動く）
    }
  }
  return ids;
}

/**
 * 「名前だけ」の選手（`{ name: '川波 悠馬' }`）を姓・名に割る。
 * 空白があれば先頭を姓・残りを名にする（表示の規則は MatchResults.tsx と同じ）。
 * 空白が無いもの（実測 27 枠）は割らずに姓へ入れ、名は空にする——ここで 1+1 に割ると
 * 誤った姓名をページに出すことになるため（docs/wiki/player-name-identity.md）。
 */
function splitNameOnly(name: string): { lastName: string; firstName: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { lastName: parts[0], firstName: '' };
  return { lastName: parts[0], firstName: parts.slice(1).join('') };
}

function build(): Map<string, TeamMatchMember[]> {
  const index = new Map<string, Map<string, TeamMatchMember>>();
  const detailsRoot = path.join(process.cwd(), 'data', 'tournaments', 'details');
  const highschoolIds = loadHighschoolTournamentIds();

  let tournamentIds: string[] = [];
  try {
    tournamentIds = fs.readdirSync(detailsRoot).filter((id) => highschoolIds.has(id));
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

        let detail: {
          participants?: { id?: string | null; team?: string | null; prefecture?: string | null }[];
          entries?: { entryNo?: number; playerIds?: string[] }[];
          matches?: {
            entries?: number[];
            matches?: {
              playersA?: ({ lastName: string; firstName: string } | { name: string })[];
              playersB?: ({ lastName: string; firstName: string } | { name: string })[];
            }[];
          }[];
        };
        try {
          detail = JSON.parse(fs.readFileSync(path.join(tDir, year, file), 'utf-8'));
        } catch {
          continue;
        }
        if (!detail.matches?.some((m) => m.matches?.length)) continue;

        // 団体戦のエントリーは playerIds が `校名_都道府県` の 1 件。都道府県を持たない
        // エントリー（国際大会の国名など）は学校ページの対象外なので落ちる。
        const schoolByParticipantId = new Map<string, { team: string; prefecture: string }>();
        for (const p of detail.participants ?? []) {
          if (p.id && p.team && p.prefecture) schoolByParticipantId.set(p.id, { team: p.team, prefecture: p.prefecture });
        }
        const schoolByEntryNo = new Map<number, { team: string; prefecture: string }>();
        for (const e of detail.entries ?? []) {
          const pid = (e.playerIds ?? [])[0];
          const school = pid ? schoolByParticipantId.get(pid) : undefined;
          if (e.entryNo !== undefined && school) schoolByEntryNo.set(e.entryNo, school);
        }

        for (const match of detail.matches ?? []) {
          for (const sub of match.matches ?? []) {
            // A は親の entries[0]、B は entries[1]（ADR-020）
            for (const [side, players] of [
              [0, sub.playersA ?? []],
              [1, sub.playersB ?? []],
            ] as const) {
              const school = schoolByEntryNo.get((match.entries ?? [])[side]);
              if (!school) continue;
              for (const p of players) {
                const { lastName, firstName } = 'lastName' in p ? { lastName: p.lastName, firstName: p.firstName } : splitNameOnly(p.name);
                if (!lastName) continue;
                const key = `${school.team}\t${school.prefecture}\t${gender}`;
                const members = index.get(key) ?? new Map<string, TeamMatchMember>();
                members.set(`${year}\t${lastName}\t${firstName}`, { year: Number(year), lastName, firstName });
                index.set(key, members);
              }
            }
          }
        }
      }
    }
  }

  return new Map([...index.entries()].map(([key, members]) => [key, [...members.values()]]));
}

/**
 * 学校（学校ページの正準名・都道府県名・性別）の、団体戦のオーダーに出た選手。
 * 学校名は details の participants[].team と完全一致で引く（表記ゆれは名寄せ側で吸収する前提）。
 */
export function getTeamMatchMembers(teamName: string, prefectureName: string, gender: 'boys' | 'girls'): TeamMatchMember[] {
  if (!cache) cache = build();
  return cache.get(`${teamName}\t${prefectureName}\t${gender}`) ?? [];
}
