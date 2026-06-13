import fs from 'fs';
import path from 'path';

// =============================================================
// STリーグ 共有データモデル / ローダー
// 階層構造（STリーグⅠ・Ⅱ・Ⅲ）と入替戦・昇降格を表現する。
// =============================================================

export type Gender = 'boys' | 'girls';

export interface MatchDetail {
  type: 'D1' | 'S' | 'D2';
  winner: 'A' | 'B';
  scoreA: number;
  scoreB: number;
  playersA?: number[];
  playersB?: number[];
}

export interface Match {
  id: number;
  division: string; // "1" | "2" | "3" ...
  date: string;
  status: 'scheduled' | 'finished';
  teamA: string;
  teamB: string;
  winner?: string; // teamId
  scoreA: number;
  scoreB: number;
  matches: MatchDetail[];
}

export interface Player {
  lastName: string;
  firstName: string;
  id: number;
}

export interface Team {
  teamId: string;
  division: string;
  name: string[];
  players?: Player[];
}

export interface GenderedData<T> {
  boys: T[];
  girls: T[];
}

export interface DivisionMeta {
  id: string;
  name: string; // 例: "STリーグⅠ"
  rank: number; // 1 が最上位
  format?: string;
  teamCount?: { boys?: number; girls?: number };
  note?: string;
  hasMatchData?: boolean;
}

export interface PlayoffMeta {
  name: string;
  period?: { start: string; end: string };
  venue?: string;
  description?: string;
}

export interface LeagueMeta {
  year: number;
  edition: number;
  title: string;
  period?: { start: string; end: string };
  venue?: string;
  location?: string;
  format?: { tie?: string; game?: string };
  playoff?: PlayoffMeta;
  divisions: DivisionMeta[];
  results?: Record<
    string,
    Partial<
      Record<
        Gender,
        { champion?: string | null; runnerUp?: string | null; third?: string[] }
      >
    >
  >;
  notes?: string[];
}

export interface Ranking {
  teamId: string;
  name: string;
  played: number;
  won: number;
  lost: number;
  pointsWon: number;
  pointsLost: number;
}

export interface PlayerMap {
  [key: number]: string;
}

const DATA_ROOT = path.join(process.cwd(), 'data/st-league');

/** data/st-league 配下の年度ディレクトリ一覧（降順） */
export function getStLeagueYears(): number[] {
  if (!fs.existsSync(DATA_ROOT)) return [];
  return fs
    .readdirSync(DATA_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d{4}$/.test(e.name))
    .map((e) => Number(e.name))
    .sort((a, b) => b - a);
}

function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

export function loadLeagueMeta(year: number | string): LeagueMeta | null {
  return readJson<LeagueMeta>(
    path.join(DATA_ROOT, String(year), 'league.json'),
  );
}

export function loadParticipants(
  year: number | string,
): GenderedData<Team> | null {
  return readJson<GenderedData<Team>>(
    path.join(DATA_ROOT, String(year), 'participants.json'),
  );
}

export function loadMatches(year: number | string): GenderedData<Match> | null {
  return readJson<GenderedData<Match>>(
    path.join(DATA_ROOT, String(year), 'matches.json'),
  );
}

/** division 未設定の古いデータは "1" とみなす */
export function divisionOf(item: { division?: string }): string {
  return item.division ?? '1';
}

export function buildPlayerMap(teams: Team[]): PlayerMap {
  const map: PlayerMap = {};
  teams.forEach((team) => {
    team.players?.forEach((p) => {
      if (p.id) map[p.id] = p.lastName;
    });
  });
  return map;
}

/**
 * 指定 division のチーム・試合から順位表を計算する。
 * 順位決定: 勝数 → 同勝数内の直接対決勝ち数 → 得失点差 → 得点
 */
export function computeRanking(teams: Team[], matches: Match[]): Ranking[] {
  const rankMap = new Map<string, Ranking>();
  teams.forEach((team) => {
    rankMap.set(team.teamId, {
      teamId: team.teamId,
      name: team.name[0],
      played: 0,
      won: 0,
      lost: 0,
      pointsWon: 0,
      pointsLost: 0,
    });
  });

  matches.forEach((match) => {
    if (match.status !== 'finished') return;
    const a = rankMap.get(match.teamA);
    const b = rankMap.get(match.teamB);
    if (!a || !b) return;
    a.played++;
    b.played++;
    a.pointsWon += match.scoreA;
    a.pointsLost += match.scoreB;
    b.pointsWon += match.scoreB;
    b.pointsLost += match.scoreA;
    if (match.winner === match.teamA) {
      a.won++;
      b.lost++;
    } else if (match.winner === match.teamB) {
      b.won++;
      a.lost++;
    }
  });

  const headToHead = (ids: string[]) => {
    const win: Record<string, number> = {};
    ids.forEach((id) => (win[id] = 0));
    matches.forEach((m) => {
      if (
        m.status === 'finished' &&
        ids.includes(m.teamA) &&
        ids.includes(m.teamB) &&
        m.winner
      ) {
        win[m.winner]++;
      }
    });
    return win;
  };

  const groups: Record<number, Ranking[]> = {};
  Array.from(rankMap.values()).forEach((t) => {
    (groups[t.won] ??= []).push(t);
  });

  let sorted: Ranking[] = [];
  Object.keys(groups)
    .map(Number)
    .sort((x, y) => y - x)
    .forEach((won) => {
      const group = groups[won];
      if (group.length === 1) {
        sorted.push(group[0]);
        return;
      }
      const win = headToHead(group.map((t) => t.teamId));
      group.sort((a, b) => {
        if (win[b.teamId] !== win[a.teamId])
          return win[b.teamId] - win[a.teamId];
        const dA = a.pointsWon - a.pointsLost;
        const dB = b.pointsWon - b.pointsLost;
        if (dB !== dA) return dB - dA;
        return b.pointsWon - a.pointsWon;
      });
      sorted = sorted.concat(group);
    });
  return sorted;
}

/** league.json の divisions を rank 昇順で返す。無ければ既定のⅠ/Ⅱ/Ⅲ。 */
export function getDivisions(meta: LeagueMeta | null): DivisionMeta[] {
  if (meta?.divisions?.length) {
    return [...meta.divisions].sort((a, b) => a.rank - b.rank);
  }
  return [
    { id: '1', name: 'STリーグⅠ', rank: 1 },
    { id: '2', name: 'STリーグⅡ', rank: 2 },
    { id: '3', name: 'STリーグⅢ', rank: 3 },
  ];
}
