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
    info: TeamInfo;
    results: EventResult[];
};

export default function TeamResultsPage({ info, results }: Props) {
    const teamName = info.name;
    const pageUrl = `https://softeni.vercel.app/teams/${info.id}`;

    const calculateSummary = useMemo(() => {
        let champions = 0, runnersUp = 0, top8OrBetter = 0, totalPairs = 0;

        results.forEach(event => {
            const validResults = event.resultSummary.filter(r =>
                r.pair.every(pid => pid in info.players)
            );

            validResults.forEach(r => {
                const count = r.pair.length; // 1人 or 2人ペアの対応

                if (r.finalRound === '優勝') champions += count;
                if (r.finalRound === '準優勝') runnersUp += count;
                if (['優勝', '準優勝', 'ベスト4', 'ベスト8'].includes(r.finalRound)) {
                    top8OrBetter += count;
                }

                totalPairs++; // totalPairs はペアの数そのまま（ペア単位）
            });
        });

        return {
            tournaments: results.length,
            champions,
            runnersUp,
            top8OrBetter,
            totalPairs
        };
    }, [results, info.players]);


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
                event.matches
                    .filter(m => m.pair.some(pid => info.players[pid])) // 片方の選手が存在すればOK
                    .map(m => m.pair.join('-'))
            );

            const resultWithNames = event.resultSummary
                .map(r => {
                    const playerNames = r.pair
                        .map(pid => {
                            const player = info.players[pid];
                            return player ? player.lastName + player.firstName : null;
                        });

                    // 一部でもnull（＝存在しない選手）が含まれていたら除外
                    if (playerNames.includes(null)) {
                        return null;
                    }

                    return `${playerNames.join(' & ')}（${r.finalRound}）`;
                })
                .filter(Boolean) // null を除外
                .join('、');

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
                title={`${teamName} 所属別成績 | ソフトテニス情報`}
                description={`${teamName}の大会別成績、選手別勝敗、出場ペア数などの詳細を掲載。`}
                url={pageUrl}
            />

            <Head>
                <title>{teamName} 所属別成績 | ソフトテニス情報</title>
                <meta name="description" content={`${teamName}の大会別成績、選手別勝敗、出場ペア数などの詳細を掲載。`} />
                <meta property="og:title" content={`${teamName} 所属別成績`} />
                <meta property="og:description" content={`${teamName}の大会別成績、選手別勝敗、出場ペア数などの詳細を掲載。`} />
                <meta property="og:url" content={pageUrl} />
                <meta property="og:type" content="article" />
                <meta name="twitter:card" content="summary" />

                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "Article",
                            "headline": `${teamName} 所属別成績`,
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
                            "description": `${teamName}の大会別成績、選手別勝敗、出場ペア数などの詳細を掲載。`,
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
                                    "item": "https://softeni.vercel.app/",
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
                    <h1 className="text-2xl font-bold">{teamName} | 所属別成績</h1>

                    <TeamsYearlySummary summary={calculateSummary} />

                    <TeamsEventSummary overallTable={overallTable} />

                    <TeamsRanking statsList={statsList} />
                </div>
            </main>
        </>
    );
}

export const getStaticPaths: GetStaticPaths = async () => {
    const teamsDir = path.join(process.cwd(), 'data/teams');
    const teamDirs = fs.readdirSync(teamsDir).filter(file =>
        fs.statSync(path.join(teamsDir, file)).isDirectory()
    );

    const paths = teamDirs.map((teamId) => ({
        params: { teamId },
    }));

    return {
        paths,
        fallback: 'blocking',
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
            info,
            results,
        },
    };
};
