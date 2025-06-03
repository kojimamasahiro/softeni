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

    return (
        <>
            <MetaHead
                title={`${meta.name} ${year}年 大会結果 | ソフトテニス情報`}
                description={`${meta.name} ${year}年の大会結果・試合成績を掲載。開催地や日程、選手ごとの成績も確認できます。`}
                url={pageUrl}
                type="article"
            />

            <Head>
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
                            <h2 className="text-lg font-bold mb-3">対戦詳細</h2>
{[...new Set(matches
    .slice()
    .sort((a: any, b: any) => (a.entryNo ?? Infinity) - (b.entryNo ?? Infinity))
    .map((m: any) => m.name))].map(name => (
    <div key={name} className="mb-6">
        <h3 className="text-base font-semibold mb-2">{name}</h3>
        <table className="w-full text-sm border border-gray-300 dark:border-gray-700">
            <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                    <th className="border px-2 py-1">ラウンド</th>
                    <th className="border px-2 py-1">対戦相手</th>
                    <th className="border px-2 py-1">勝敗</th>
                    <th className="border px-2 py-1">スコア</th>
                </tr>
            </thead>
            <tbody>
                {matches
                    .filter((m: any) => m.name === name)
                    .sort((a: any, b: any) => (a.entryNo ?? Infinity) - (b.entryNo ?? Infinity))
                    .map((m: any, i: number) => (
                        <tr key={i}>
                            <td className="border px-2 py-1">{m.round}</td>
                            <td className="border px-2 py-1">
                                {m.opponents.map((op: any, j: number) => (
                                    <span key={j}>{op.lastName}（{op.team}）{j < m.opponents.length - 1 && '・'}</span>
                                ))}
                            </td>
                            <td className="border px-2 py-1">{m.result === 'win' ? '勝ち' : '負け'}</td>
                            <td className="border px-2 py-1">{m.games.won}-{m.games.lost}</td>
                        </tr>
                    ))}
            </tbody>
        </table>
    </div>
))}
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

