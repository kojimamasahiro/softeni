// src/pages/teams/2025/[teamId].tsx
import MetaHead from '@/components/MetaHead';
import TeamsEventSummary from '@/components/TeamsEventSummary';
import TeamsRanking from '@/components/TeamsRanking';
import TeamsYearlySummary from '@/components/TeamsYearlySummary';
import fs from 'fs';
import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import path from 'path';
import { useMemo } from 'react';

type Player = {
    firstName: string;
    lastName: string;
};

type TeamInfo = {
    id: string;
    name: string;
    players: Record<string, Player>;
};

type EventResult = {
    tournament: string;
    resultSummary: {
        pair: string[];
        finalRound: string;
    }[];
    matches: {
        round: string;
        pair: string[];
        opponents: any[];
        result: 'win' | 'lose';
        games: { won: string; lost: string };
    }[];
};

type PlayerStats = {
    id: string;
    name: string;
    appearances: number;
    wins: number;
    losses: number;
    winsByRound: Record<string, number>;
};

type Props = {
    year: string;
    info: TeamInfo;
    results: EventResult[];
};

export default function TeamResultsPage({ year, info, results }: Props) {
    const teamName = info.name;
    const pageUrl = `https://softeni-pick.com/teams/${year}/${info.id}`;

    const calculateSummary = useMemo(() => {
        let champions = 0, runnersUp = 0, top8OrBetter = 0, totalPairs = 0;

        results.forEach(event => {
            const rounds = event.resultSummary.map(r => r.finalRound);
            if (rounds.includes('優勝')) champions++;
            if (rounds.includes('準優勝')) runnersUp++;
            top8OrBetter = rounds.filter(r => ['優勝', '準優勝', 'ベスト4', 'ベスト8'].includes(r)).length;
        });

        return {
            year,
            tournaments: results.length,
            champions,
            runnersUp,
            top8OrBetter,
            totalPairs,
        };
    }, [year, results]);

    const calculatePlayerStats = useMemo(() => {
        const stats: Record<string, PlayerStats> = {};

        const initializePlayerStats = (pid: string, player: Player) => {
            if (!stats[pid]) {
                stats[pid] = {
                    id: pid,
                    name: `${player.lastName} ${player.firstName}`,
                    appearances: 0,
                    wins: 0,
                    losses: 0,
                    winsByRound: {},
                };
            }
        };

        results.forEach(event => {
            event.resultSummary.forEach(summry => {
                summry.pair.forEach(pid => {
                    const player = info.players?.[pid];
                    if (!player) return;
                    initializePlayerStats(pid, player);

                    if (summry.finalRound) {
                        stats[pid].winsByRound[summry.finalRound] = (stats[pid].winsByRound[summry.finalRound] || 0) + 1;
                    }
                });
            });

            const countedPlayers = new Set<string>(); // このevent内でappearancesを数えたプレイヤーID

            event.matches.forEach(match => {
                match.pair.forEach(pid => {
                    const player = info.players?.[pid];
                    if (!player) return;
                    initializePlayerStats(pid, player);

                    // 勝敗数は全試合でカウント
                    if (match.result === 'win') stats[pid].wins++;
                    else stats[pid].losses++;

                    // 出場回数はイベントごとに1回だけ
                    if (!countedPlayers.has(pid)) {
                        stats[pid].appearances++;
                        countedPlayers.add(pid);
                    }
                });
            });

        });

        return stats;
    }, [results, info.players]);

    const overallTable = useMemo(() => (
        results.map(event => {
            const uniquePairs = new Set(
                event.matches.map(m => m.pair.join('-')) // 例: ["p1", "p2"] → "p1-p2"
            );

            // 選手名を取得して結果に含める
            const resultWithNames = event.resultSummary.map(r => {
                const playerNames = r.pair
                    .map(pid => info.players[pid]?.lastName + ' ' + info.players[pid]?.firstName)
                    .filter(Boolean) // 存在しない選手を除外
                    .join(' & '); // ペアを "A & B" の形式で結合
                return `${r.finalRound} (${playerNames})`;
            }).join('、');

            return {
                name: event.tournament,
                results: resultWithNames,
                count: uniquePairs.size,
            };
        })
    ), [results, info.players]);

    const statsList = useMemo(
        () => Object.values(calculatePlayerStats).sort((a, b) => b.wins - a.wins),
        [calculatePlayerStats]
    );

    return (
        <>
            <MetaHead
                title={`{teamName} {year}年度所属別成績 | ソフトテニス情報`}
                description={`${teamName}の${year}年度における大会別成績、選手別勝敗、出場ペア数などの詳細を掲載。`}
                url={`pageUrl`}
            />

            <Head>
                <title>{teamName} {year}年度所属別成績 | ソフトテニス情報</title>
                <meta name="description" content={`${teamName}の${year}年度における大会別成績、選手別勝敗、出場ペア数などの詳細を掲載。`} />
                <meta property="og:title" content={`${teamName} ${year}年度所属別成績`} />
                <meta property="og:description" content={`${teamName}の${year}年度における大会別成績、選手別勝敗、出場ペア数などの詳細を掲載。`} />
                <meta property="og:url" content={pageUrl} />
                <meta property="og:type" content="article" />
                <meta name="twitter:card" content="summary" />

                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "Article",
                            "headline": `${teamName} ${year}年度所属別成績`,
                            "author": {
                                "@type": "Organization",
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
                            "description": `${teamName}の${year}年度における大会別成績、選手別勝敗、出場ペア数などの詳細を掲載。`,
                            "about": {
                                "@type": "SportsTeam",
                                "name": teamName,
                                "url": pageUrl,
                            },
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
                                    "item": "https://softeni-pick.com/",
                                },
                                {
                                    "@type": "ListItem",
                                    "position": 2,
                                    "name": teamName,
                                    "item": pageUrl,
                                },
                            ],
                        }),
                    }}
                />
            </Head>

            <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
                <div className="max-w-3xl mx-auto space-y-6">
                    <h1 className="text-2xl font-bold">{teamName} - {year}年度成績</h1>

                    <TeamsYearlySummary summary={calculateSummary} />
                    <TeamsEventSummary overallTable={overallTable} />
                    <TeamsRanking statsList={statsList} />
                </div>
            </main>
        </>
    );
}

export const getStaticPaths: GetStaticPaths = async () => {
    return {
        paths: [], // 初期パスは空にする
        fallback: 'blocking', // 動的にページを生成
    };
};

export const getStaticProps: GetStaticProps = async (context) => {
    const { teamId } = context.params as { teamId: string };
    const infoPath = path.join(process.cwd(), `data/teams/${teamId}/information.json`);
    const resultsPath = path.join(process.cwd(), `data/teams/${teamId}/results.json`);

    // データが存在しない場合は 404 を返す
    if (!fs.existsSync(infoPath) || !fs.existsSync(resultsPath)) {
        return { notFound: true };
    }

    // 必要なデータを読み込む
    const info: TeamInfo = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
    const results: EventResult[] = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

    return {
        props: {
            "2025": teamId,
            info,
            results,
        },
    };
};
