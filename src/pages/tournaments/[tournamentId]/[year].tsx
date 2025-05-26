// ディレクトリ構成:
// src/pages/tournaments/[tournamentId]/[year].tsx

import MetaHead from '@/components/MetaHead';
import { getAllPlayers } from '@/lib/players';
import { PlayerInfo, TournamentMeta, TournamentYearData } from '@/types/index';
import fs from 'fs';
import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import path from 'path';

export default function TournamentYearResultPage({
    year,
    meta,
    data,
    allPlayers,
}: {
    year: string;
    meta: TournamentMeta;
    data: TournamentYearData;
    allPlayers: PlayerInfo[];
}) {
    const pageUrl = `https://softeni.vercel.app/tournaments/${meta.id}/${year}`;

    return (
        <>
            <MetaHead
                title={`${meta.name} ${year}年 大会結果 | ソフトテニス情報`}
                description={`${meta.name} ${year}年の大会結果・試合成績を掲載。開催地や日程、選手ごとの成績も確認できます。`}
                url={pageUrl}
                type="article"
            />

            <Head>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "Article",
                            "headline": `${meta.name} ${year}年 大会結果`,
                            "author": {
                                "@type": "Person",
                                "name": "Softeni Pick",
                            },
                            "publisher": {
                                "@type": "Organization",
                                "name": "Softeni Pick",
                            },
                            "datePublished": new Date().toISOString().split('T')[0],
                            "dateModified": new Date().toISOString().split('T')[0],
                            "inLanguage": "ja",
                            "mainEntityOfPage": {
                                "@type": "WebPage",
                                "@id": pageUrl,
                            },
                            "description": `${meta.name} ${year}年 のソフトテニス大会結果を確認できます。過去の大会結果も掲載`,
                        }),
                    }}
                />

                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "BreadcrumbList",
                            "itemListElement": [
                                {
                                    "@type": "ListItem",
                                    "position": 1,
                                    "name": "ホーム",
                                    "item": "https://softeni.vercel.app/",
                                },
                                {
                                    "@type": "ListItem",
                                    "position": 2,
                                    "name": "大会結果一覧",
                                    "item": "https://softeni.vercel.app/tournaments",
                                },
                                {
                                    "@type": "ListItem",
                                    "position": 3,
                                    "name": `${meta.name} ${year}年`,
                                    "item": `https://softeni.vercel.app/tournaments/${meta.id}/${year}`,
                                },
                            ],
                        }),
                    }}
                />
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

                        <ul className="text-sm">
                            {(() => {
                                const resultPriority = (result: string) => {
                                    if (result.includes('優勝') && !result.includes('準')) return 1;
                                    if (result.includes('準優勝')) return 2;
                                    if (result.includes('ベスト4')) return 3;
                                    if (result.includes('ベスト8')) return 4;
                                    return 99;
                                };

                                const playersFlat = data.results.flatMap((entry) =>
                                    entry.playerIds.map((id) => {
                                        const player = allPlayers.find((p) => p.id === id);
                                        return {
                                            id: player?.id ?? id,
                                            result: entry.result,
                                            resultOrder: resultPriority(entry.result),
                                            name: player ? `${player.lastName}${player.firstName}` : id,
                                            team: player?.team || '所属不明',
                                        };
                                    })
                                );

                                const groupedByTeam: {
                                    [team: string]: {
                                        team: string;
                                        members: { id: string; name: string; result: string; resultOrder: number }[];
                                        bestRank: number;
                                    };
                                } = {};

                                for (const p of playersFlat) {
                                    if (!groupedByTeam[p.team]) {
                                        groupedByTeam[p.team] = {
                                            team: p.team,
                                            members: [],
                                            bestRank: p.resultOrder,
                                        };
                                    }
                                    groupedByTeam[p.team].members.push({
                                        id: p.id,
                                        name: p.name,
                                        result: p.result,
                                        resultOrder: p.resultOrder,
                                    });
                                    groupedByTeam[p.team].bestRank = Math.min(
                                        groupedByTeam[p.team].bestRank,
                                        p.resultOrder
                                    );
                                }

                                return Object.values(groupedByTeam)
                                    .sort((a, b) => {
                                        if (a.bestRank !== b.bestRank) {
                                            return a.bestRank - b.bestRank;
                                        }
                                        return a.team.localeCompare(b.team, 'ja');
                                    })
                                    .map(({ team, members }) => {
                                        // 成績でグループ化（リンク付き名も保持）
                                        const groupedByResult: {
                                            [result: string]: { id: string; name: string }[];
                                        } = {};
                                        members.forEach((m) => {
                                            if (!groupedByResult[m.result]) groupedByResult[m.result] = [];
                                            groupedByResult[m.result].push({ id: m.id, name: m.name });
                                        });

                                        const resultEntries = Object.entries(groupedByResult).map(
                                            ([result, players]) => ({
                                                result,
                                                players,
                                                resultOrder: resultPriority(result),
                                            })
                                        );
                                        resultEntries.sort((a, b) => a.resultOrder - b.resultOrder);

                                        return (
                                            <div
                                                key={team}
                                                className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm"
                                            >
                                                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                                                    <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                                                        {team}
                                                    </h3>
                                                </div>
                                                <ul className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                                                    {resultEntries.map(({ result, players }, i) => (
                                                        <li key={i} className="flex px-4 py-2 gap-4">
                                                            <div className="w-20 text-right text-gray-600 dark:text-gray-300">
                                                                {result}
                                                            </div>
                                                            <div className="flex flex-wrap gap-x-1 text-gray-900 dark:text-gray-100">
                                                                {players.map((p, j) => (
                                                                    <span key={p.id}>
                                                                        <Link
                                                                            href={`/players/${p.id}`}
                                                                            className="text-inherit underline underline-offset-2 decoration-dotted hover:decoration-solid"
                                                                        >
                                                                            {p.name}
                                                                        </Link>
                                                                        {j < players.length - 1 && '、'}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        );
                                    });
                            })()}

                        </ul>


                    </section>
                    <div className="text-right mt-10 mb-2">
                        <Link href="/tournaments" className="text-sm text-blue-500 hover:underline">
                            大会結果一覧
                        </Link>
                    </div>
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

    return {
        paths,
        fallback: false
    };
};

export const getStaticProps: GetStaticProps = async (context) => {
    const { tournamentId, year } = context.params as { tournamentId: string; year: string };

    const basePath = path.join(process.cwd(), 'data/tournaments');

    const allPlayers = getAllPlayers();

    try {
        const meta = JSON.parse(
            fs.readFileSync(path.join(basePath, tournamentId, 'meta.json'), 'utf-8')
        );
        const data = JSON.parse(
            fs.readFileSync(path.join(basePath, tournamentId, 'years', `${year}.json`), 'utf-8')
        );

        return {
            props: {
                year,
                meta,
                data,
                allPlayers,
            }
        };
    } catch (err) {
        console.error(err);
        return { notFound: true };
    }
};
