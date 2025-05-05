// ディレクトリ構成:
// src/pages/tournaments/[tournamentId]/[year].tsx

import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { GetStaticPaths, GetStaticProps } from 'next';
import { getAllPlayers } from '@/lib/players';
import { PlayerInfo } from '@/types/types';
import Head from 'next/head';
import MetaHead from '@/components/MetaHead';

interface Result {
    playerIds: string[];
    result: string;
}

interface TournamentYearData {
    status: string;
    startDate: string;
    endDate: string;
    location: string;
    url?: string;
    results: Result[];
}

interface TournamentMeta {
    id: string;
    sortId: number;
    name: string;
    region: string;
    type: string;
    category: string;
    officialUrl: string;
    isMajorTitle: boolean;
}

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
                                    "name": `大会結果一覧`,
                                    "item": "https://softeni.vercel.app/tournaments",
                                },
                                {
                                    "@type": "ListItem",
                                    "position": 3,
                                    "name": `試合結果`,
                                    "item": `${meta.name} ${year}年`,
                                },
                            ],
                        }),
                    }}
                />
            </Head>

            <section className="px-4 py-8 max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold mb-3 text-gray-900 dark:text-white">
                    {meta.name} {year}年 結果
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                    <span className="inline-block mr-4">📍 {data.location}</span>
                    <span>📅 {data.startDate}〜{data.endDate}</span>
                </p>

                <ul className="space-y-4">
                    {data.results.map((entry, i) => (
                        <li
                            key={i}
                            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm p-5 rounded-lg"
                        >
                            <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
                                {entry.result}
                            </div>
                            <div className="text-gray-800 dark:text-gray-200 text-base">
                                {entry.playerIds
                                    .map(id => {
                                        const player: PlayerInfo | undefined = allPlayers.find(p => p.id === id);
                                        return player ? `${player.lastName} ${player.firstName}` : id;
                                    })
                                    .join('・')}
                            </div>
                        </li>
                    ))}
                </ul>

                <div className="text-right mt-8 mb-2">
                    <Link href={`/tournaments`} className="text-sm text-blue-500 hover:underline">
                        大会結果一覧
                    </Link>
                </div>
            </section>
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
