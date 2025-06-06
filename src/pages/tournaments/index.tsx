// pages/tournaments/index.tsx
import MetaHead from '@/components/MetaHead';
import fs from 'fs';
import { GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import path from 'path';

interface Tournament {
    id: string;
    name: string;
    years: number[];
    sortId: number;
}

export default function TournamentListPage({ tournaments }: { tournaments: Tournament[] }) {
    const pageUrl = `https://softeni-pick.com/tournaments`;

    return (
        <>
            <MetaHead
                title={"大会結果一覧 | ソフトテニス情報"}
                description={`過去の大会結果・試合成績を掲載`}
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
                            "headline": `大会結果一覧`,
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
                            "description": `過去の大会結果・試合成績を掲載`,
                        }),
                    }}
                ></script>

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
                                    "name": `大会結果一覧`,
                                    "item": "https://softeni-pick.com/tournaments",
                                }
                            ],
                        }),
                    }}
                ></script>
            </Head>

            <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-2xl font-bold mb-6">大会結果一覧 | ソフトテニス情報</h1>

                    <section className="mb-8 px-4">
                        <div className="space-y-8">
                            {tournaments.map((tournament) => (
                                <div key={tournament.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                                    <h2 className="text-xl flex font-semibold mb-4 border-b text-gray-800 dark:text-white">
                                        {tournament.name}
                                    </h2>

                                    <ul className="flex flex-wrap gap-2">
                                        {tournament.years.map((year) => (
                                            <li key={year}>
                                                <Link href={`/tournaments/${tournament.id}/${year}`}>
                                                    <span className="inline-block bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-3 py-1 rounded-full text-sm hover:opacity-80 transition">
                                                        {year}年
                                                    </span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}

export const getStaticProps: GetStaticProps = async () => {
    const basePath = path.join(process.cwd(), 'data/tournaments');
    const tournamentDirs = fs.readdirSync(basePath);
    const tournaments: Tournament[] = [];

    for (const tournamentId of tournamentDirs) {
        const metaPath = path.join(basePath, tournamentId, 'meta.json');
        const tournamentDir = path.join(basePath, tournamentId);

        if (!fs.existsSync(metaPath)) continue;

        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        const yearDirs = fs
            .readdirSync(tournamentDir)
            .filter((name) =>
                /^\d{4}$/.test(name) &&
                fs.statSync(path.join(tournamentDir, name)).isDirectory()
            );

        const years: number[] = [];

        for (const year of yearDirs) {
            const dataPath = path.join(tournamentDir, year, 'results.json');
            try {
                const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
                if (data.status === 'completed') {
                    years.push(parseInt(year, 10));
                }
            } catch (err) {
                console.warn(`読み込みエラー: ${tournamentId}/${year}`, err);
            }
        }

        if (years.length > 0) {
            tournaments.push({
                id: tournamentId,
                name: meta.name || tournamentId,
                years: years.sort((a, b) => b - a), // 新→旧
                sortId: meta.sortId ?? 9999,        // null/undefinedにも対応
            });
        }
    }

    tournaments.sort((a, b) => a.sortId - b.sortId);

    return {
        props: {
            tournaments,
        },
    };
};
