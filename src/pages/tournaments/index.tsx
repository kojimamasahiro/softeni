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
        <section className="p-6">
            <h1 className="text-2xl font-bold mb-4">🏆 大会結果一覧</h1>
            <ul className="space-y-6">
                {tournaments.map(tournament => (
                    <li key={tournament.id}>
                        <h2 className="text-xl font-semibold">{tournament.name}</h2>
                        <ul className="pl-4 list-disc">
                            {tournament.years.map(year => (
                                <li key={year}>
                                    <Link href={`/tournaments/${tournament.id}/${year}`}>
                                        <span className="text-blue-600 underline">{year}年の結果を見る</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </li>
                ))}
            </ul>
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

            const data = JSON.parse(fs.readFileSync(path.join(yearsPath, file), 'utf-8'));
            if (data.status === 'completed') {
                years.push(year);
            }
        }

        if (years.length > 0) {
            tournaments.push({
                id: tournamentId,
                name: meta.name || tournamentId,
                years: years.sort((a, b) => b - a), // 年順に並べる（新→旧）
                sortId: meta.sortId || 9999,
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
