import Head from 'next/head';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import { buildEventOrganizer, buildEventPlace, sportsEventBaseFields } from '@/lib/sportsEventJsonLd';
import {
  buildPlayerMap,
  computeRanking,
  divisionOf,
  DivisionMeta,
  Gender,
  getDivisions,
  getStLeagueYears,
  LeagueMeta,
  loadLeagueMeta,
  loadMatches,
  loadParticipants,
  Match,
  PlayerMap,
  Ranking,
  Team,
} from '@/utils/st-league';

interface MatchesPageProps {
  year: number;
  meta: LeagueMeta | null;
  divisions: DivisionMeta[];
  matches: { boys: Match[]; girls: Match[] };
  teams: { boys: Team[]; girls: Team[] };
  playerMaps: { boys: PlayerMap; girls: PlayerMap };
}

const DIV_BADGE = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-bold';
const PLAYOFF_ID = 'playoff';

interface MatchesPanelProps {
  year: number;
  gender: Gender;
  divisionId: string;
  meta: LeagueMeta | null;
  divisions: DivisionMeta[];
  matches: { boys: Match[]; girls: Match[] };
  teams: { boys: Team[]; girls: Team[] };
  playerMaps: { boys: PlayerMap; girls: PlayerMap };
  expanded: Set<string>;
  toggle: (key: string) => void;
}

// 1つの gender×division（またはプレーオフ）分の順位表・対戦結果を描画する。
// 全タブをHTMLに出力するため（SEO）、非アクティブなパネルは親側で `hidden` 切替する。
// state に依存しない純粋な props のみで計算するので各タブの内容が静的HTMLに含まれる。
function MatchesPanel({ year, gender, divisionId, meta, divisions, matches, teams, playerMaps, expanded, toggle }: MatchesPanelProps) {
  const isPlayoff = divisionId === PLAYOFF_ID;

  const matchesInDiv = matches[gender].filter((m) => divisionOf(m) === divisionId);

  const teamsInDiv = (() => {
    if (isPlayoff) {
      // プレーオフ出場チームは試合データの teamId 集合から division 横断で導出
      const ids = new Set<string>();
      matchesInDiv.forEach((m) => {
        ids.add(m.teamA);
        ids.add(m.teamB);
      });
      return teams[gender].filter((t) => ids.has(t.teamId));
    }
    return teams[gender].filter((t) => divisionOf(t) === divisionId);
  })();

  const playerMap = playerMaps[gender] || {};

  const getTeamName = (teamId: string) => teamsInDiv.find((t) => t.teamId === teamId)?.name[0] ?? teamId;
  const getPlayerNames = (ids?: number[]) => (!ids ? '-' : ids.map((id) => playerMap[id] || `ID:${id}`).join('・'));
  // プレーオフ順位表用：各チームの所属リーグ名（Ⅰ/Ⅱ）
  const teamDivName = (teamId: string) => {
    const t = teams[gender].find((x) => x.teamId === teamId);
    return t ? (divisions.find((d) => d.id === divisionOf(t))?.name ?? '') : '';
  };

  const ranking = computeRanking(teamsInDiv, matchesInDiv);

  // 公式順位（league.json results）。ノックアウト等で総当たり計算が使えない場合に優先
  const officialOrder = !isPlayoff && meta?.results?.[divisionId]?.[gender]?.ranking;
  const hasOfficialRanking = !!(officialOrder && officialOrder.length);
  const displayRanking: Ranking[] = (() => {
    if (hasOfficialRanking && officialOrder) {
      const byId = new Map(ranking.map((r) => [r.teamId, r]));
      return officialOrder.map((tid) => byId.get(tid)).filter((r): r is Ranking => !!r);
    }
    return ranking;
  })();

  // 予選ブロック別 公式順位表（league.json results.<div>.<gender>.blocks）
  const officialBlocks = !isPlayoff && meta?.results?.[divisionId]?.[gender]?.blocks;
  const blockStandings = (() => {
    if (!officialBlocks) return null;
    return Object.entries(officialBlocks).map(([block, order]) => {
      const blockTeams = teamsInDiv.filter((t) => order.includes(t.teamId));
      const blockMatches = matchesInDiv.filter((m) => m.block === block);
      const recs = computeRanking(blockTeams, blockMatches);
      const byId = new Map(recs.map((r) => [r.teamId, r]));
      const rows = order.map((tid) => byId.get(tid)).filter((r): r is Ranking => !!r);
      return { block, rows };
    });
  })();

  const currentDiv = divisions.find((d) => d.id === divisionId);
  const currentDivName = isPlayoff ? (meta?.playoff?.name ?? 'プレーオフ') : (currentDiv?.name ?? '');
  // プレーオフは昇降格ゾーン表示の対象外（リーグをまたぐため）
  const isLowest = isPlayoff || !currentDiv ? true : currentDiv.rank === Math.max(...divisions.map((d) => d.rank));
  const isTop = isPlayoff || !currentDiv ? true : currentDiv.rank === 1;

  return (
    <div className="space-y-6">
      {isPlayoff
        ? meta?.playoff?.description && <p className="text-xs text-gray-500 dark:text-gray-400">{meta.playoff.description}</p>
        : currentDiv?.note && <p className="text-xs text-gray-500 dark:text-gray-400">{currentDiv.note}</p>}

      {teamsInDiv.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500">
          <p className="font-semibold mb-1">{currentDivName || 'このリーグ'}のデータは準備中です</p>
          <p className="text-xs">公式記録をもとに順次追加していきます。</p>
        </div>
      ) : (
        <>
          {/* 順位表 */}
          <section>
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{currentDivName} 順位表</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              {hasOfficialRanking
                ? '順位は順位決定戦（公式記録）による。勝敗は同部内の対戦成績。'
                : '順位は「勝数」→「同勝数内の直接対決」→「得失点差」の順で決定。'}
            </p>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="py-3 px-4 text-left font-medium w-16">順位</th>
                    <th className="py-3 px-2 text-left font-medium">チーム</th>
                    <th className="py-3 px-2 text-center font-medium w-20">勝敗</th>
                    <th className="py-3 px-4 text-center font-medium w-16">得失</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {displayRanking.map((team, index) => {
                    const rank = index + 1;
                    const total = displayRanking.length;
                    // 入替戦ゾーンの目安（最上位リーグの下位2、最下位以外の上位2）
                    // 公式順位表示時（ノックアウト）はゾーン表示しない
                    const relegationZone = !hasOfficialRanking && !isLowest && rank > total - 2 && team.played > 0;
                    const promotionZone = !hasOfficialRanking && !isTop && rank <= 2 && team.played > 0;
                    return (
                      <tr key={team.teamId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="py-3 text-center font-bold text-gray-700 dark:text-gray-300">
                          <span className="inline-flex items-center gap-1">
                            {rank}
                            {promotionZone && (
                              <span className={`${DIV_BADGE} bg-green-100 text-green-700`} title="入替戦（昇格）対象の目安">
                                昇
                              </span>
                            )}
                            {relegationZone && (
                              <span className={`${DIV_BADGE} bg-red-100 text-red-700`} title="入替戦（降格）対象の目安">
                                降
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-2 font-medium">
                          <Link href={`/teams/${team.teamId}`} className="hover:text-blue-600 hover:underline">
                            {team.name}
                          </Link>
                          {isPlayoff && teamDivName(team.teamId) && (
                            <span className={`${DIV_BADGE} bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 ml-2`}>
                              {teamDivName(team.teamId)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {team.played > 0 ? (
                            <span className="inline-flex gap-1">
                              <span className="font-bold">{team.won}</span>
                              <span className="text-gray-400 mx-0.5">-</span>
                              <span className="text-gray-500">{team.lost}</span>
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-gray-500 dark:text-gray-400 text-xs">
                          {team.played > 0 ? `${team.pointsWon}-${team.pointsLost}` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!hasOfficialRanking && (!isTop || !isLowest) && (
              <p className="text-[11px] text-gray-400 mt-2">
                {!isTop && (
                  <span className="mr-3">
                    <span className={`${DIV_BADGE} bg-green-100 text-green-700 mr-1`}>昇</span>
                    入替戦（昇格）対象の目安
                  </span>
                )}
                {!isLowest && (
                  <span>
                    <span className={`${DIV_BADGE} bg-red-100 text-red-700 mr-1`}>降</span>
                    入替戦（降格）対象の目安
                  </span>
                )}
              </p>
            )}
          </section>

          {/* 予選ブロック別順位表 */}
          {blockStandings && blockStandings.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">予選リーグ ブロック順位表</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">各ブロック1位が順位決定戦へ進出。順位は公式記録による。</p>
              <div className="grid sm:grid-cols-2 gap-4">
                {blockStandings.map(({ block, rows }) => (
                  <div key={block} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 text-xs font-bold text-gray-600 dark:text-gray-300">{block}ブロック</div>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {rows.map((team, idx) => (
                          <tr key={team.teamId}>
                            <td className="py-2 px-3 w-10 text-center font-bold text-gray-700 dark:text-gray-300">{idx + 1}</td>
                            <td className="py-2 px-1 font-medium">
                              {team.name}
                              {idx === 0 && (
                                <span className={`${DIV_BADGE} bg-amber-100 text-amber-700 ml-2`} title="順位決定戦へ進出">
                                  進出
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center text-gray-500">{team.played > 0 ? `${team.won}-${team.lost}` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 対戦結果一覧 */}
          <section>
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{currentDivName} 対戦結果</h2>
            <div className="space-y-3">
              {matchesInDiv.map((match) => {
                const key = `${gender}-${divisionId}-${match.id}`;
                const isExpanded = expanded.has(key);
                return (
                  <div
                    key={match.id}
                    className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border transition-all ${
                      isExpanded ? 'border-blue-500 ring-1 ring-blue-100 dark:ring-blue-900' : 'border-gray-100 dark:border-gray-700'
                    }`}
                  >
                    <div className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors select-none" onClick={() => toggle(key)}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                            {match.status === 'finished' ? '試合終了' : '予定'}
                          </span>
                          {match.label && (
                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">
                              {match.label}
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-gray-400">{match.date.replace(/-/g, '/')}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 text-right">
                          <span
                            className={`block font-bold truncate ${match.winner === match.teamA ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}
                          >
                            {getTeamName(match.teamA)}
                          </span>
                        </div>
                        <div className="px-4 flex flex-col items-center min-w-[80px]">
                          {match.status === 'finished' ? (
                            <div className="flex items-center space-x-2 text-xl font-bold font-mono">
                              <span className={match.winner === match.teamA ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}>{match.scoreA}</span>
                              <span className="text-gray-300">-</span>
                              <span className={match.winner === match.teamB ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}>{match.scoreB}</span>
                            </div>
                          ) : (
                            <span className="text-xl font-bold text-gray-300">VS</span>
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <span
                            className={`block font-bold truncate ${match.winner === match.teamB ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}
                          >
                            {getTeamName(match.teamB)}
                          </span>
                        </div>
                        <div className="flex items-center justify-end">
                          <span className="ml-2 text-xs">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>
                    </div>

                    {isExpanded && match.status === 'finished' && (
                      <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
                        <div className="space-y-3">
                          {match.matches.map((detail, idx) => (
                            <div key={idx} className="flex items-center text-sm">
                              <div className="w-8 font-bold text-gray-400 text-xs uppercase text-center">{detail.type}</div>
                              <div className={`flex-1 text-right ${detail.winner === 'A' ? 'font-bold text-gray-800 dark:text-gray-200' : 'text-gray-500'}`}>
                                {getPlayerNames(detail.playersA)}
                              </div>
                              <div className="px-3">
                                <span className="inline-block px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs font-mono font-medium">
                                  {detail.scoreA}-{detail.scoreB}
                                </span>
                              </div>
                              <div className={`flex-1 text-left ${detail.winner === 'B' ? 'font-bold text-gray-800 dark:text-gray-200' : 'text-gray-500'}`}>
                                {getPlayerNames(detail.playersB)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {isExpanded && match.status !== 'finished' && (
                      <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-center text-sm text-gray-500">
                        試合データはまだありません
                      </div>
                    )}
                    {divisionId === '1' && match.status === 'finished' && (
                      <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2 text-right">
                        <Link
                          href={`/st-league/${year}/matches/${gender}-${match.teamA}-vs-${match.teamB}`}
                          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          この対戦の詳細 →
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
              {matchesInDiv.length === 0 && (
                <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500">
                  まだ試合情報がありません
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function MatchesPage({ year, meta, divisions, matches, teams, playerMaps }: MatchesPageProps) {
  const [gender, setGender] = useState<Gender>('boys');
  const [divisionId, setDivisionId] = useState<string>(divisions[0]?.id ?? '1');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // タブ一覧（リーグ階層 + プレーオフ）を男女別に算出。
  // プレーオフはリーグ階層をまたぐため、その性別に試合がある場合のみ専用タブを足す。
  const tabsByGender = useMemo(() => {
    const build = (g: Gender) => {
      const base = divisions.map((d) => ({ id: d.id, name: d.name }));
      if (matches[g].some((m) => divisionOf(m) === PLAYOFF_ID)) {
        base.push({
          id: PLAYOFF_ID,
          name: meta?.playoff?.name ?? 'プレーオフ',
        });
      }
      return base;
    };
    return { boys: build('boys'), girls: build('girls') } as Record<Gender, { id: string; name: string }[]>;
  }, [divisions, matches, meta]);

  const activeTabs = tabsByGender[gender];
  // 性別を切り替えた際、選択中の division がそのタブ一覧に無ければ先頭にフォールバック
  const effectiveDivId = activeTabs.some((t) => t.id === divisionId) ? divisionId : (activeTabs[0]?.id ?? '1');

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const editionLabel = meta?.title ?? `STリーグ ${year}`;
  const pageTitle = `${editionLabel} 試合結果・順位表 | ソフトテニス情報`;
  const pageUrl = `https://softeni-pick.com/st-league/${year}/matches/`;
  const dateRange = meta?.period ? `${meta.period.start.replace(/-/g, '/')}〜${meta.period.end.replace(/-/g, '/')}` : '';

  return (
    <>
      <MetaHead
        title={pageTitle}
        description={`${editionLabel}（${dateRange}${meta?.venue ? ` / ${meta.venue}` : ''}）の男女・STリーグⅠ/Ⅱ別の試合結果と順位表。`}
        url={pageUrl}
      />
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SportsEvent',
              name: editionLabel,
              sport: 'ソフトテニス',
              ...sportsEventBaseFields,
              ...(meta?.period && {
                startDate: meta.period.start,
                endDate: meta.period.end ?? meta.period.start,
              }),
              location: buildEventPlace(meta?.venue, meta?.location),
              organizer: buildEventOrganizer('公益財団法人 日本ソフトテニス連盟', 'https://www.jsta.or.jp/'),
              description: `${editionLabel}の試合結果・対戦カード一覧。`,
              url: pageUrl,
            }),
          }}
        />
      </Head>
      <PageLayout maxWidth="4xl" className="space-y-6">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: 'STリーグ', href: '/st-league' },
            { label: `${year}`, href: `/st-league/${year}` },
            { label: '試合結果・順位表', href: `/st-league/${year}/matches` },
          ]}
        />

        <header>
          <h1 className="text-2xl font-bold">{editionLabel} 結果・順位表</h1>
          {(dateRange || meta?.venue) && (
            <p className="text-sm text-gray-500 mt-1">
              {dateRange}
              {meta?.venue && `　${meta.venue}`}
              {meta?.location && `（${meta.location}）`}
            </p>
          )}
          <p className="mt-2 text-gray-600 dark:text-gray-300">STリーグⅠ・Ⅱと男女別に、対戦成績・順位表を掲載しています。</p>
        </header>

        {/* 性別タブ */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setGender('boys')}
            className={`py-2 px-4 font-medium text-sm focus:outline-none ${
              gender === 'boys' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            男子
          </button>
          <button
            onClick={() => setGender('girls')}
            className={`py-2 px-4 font-medium text-sm focus:outline-none ${
              gender === 'girls' ? 'border-b-2 border-pink-500 text-pink-600 dark:text-pink-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            女子
          </button>
        </div>

        {/* リーグ（division）切替 + プレーオフ */}
        <div className="flex flex-wrap gap-2">
          {activeTabs.map((d) => {
            const active = d.id === effectiveDivId;
            const playoffTab = d.id === PLAYOFF_ID;
            return (
              <button
                key={d.id}
                onClick={() => setDivisionId(d.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                  active
                    ? playoffTab
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-400'
                }`}
              >
                {d.name}
              </button>
            );
          })}
        </div>

        {/* 全 gender×タブ のパネルをHTMLに出力し、非アクティブは hidden で隠す（SEO） */}
        {(['boys', 'girls'] as Gender[]).map((g) =>
          tabsByGender[g].map((tab) => {
            const active = g === gender && tab.id === effectiveDivId;
            return (
              <div key={`${g}-${tab.id}`} className={active ? '' : 'hidden'} aria-hidden={!active}>
                <MatchesPanel
                  year={year}
                  gender={g}
                  divisionId={tab.id}
                  meta={meta}
                  divisions={divisions}
                  matches={matches}
                  teams={teams}
                  playerMaps={playerMaps}
                  expanded={expanded}
                  toggle={toggle}
                />
              </div>
            );
          }),
        )}

        {/* プレーオフ案内 */}
        {meta?.playoff && (
          <section className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
            <h2 className="font-bold text-amber-800 dark:text-amber-300 mb-1">{meta.playoff.name}</h2>
            {meta.playoff.period && (
              <p className="text-sm text-amber-700 dark:text-amber-200">
                {meta.playoff.period.start.replace(/-/g, '/')}〜{meta.playoff.period.end.replace(/-/g, '/')}
                {meta.playoff.venue && `　${meta.playoff.venue}`}
              </p>
            )}
            {meta.playoff.description && <p className="text-sm text-amber-700 dark:text-amber-200 mt-1">{meta.playoff.description}</p>}
          </section>
        )}

        {/* 他ページ導線 */}
        <nav className="flex flex-wrap gap-3 pt-2">
          <a href={`/st-league/${year}`} className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
            ▶ {year}年度トップ（大会概要）
          </a>
          <a href={`/st-league/${year}/teams`} className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
            ▶ 出場チーム・選手を見る
          </a>
          <a href={`/st-league/${year}/analysis`} className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
            ▶ 選手別データ・分析を見る
          </a>
        </nav>
      </PageLayout>
    </>
  );
}

export const getStaticPaths = async () => ({
  paths: getStLeagueYears().map((y) => ({ params: { year: String(y) } })),
  fallback: false,
});

export const getStaticProps = async ({ params }: { params: { year: string } }) => {
  const year = params.year;
  const matches = loadMatches(year);
  const participants = loadParticipants(year);
  if (!matches || !participants) return { notFound: true };

  const meta = loadLeagueMeta(year);
  const divisions = getDivisions(meta);

  const playerMaps = {
    boys: buildPlayerMap(participants.boys),
    girls: buildPlayerMap(participants.girls),
  };

  return {
    props: {
      year: parseInt(year, 10),
      meta,
      divisions,
      matches,
      teams: participants,
      playerMaps,
    },
  };
};
