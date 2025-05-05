// pages/tournaments/index.tsx
import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { GetStaticProps } from 'next';

interface Tournament {
    id: string;
    name: string;
    years: number[];
    sortId: number;
}

export default function TournamentListPage({ tournaments }: { tournaments: Tournament[] }) {
    return (
        <section className="p-6 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-center">🏆 大会結果一覧</h1>

            <div className="space-y-8">
                {tournaments.map((tournament) => (
                    <div key={tournament.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <h2 className="text-xl font-semibold mb-2 border-b pb-1">{tournament.name}</h2>
                        <ul className="list-disc list-inside space-y-1">
                            {tournament.years.map((year) => (
                                <li key={year}>
                                    <Link href={`/tournaments/${tournament.id}/${year}`}>
                                        <span className="text-blue-600 hover:underline">{year}年の結果を見る</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </section>
    );
}

export const getStaticProps: GetStaticProps = async () => {
    const basePath = path.join(process.cwd(), 'data/tournaments');
    const tournamentDirs = fs.readdirSync(basePath);
    const tournaments: Tournament[] = [];

    for (const tournamentId of tournamentDirs) {
        const metaPath = path.join(basePath, tournamentId, 'meta.json');
        const yearsPath = path.join(basePath, tournamentId, 'years');

        if (!fs.existsSync(metaPath) || !fs.existsSync(yearsPath)) continue;

        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        const yearFiles = fs.readdirSync(yearsPath).filter(f => f.endsWith('.json'));

        const years: number[] = [];

        for (const file of yearFiles) {
            const year = parseInt(file.replace('.json', ''), 10);
            if (isNaN(year)) continue;

            try {
                const data = JSON.parse(fs.readFileSync(path.join(yearsPath, file), 'utf-8'));
                if (data.status === 'completed') {
                    years.push(year);
                }
            } catch (err) {
                console.warn(`読み込みエラー: ${tournamentId}/${file}`, err);
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
            tournaments: tournaments.map(({ sortId, ...rest }) => rest),
        },
    };
};
