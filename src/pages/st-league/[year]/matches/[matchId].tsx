import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import {
  buildEventOrganizer,
  buildEventPlace,
  sportsEventBaseFields,
} from '@/lib/sportsEventJsonLd';
import {
  buildPlayerMap,
  computeRanking,
  divisionOf,
  Gender,
  getStLeagueYears,
  LeagueMeta,
  loadLeagueMeta,
  loadMatches,
  loadParticipants,
  Match,
} from '@/utils/st-league';

const DIVISION_ID = '1'; // 当面はⅠ部の決着済み対戦のみ（ADR-008）

interface TeamLine {
  teamId: string;
  name: string;
  rank: number | null;
}

interface PastMeeting {
  year: number;
  slug: string;
  label: string; // 例: "2024 第2回"
  teamAName: string;
  teamBName: string;
  scoreA: number;
  scoreB: number;
  winnerName: string;
}

interface NeighborMatch {
  slug: string;
  opponentName: string;
  date: string;
  result: string; // 例: "○ 2-1" / "● 1-2"
}

interface Props {
  year: number;
  gender: Gender;
  editionLabel: string;
  divisionName: string;
  meta: LeagueMeta | null;
  match: Match;
  teamA: TeamLine;
  teamB: TeamLine;
  playerNames: Record<number, string>;
  past: PastMeeting[];
  neighbors: { a: NeighborMatch[]; b: NeighborMatch[] };
}

const GENDER_LABEL: Record<Gender, string> = { boys: '男子', girls: '女子' };

function slugFor(gender: Gender, m: Match) {
  return `${gender}-${m.teamA}-vs-${m.teamB}`;
}

function parseSlug(
  slug: string,
): { gender: Gender; teamA: string; teamB: string } | null {
  let gender: Gender;
  let rest: string;
  if (slug.startsWith('boys-')) {
    gender = 'boys';
    rest = slug.slice('boys-'.length);
  } else if (slug.startsWith('girls-')) {
    gender = 'girls';
    rest = slug.slice('girls-'.length);
  } else {
    return null;
  }
  const idx = rest.indexOf('-vs-');
  if (idx < 0) return null;
  return {
    gender,
    teamA: rest.slice(0, idx),
    teamB: rest.slice(idx + '-vs-'.length),
  };
}

export default function STLeagueMatchDetail({
  year,
  gender,
  editionLabel,
  divisionName,
  meta,
  match,
  teamA,
  teamB,
  playerNames,
  past,
  neighbors,
}: Props) {
  const getPlayers = (ids?: number[]) =>
    !ids || ids.length === 0
      ? '-'
      : ids.map((id) => playerNames[id] || `ID:${id}`).join('・');

  const winnerName =
    match.winner === match.teamA
      ? teamA.name
      : match.winner === match.teamB
        ? teamB.name
        : null;

  const dateText = match.date.replace(/-/g, '/');
  const pageUrl = `https://softeni-pick.com/st-league/${year}/matches/${slugFor(gender, match)}/`;
  const pageTitle = `${teamA.name} vs ${teamB.name} 試合結果｜${editionLabel}（${GENDER_LABEL[gender]}）`;
  const scoreText = `${match.scoreA}-${match.scoreB}`;
  const description = `${editionLabel}（${GENDER_LABEL[gender]}・${divisionName}）${teamA.name} 対 ${teamB.name} の試合結果。${winnerName ? `${winnerName}が${scoreText}で勝利。` : `スコア${scoreText}。`}ダブルス①・シングルス・ダブルス②の個別結果と両チームの順位をまとめています。`;

  return (
    <>
      <MetaHead title={pageTitle} description={description} url={pageUrl} />
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SportsEvent',
              name: `${editionLabel} ${teamA.name} vs ${teamB.name}（${GENDER_LABEL[gender]}）`,
              sport: 'ソフトテニス',
              ...sportsEventBaseFields,
              startDate: match.date,
              endDate: match.date,
              location: buildEventPlace(meta?.venue, meta?.location),
              organizer: buildEventOrganizer(
                '公益財団法人 日本ソフトテニス連盟',
                'https://www.jsta.or.jp/',
              ),
              competitor: [
                { '@type': 'SportsTeam', name: teamA.name },
                { '@type': 'SportsTeam', name: teamB.name },
              ],
              description: `${editionLabel} ${teamA.name} 対 ${teamB.name} の試合結果（${scoreText}）。`,
              url: pageUrl,
            }),
          }}
        />
      </Head>

      <PageLayout maxWidth="3xl" className="space-y-6">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: 'STリーグ', href: '/st-league' },
            { label: `${year}`, href: `/st-league/${year}` },
            { label: '試合結果・順位表', href: `/st-league/${year}/matches` },
            {
              label: `${teamA.name} vs ${teamB.name}`,
              href: `/st-league/${year}/matches/${slugFor(gender, match)}`,
            },
          ]}
        />

        {/* ヘッダー / スコア */}
        <header>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">
              {GENDER_LABEL[gender]}・{divisionName}
            </span>
            <span className="text-gray-500">
              {editionLabel}　{dateText}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold">
            {teamA.name} <span className="text-gray-400">vs</span> {teamB.name}
          </h1>

          <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1 text-right">
                <Link
                  href={`/st-league/${year}/teams`}
                  className="font-bold hover:text-blue-600 hover:underline"
                >
                  {teamA.name}
                </Link>
                {teamA.rank && (
                  <span className="block text-xs text-gray-400">
                    リーグ{teamA.rank}位
                  </span>
                )}
              </div>
              <div className="px-5 flex flex-col items-center min-w-[96px]">
                <div className="flex items-center gap-3 text-3xl font-bold font-mono">
                  <span
                    className={
                      match.winner === match.teamA
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-400'
                    }
                  >
                    {match.scoreA}
                  </span>
                  <span className="text-gray-300">-</span>
                  <span
                    className={
                      match.winner === match.teamB
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-400'
                    }
                  >
                    {match.scoreB}
                  </span>
                </div>
                {winnerName && (
                  <span className="mt-1 text-xs font-semibold text-gray-500">
                    {winnerName} の勝利
                  </span>
                )}
              </div>
              <div className="flex-1 text-left">
                <Link
                  href={`/st-league/${year}/teams`}
                  className="font-bold hover:text-blue-600 hover:underline"
                >
                  {teamB.name}
                </Link>
                {teamB.rank && (
                  <span className="block text-xs text-gray-400">
                    リーグ{teamB.rank}位
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* 個別対戦（D1/S/D2） */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
            個別対戦（ダブルス①・シングルス・ダブルス②）
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            {match.matches.length === 0 && (
              <p className="p-4 text-sm text-gray-500">
                個別対戦の詳細データは未登録です。
              </p>
            )}
            {match.matches.map((d, i) => (
              <div key={i} className="flex items-center text-sm p-4">
                <div className="w-10 font-bold text-gray-400 text-xs uppercase text-center">
                  {d.type}
                </div>
                <div
                  className={`flex-1 text-right ${d.winner === 'A' ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500'}`}
                >
                  {getPlayers(d.playersA)}
                </div>
                <div className="px-3">
                  <span className="inline-block px-1.5 py-0.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs font-mono font-medium">
                    {d.scoreA}-{d.scoreB}
                  </span>
                </div>
                <div
                  className={`flex-1 text-left ${d.winner === 'B' ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500'}`}
                >
                  {getPlayers(d.playersB)}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">
            対戦順: ダブルス① → シングルス → ダブルス②（2本先取）。
          </p>
        </section>

        {/* 過去の対戦 */}
        {past.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
              この2チームの過去の対戦（STリーグⅠ）
            </h2>
            <div className="space-y-2">
              {past.map((p) => (
                <Link
                  key={p.slug + p.year}
                  href={`/st-league/${p.year}/matches/${p.slug}`}
                  className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 px-4 py-2 hover:border-blue-400 transition-colors"
                >
                  <span className="text-xs text-gray-400 w-24 shrink-0">
                    {p.label}
                  </span>
                  <span className="flex-1 text-sm text-right truncate">
                    {p.teamAName}
                  </span>
                  <span className="px-3 font-mono font-bold text-sm">
                    {p.scoreA}-{p.scoreB}
                  </span>
                  <span className="flex-1 text-sm text-left truncate">
                    {p.teamBName}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 各チームの前後の試合 */}
        {(neighbors.a.length > 0 || neighbors.b.length > 0) && (
          <section className="grid sm:grid-cols-2 gap-4">
            {(
              [
                [teamA, neighbors.a],
                [teamB, neighbors.b],
              ] as [TeamLine, NeighborMatch[]][]
            ).map(([team, list]) => (
              <div key={team.teamId}>
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">
                  {team.name} の他の対戦
                </h3>
                <div className="space-y-1.5">
                  {list.length === 0 && (
                    <p className="text-xs text-gray-400">他の対戦はありません。</p>
                  )}
                  {list.map((n) => (
                    <Link
                      key={n.slug}
                      href={`/st-league/${year}/matches/${n.slug}`}
                      className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2 hover:border-blue-400 transition-colors text-sm"
                    >
                      <span className="truncate">vs {n.opponentName}</span>
                      <span className="ml-2 shrink-0 text-xs font-mono text-gray-500">
                        {n.result}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* 他ページ導線 */}
        <nav className="flex flex-wrap gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
          <Link
            href={`/st-league/${year}/matches`}
            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            ▶ {year} 順位表・全対戦結果
          </Link>
          <Link
            href={`/st-league/${year}/teams`}
            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            ▶ 出場チーム・選手
          </Link>
          <Link
            href={`/st-league/${year}/analysis`}
            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            ▶ 選手別データ・分析
          </Link>
          <Link
            href={`/st-league/${year}`}
            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            ▶ {year} 年度トップ
          </Link>
        </nav>
      </PageLayout>
    </>
  );
}

export const getStaticPaths = async () => {
  const paths: { params: { year: string; matchId: string } }[] = [];
  for (const year of getStLeagueYears()) {
    const matches = loadMatches(year);
    if (!matches) continue;
    (['boys', 'girls'] as Gender[]).forEach((gender) => {
      matches[gender]
        .filter(
          (m) => divisionOf(m) === DIVISION_ID && m.status === 'finished',
        )
        .forEach((m) => {
          paths.push({
            params: { year: String(year), matchId: slugFor(gender, m) },
          });
        });
    });
  }
  return { paths, fallback: false };
};

export const getStaticProps = async ({
  params,
}: {
  params: { year: string; matchId: string };
}) => {
  const year = parseInt(params.year, 10);
  const parsed = parseSlug(params.matchId);
  if (!parsed) return { notFound: true };
  const { gender, teamA: teamAId, teamB: teamBId } = parsed;

  const matches = loadMatches(year);
  const participants = loadParticipants(year);
  const meta = loadLeagueMeta(year);
  if (!matches || !participants) return { notFound: true };

  const div1 = matches[gender].filter(
    (m) => divisionOf(m) === DIVISION_ID && m.status === 'finished',
  );
  const match = div1.find(
    (m) => m.teamA === teamAId && m.teamB === teamBId,
  );
  if (!match) return { notFound: true };

  const teamsDiv1 = participants[gender].filter(
    (t) => divisionOf(t) === DIVISION_ID,
  );
  const nameOf = (id: string) =>
    teamsDiv1.find((t) => t.teamId === id)?.name[0] ??
    participants[gender].find((t) => t.teamId === id)?.name[0] ??
    id;

  const ranking = computeRanking(teamsDiv1, div1);
  const rankOf = (id: string) => {
    const idx = ranking.findIndex((r) => r.teamId === id);
    return idx >= 0 ? idx + 1 : null;
  };

  const playerNames = buildPlayerMap(participants[gender]);

  // 前後の試合（同年度・同性別・Ⅰ部）。日付→id 順で各チームの自分以外の対戦。
  const ordered = [...div1].sort((a, b) =>
    a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1,
  );
  const neighborsFor = (teamId: string): NeighborMatch[] =>
    ordered
      .filter(
        (m) =>
          (m.teamA === teamId || m.teamB === teamId) && m.id !== match.id,
      )
      .map((m) => {
        const isA = m.teamA === teamId;
        const oppId = isA ? m.teamB : m.teamA;
        const myScore = isA ? m.scoreA : m.scoreB;
        const oppScore = isA ? m.scoreB : m.scoreA;
        const won = m.winner === teamId;
        return {
          slug: slugFor(gender, m),
          opponentName: nameOf(oppId),
          date: m.date,
          result: `${won ? '○' : '●'} ${myScore}-${oppScore}`,
        };
      });

  // 過去の対戦（他年度Ⅰ部、同じ2チームの無順序ペア）
  const pairKey = [teamAId, teamBId].sort().join('|');
  const past: PastMeeting[] = [];
  for (const y of getStLeagueYears()) {
    if (y === year) continue;
    const ms = loadMatches(y);
    const ps = loadParticipants(y);
    const lm = loadLeagueMeta(y);
    if (!ms || !ps) continue;
    const yDiv1 = ms[gender].filter(
      (m) => divisionOf(m) === DIVISION_ID && m.status === 'finished',
    );
    const yName = (id: string) =>
      ps[gender].find((t) => t.teamId === id)?.name[0] ?? id;
    yDiv1
      .filter((m) => [m.teamA, m.teamB].sort().join('|') === pairKey)
      .forEach((m) => {
        past.push({
          year: y,
          slug: slugFor(gender, m),
          label: lm?.edition ? `${y}・第${lm.edition}回` : `${y}`,
          teamAName: yName(m.teamA),
          teamBName: yName(m.teamB),
          scoreA: m.scoreA,
          scoreB: m.scoreB,
          winnerName: m.winner ? yName(m.winner) : '',
        });
      });
  }
  past.sort((a, b) => b.year - a.year);

  const editionLabel = meta?.title ?? `STリーグ ${year}`;
  const divisionName =
    meta?.divisions?.find((d) => d.id === DIVISION_ID)?.name ?? 'STリーグⅠ';

  return {
    props: {
      year,
      gender,
      editionLabel,
      divisionName,
      meta,
      match,
      teamA: { teamId: teamAId, name: nameOf(teamAId), rank: rankOf(teamAId) },
      teamB: { teamId: teamBId, name: nameOf(teamBId), rank: rankOf(teamBId) },
      playerNames,
      past,
      neighbors: { a: neighborsFor(teamAId), b: neighborsFor(teamBId) },
    },
  };
};
