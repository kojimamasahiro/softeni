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
  division: string; // "1" | "2" | "3" | "playoff" ...
  date: string;
  status: 'scheduled' | 'finished';
  teamA: string;
  teamB: string;
  winner?: string; // teamId
  scoreA: number;
  scoreB: number;
  matches: MatchDetail[];
  label?: string; // ノックアウト等のラウンド名（例: "順位決定戦 1回戦"）
  block?: string; // 予選リーグのブロック（例: "A"）。本戦試合は未設定
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
  prefecture?: string;
  block?: string; // 予選リーグのブロック（例: "A"）
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
        {
          champion?: string | null;
          runnerUp?: string | null;
          third?: string[];
          ranking?: string[]; // 公式順位（teamId を順位順に並べた配列）
          blocks?: Record<string, string[]>; // 予選ブロック別の公式順位（block -> teamId順）
        }
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

// =============================================================
// チーム軸の横断集計（/teams/[teamId] の「STリーグでの成績」セクション用）
// =============================================================

export interface StLeagueTeamSeason {
  year: number;
  edition?: number;
  gender: Gender;
  divisionId: string;
  divisionName: string;
  played: number;
  won: number;
  lost: number;
  rank: number | null; // 公式順位があればそれ、無ければ計算順位
  isChampion: boolean; // その部の優勝（divisionName で文脈表示）
}

export interface StLeagueTeamSummary {
  teamId: string;
  name: string;
  seasons: StLeagueTeamSeason[]; // 年度降順→男女
  titlesTop: number; // Ⅰ部優勝の通算回数
  firstYear: number;
  lastYear: number;
}

/**
 * teamId を全年度横断で集計し、STリーグ出場の各シーズン成績を返す。
 * 出場記録が無ければ null。
 */
export function aggregateStLeagueTeam(
  teamId: string,
): StLeagueTeamSummary | null {
  const seasons: StLeagueTeamSeason[] = [];
  let name = teamId;

  for (const year of getStLeagueYears()) {
    const meta = loadLeagueMeta(year);
    const participants = loadParticipants(year);
    const matches = loadMatches(year);
    if (!participants || !matches) continue;

    (['boys', 'girls'] as Gender[]).forEach((gender) => {
      const team = participants[gender].find((t) => t.teamId === teamId);
      if (!team) return;
      name = team.name[0] ?? name;

      const divisionId = divisionOf(team);
      const divisionName =
        meta?.divisions?.find((d) => d.id === divisionId)?.name ?? '';

      const teamsInDiv = participants[gender].filter(
        (t) => divisionOf(t) === divisionId,
      );
      const matchesInDiv = matches[gender].filter(
        (m) => divisionOf(m) === divisionId,
      );
      const ranking = computeRanking(teamsInDiv, matchesInDiv);
      const rec = ranking.find((r) => r.teamId === teamId);

      // 順位: 公式 ranking 優先、無ければ計算順位
      const official = meta?.results?.[divisionId]?.[gender]?.ranking;
      let rank: number | null = null;
      if (official && official.length) {
        const idx = official.indexOf(teamId);
        rank = idx >= 0 ? idx + 1 : null;
      } else if (rec && rec.played > 0) {
        const idx = ranking.findIndex((r) => r.teamId === teamId);
        rank = idx >= 0 ? idx + 1 : null;
      }

      const champion = meta?.results?.[divisionId]?.[gender]?.champion;
      seasons.push({
        year,
        edition: meta?.edition,
        gender,
        divisionId,
        divisionName,
        played: rec?.played ?? 0,
        won: rec?.won ?? 0,
        lost: rec?.lost ?? 0,
        rank,
        isChampion: champion === teamId,
      });
    });
  }

  if (seasons.length === 0) return null;
  seasons.sort((a, b) =>
    b.year !== a.year ? b.year - a.year : a.gender.localeCompare(b.gender),
  );

  const titlesTop = seasons.filter(
    (s) => s.isChampion && s.divisionId === '1',
  ).length;
  const years = seasons.map((s) => s.year);

  return {
    teamId,
    name,
    seasons,
    titlesTop,
    firstYear: Math.min(...years),
    lastYear: Math.max(...years),
  };
}

/** 全年度の STリーグ参加チームの teamId 一覧（重複排除） */
export function getAllStLeagueTeamIds(): string[] {
  const ids = new Set<string>();
  for (const year of getStLeagueYears()) {
    const participants = loadParticipants(year);
    if (!participants) continue;
    (['boys', 'girls'] as Gender[]).forEach((g) =>
      participants[g].forEach((t) => ids.add(t.teamId)),
    );
  }
  return Array.from(ids);
}

/**
 * league.json の divisions を rank 昇順で返す。無ければ既定のⅠ/Ⅱ。
 * hasMatchData === false の部（例: 階層構成の位置付け紹介のみで対戦データを持たないⅢ部）は除外する。
 */
export function getDivisions(meta: LeagueMeta | null): DivisionMeta[] {
  if (meta?.divisions?.length) {
    return [...meta.divisions]
      .filter((d) => d.hasMatchData !== false)
      .sort((a, b) => a.rank - b.rank);
  }
  return [
    { id: '1', name: 'STリーグⅠ', rank: 1 },
    { id: '2', name: 'STリーグⅡ', rank: 2 },
  ];
}
