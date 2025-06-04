// ディレクトリ構成:
// src/pages/tournaments/[tournamentId]/[year].tsx

import MetaHead from '@/components/MetaHead';
import { getAllPlayers } from '@/lib/players';
import { PlayerInfo, TournamentMeta, TournamentYearData, MatchOpponent } from '@/types/index';
import fs from 'fs';
import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import path from 'path';
import { useEffect, useState } from 'react';

interface TournamentYearResultPageProps {
    year: string;
    meta: TournamentMeta;
    data: TournamentYearData;
    allPlayers: PlayerInfo[];
    unknownPlayers: Record<string, { firstName: string; lastName: string; team: string }>;
}

export default function TournamentYearResultPage({
    year,
    meta,
    data,
    allPlayers,
    unknownPlayers,
}: TournamentYearResultPageProps) {
    const pageUrl = `https://softeni-pick.com/tournaments/${meta.id}/${year}`;

    const resultPriority = (result: string) => {
        if (result.includes('優勝') && !result.includes('準')) return 1;
        if (result.includes('準優勝')) return 2;
        if (result.includes('ベスト4')) return 3;
        if (result.includes('ベスト8')) return 4;
        return 99;
    };

    const teamGroups: Record<string, {
        team: string;
        members: { result: string; resultOrder: number; displayParts: { text: string; id?: string; noLink?: boolean }[] }[];
        bestRank: number;
    }> = {};

    for (const entry of data.results ?? []) {
        const players = entry.playerIds.map((id) => {
            const player = allPlayers.find((p) => p.id === id);
            if (player) {
                return {
                    id,
                    name: `${player.lastName}${player.firstName}`,
                    team: player.team ?? '所属不明',
                    noLink: false,
                };
            } else {
                const unknown = unknownPlayers[id];
                return {
                    id,
                    name: unknown ? `${unknown.lastName}${unknown.firstName}` : id,
                    team: unknown?.team ?? '所属不明',
                    noLink: true,
                };
            }
        });

        const resultOrder = resultPriority(entry.result);

        if (players.length === 1 || players[0].team === players[1].team) {
            const team = players[0].team;
            const displayParts = players.flatMap((p, i) => [
                { text: p.name, id: p.noLink ? undefined : p.id, noLink: p.noLink },
                ...(i < players.length - 1 ? [{ text: '・' }] : []),
            ]);

            if (!teamGroups[team]) {
                teamGroups[team] = { team, members: [], bestRank: resultOrder };
            }
            teamGroups[team].members.push({ result: entry.result, resultOrder, displayParts });
            teamGroups[team].bestRank = Math.min(teamGroups[team].bestRank, resultOrder);
        } else {
            for (const p of players) {
                const displayParts = [{ text: p.name, id: p.noLink ? undefined : p.id, noLink: p.noLink }];

                if (!teamGroups[p.team]) {
                    teamGroups[p.team] = { team: p.team, members: [], bestRank: resultOrder };
                }

                teamGroups[p.team].members.push({ result: entry.result, resultOrder, displayParts });
                teamGroups[p.team].bestRank = Math.min(teamGroups[p.team].bestRank, resultOrder);
            }
        }
    }

    const sortedTeams = Object.values(teamGroups)
        .sort((a, b) => {
            if (a.bestRank !== b.bestRank) return a.bestRank - b.bestRank;
            return a.team.localeCompare(b.team, 'ja');
        });

    const matches = data.matches ?? [];
    const allNames = [...new Set(matches.map(m => m.name))];
    const totalMatches = matches.filter(m => m.result === 'win').length;

    function findOpponentById(id: string): MatchOpponent | null {
        for (const match of matches) {
            for (const op of match.opponents) {
                if (op.playerId === id || op.tempId === id) {
                    return op;
                }
            }
        }
        return null;
    }

    const [filter, setFilter] = useState<'all' | 'top8' | 'winners'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    useEffect(() => {
        const q = searchQuery.toLowerCase();
        if (q.length > 0) {
            setSuggestions(allNames.filter(name => name.toLowerCase().includes(q)).slice(0, 5));
        } else {
            setSuggestions([]);
        }
    }, [searchQuery]);

    const seenPlayers = new Set<string>(); // 一度カウントしたIDを記録
    const teamCounter: Record<string, number> = {};

    let totalGamesWon = 0;
    let totalGamesLost = 0;

    for (const match of matches) {
        if (match.result === 'win') {
            const won = parseInt(match.games.won, 10);
            const lost = parseInt(match.games.lost, 10);
            if (!isNaN(won)) totalGamesWon += won;
            if (!isNaN(lost)) totalGamesLost += lost;
        }

        // pair 側
        for (const id of match.pair) {
            if (!seenPlayers.has(id)) {
                const player = findOpponentById(id);
                if (player?.team) {
                    teamCounter[player.team] = (teamCounter[player.team] || 0) + 1;
                    seenPlayers.add(id);
                }
            }
        }

        // opponents 側
        for (const op of match.opponents) {
            const id = op.playerId || op.tempId;
            if (!seenPlayers.has(id)) {
                teamCounter[op.team] = (teamCounter[op.team] || 0) + 1;
                seenPlayers.add(id);
            }
        }
    }
    const totalPlayers = seenPlayers.size;
    const sortedTeamEntries = Object.entries(teamCounter).sort((a, b) => b[1] - a[1]);
    const uniqueTeams = sortedTeamEntries.length;

    const topTeams = Object.entries(teamCounter)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5); // 上位5
    return (
        <>
            <MetaHead
                title={`${meta.name} ${year}年 大会結果 | ソフトテニス情報`}
                description={`${meta.name} ${year}年の大会結果・試合成績を掲載。開催地や日程、選手ごとの成績も確認できます。`}
                url={pageUrl}
                type="article"
            />

            <Head>
                {/* Article 構造化データ */}
                <script type="application/ld+json" dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Article",
                        "headline": `${meta.name} ${year}年 大会結果`,
                        "author": { "@type": "Person", "name": "Softeni Pick" },
                        "publisher": { "@type": "Organization", "name": "Softeni Pick" },
                        "datePublished": new Date().toISOString().split('T')[0],
                        "dateModified": new Date().toISOString().split('T')[0],
                        "inLanguage": "ja",
                        "mainEntityOfPage": { "@type": "WebPage", "@id": pageUrl },
                        "description": `${meta.name} ${year}年 のソフトテニス大会結果を確認できます。過去の大会結果も掲載`,
                    })
                }} />

                {/* Breadcrumb 構造化データ */}
                <script type="application/ld+json" dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "BreadcrumbList",
                        "itemListElement": [
                            {
                                "@type": "ListItem",
                                "position": 1,
                                "name": "ホーム",
                                "item": "https://softeni-pick.com/"
                            },
                            {
                                "@type": "ListItem",
                                "position": 2,
                                "name": "大会結果一覧",
                                "item": "https://softeni-pick.com/tournaments"
                            },
                            {
                                "@type": "ListItem",
                                "position": 3,
                                "name": `${meta.name} ${year}年`,
                                "item": pageUrl
                            }
                        ]
                    })
                }} />
            </Head>


            <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-2xl font-bold mb-4">
                        {meta.name} {year}年 大会結果
                    </h1>

                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                        <span className="inline-block mr-4">{data.location}</span>
                        <span>{data.startDate}〜{data.endDate}</span>
                    </p>

                    <section className="mb-10">
                        {sortedTeams.map(({ team, members }) => {
                            const grouped = members.reduce((acc, m) => {
                                if (!acc[m.result]) acc[m.result] = [];
                                acc[m.result].push(m);
                                return acc;
                            }, {} as Record<string, typeof members>);

                            const resultEntries = Object.entries(grouped)
                                .map(([result, list]) => ({ result, resultOrder: resultPriority(result), members: list }))
                                .sort((a, b) => a.resultOrder - b.resultOrder);

                            return (
                                <div key={team} className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                                        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                                            {team}
                                        </h3>
                                    </div>
                                    <ul className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                                        {resultEntries.map(({ result, members }, i) => (
                                            <li key={i} className="flex px-4 py-2 gap-4">
                                                <div className="w-20 text-right text-gray-600 dark:text-gray-300">{result}</div>
                                                <div className="text-gray-900 dark:text-gray-100 flex flex-wrap gap-x-1">
                                                    {members.map((m, j) => (
                                                        <span key={j}>
                                                            {m.displayParts.map((part, k) =>
                                                                part.id && !part.noLink ? (
                                                                    <Link
                                                                        key={k}
                                                                        href={`/players/${part.id}/results`}
                                                                        className="text-inherit underline underline-offset-2 decoration-dotted hover:decoration-solid"
                                                                    >
                                                                        {part.text}
                                                                    </Link>
                                                                ) : (
                                                                    <span key={k}>{part.text}</span>
                                                                )
                                                            )}
                                                            {j < members.length - 1 && <span>、</span>}
                                                        </span>
                                                    ))}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })}
                    </section>

                    <div className="text-right mt-10 mb-2">
                        <Link href="/tournaments" className="text-sm text-blue-500 hover:underline">
                            大会結果一覧
                        </Link>
                    </div>

                    {matches.length > 0 && (
                        <section className="mb-10">
                            <div className="mb-6 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm bg-white dark:bg-gray-800 p-4">
                                <h2 className="text-lg font-bold mb-3">大会統計</h2>
                                <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                                    <div>エントリー数：{totalPlayers}人</div>
                                    <div>出場チーム数：{uniqueTeams}チーム</div>
                                    <div>総試合数：{totalMatches}試合</div>
                                    <div>総ゲーム数（獲得率）：{totalGamesWon} - {totalGamesLost}（{((totalGamesWon / (totalGamesWon + totalGamesLost)) * 100).toFixed(2)}%）</div>
                                    <div className="mt-2">
                                        <div className="font-semibold mb-1">チーム別エントリー数ランキング</div>
                                        <ul className="list-disc list-inside space-y-1">
                                            {topTeams.slice(0, 5).map(([team, count], index) => (
                                                <div key={team}>
                                                    {index + 1}位：{team}（{count}人）
                                                </div>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <h2 className="text-lg font-bold mb-3">対戦詳細</h2>
                            <div className="mb-4 flex flex-wrap items-center gap-2">
                                {/* 検索ボックスjsx */}
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="選手名や所属で検索"
                                    className="h-9 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded shadow-sm dark:bg-gray-900 dark:text-white"
                                />

                                {suggestions.length > 0 && (
                                    <ul className="mt-1 bg-white dark:bg-gray-800 border rounded shadow text-sm">
                                        {suggestions.map((name, i) => (
                                            <li
                                                key={i}
                                                onClick={() => setSearchQuery(name)}
                                                className="px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                                            >
                                                {name}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {/* フィルターボタン */}
                                <button
                                    onClick={() => setFilter('all')}
                                    className={`h-9 px-3 text-sm rounded border ${filter === 'all'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100'
                                        }`}
                                >
                                    全て
                                </button>
                                <button
                                    onClick={() => setFilter('top8')}
                                    className={`h-9 px-3 text-sm rounded border ${filter === 'top8'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100'
                                        }`}
                                >
                                    ベスト8以上
                                </button>
                            </div>

                            {[...new Set(matches
                                .slice()
                                .sort((a: any, b: any) => (a.entryNo ?? Infinity) - (b.entryNo ?? Infinity))
                                .map((m: any) => m.name))].map(name => {
                                    const [isOpen, setIsOpen] = useState(false);

                                    const matchGroup = matches
                                        .filter((m: any) => m.name === name)
                                        .sort((a: any, b: any) => (a.entryNo ?? Infinity) - (b.entryNo ?? Infinity));

                                    let finalLabel = '';
                                    if (matchGroup.length > 0) {
                                        const lastMatch = matchGroup[matchGroup.length - 1];
                                        if (lastMatch.round === '決勝' && lastMatch.result === 'win') {
                                            finalLabel = '優勝';
                                        } else if (lastMatch.round === '決勝' && lastMatch.result === 'lose') {
                                            finalLabel = '準優勝';
                                        } else if (lastMatch.round === '準決勝' && lastMatch.result === 'lose') {
                                            finalLabel = 'ベスト4';
                                        } else if (lastMatch.round === '準々決勝' && lastMatch.result === 'lose') {
                                            finalLabel = 'ベスト8';
                                        } else if (lastMatch.result === 'lose') {
                                            finalLabel = `${lastMatch.round}敗退`;
                                        }
                                    }

                                    const nameLower = name.toLowerCase();
                                    const queryLower = searchQuery.toLowerCase();

                                    const show = (() => {
                                        const matchesQuery = nameLower.includes(queryLower);
                                        if (!matchesQuery) return false;

                                        if (filter === 'all') return true;
                                        if (filter === 'winners') return ['優勝', '準優勝'].includes(finalLabel);
                                        if (filter === 'top8') return ['優勝', '準優勝', 'ベスト4', 'ベスト8'].includes(finalLabel);
                                        return true;
                                    })();

                                    if (!show) return null;

                                    return (
                                        <div key={name} className="mb-6 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm bg-white dark:bg-gray-800">
                                            <button
                                                onClick={() => setIsOpen(prev => !prev)}
                                                className="w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                                            >
                                                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex justify-between items-center">
                                                    <span>
                                                        {name}
                                                        {finalLabel && (
                                                            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">{finalLabel}</span>
                                                        )}
                                                    </span>
                                                    <span className="ml-2 text-xs">{isOpen ? '▲' : '▼'}</span>
                                                </h3>
                                            </button>

                                            {isOpen && (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm table-fixed border-collapse">
                                                        <thead className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100">
                                                            <tr>
                                                                <th className="w-1/5 px-4 py-2 border-b border-gray-200 dark:border-gray-600 text-left">ラウンド</th>
                                                                <th className="w-2/5 px-4 py-2 border-b border-gray-200 dark:border-gray-600 text-left">対戦相手</th>
                                                                <th className="w-1/5 px-4 py-2 border-b border-gray-200 dark:border-gray-600 text-left">勝敗</th>
                                                                <th className="w-1/5 px-4 py-2 border-b border-gray-200 dark:border-gray-600 text-left">スコア</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {matchGroup.map((m: any, i: number) => (
                                                                <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                                                                    <td className="px-4 py-2 break-words">{m.round}</td>
                                                                    <td className="px-4 py-2 break-words">
                                                                        {m.opponents.map((op: any, j: number) => (
                                                                            <span key={j}>
                                                                                {op.lastName}（{op.team}）{j < m.opponents.length - 1 && '・'}
                                                                            </span>
                                                                        ))}
                                                                    </td>
                                                                    <td className="px-4 py-2">{m.result === 'win' ? '勝ち' : '負け'}</td>
                                                                    <td className="px-4 py-2">{m.games.won}-{m.games.lost}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                        </section>
                    )}
                </div>
            </main>
        </>
    );
}

export const getStaticPaths: GetStaticPaths = async () => {
    const basePath = path.join(process.cwd(), 'data/tournaments');
    const tournamentDirs = fs.readdirSync(basePath);
    const paths: { params: { tournamentId: string; year: string } }[] = [];

    for (const tournamentId of tournamentDirs) {
        const yearsPath = path.join(basePath, tournamentId, 'years');
        if (!fs.existsSync(yearsPath)) continue;

        const yearFiles = fs.readdirSync(yearsPath).filter(file => file.endsWith('.json'));
        for (const file of yearFiles) {
            const year = file.replace('.json', '');
            paths.push({ params: { tournamentId, year } });
        }
    }

    return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async (context) => {
    const { tournamentId, year } = context.params as { tournamentId: string; year: string };

    const basePath = path.join(process.cwd(), 'data/tournaments');
    const playersPath = path.join(process.cwd(), 'data/players');
    const allPlayers = getAllPlayers();

    try {
        const meta = JSON.parse(fs.readFileSync(path.join(basePath, tournamentId, 'meta.json'), 'utf-8'));
        const data = JSON.parse(fs.readFileSync(path.join(basePath, tournamentId, 'years', `${year}.json`), 'utf-8'));
        const unknownPlayers = JSON.parse(fs.readFileSync(path.join(playersPath, 'unknown.json'), 'utf-8'));

        return { props: { year, meta, data, allPlayers, unknownPlayers } };
    } catch (err) {
        console.error(err);
        return { notFound: true };
    }
};
