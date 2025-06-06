// src/pages/tournaments/[tournamentId]/[year]/data.tsx
import MetaHead from '@/components/MetaHead';
import fs from 'fs';
import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import path from 'path';

interface PlayerEntry {
    id: number | string;
    name: string;
    information: {
        lastName: string;
        firstName: string;
        team: string;
        tempId: string;
    }[];
}

interface TournamentMeta {
    id: string;
    sortId: number;
    name: string;
    region: string;
    type: string;
    category: string;
    officialUrl?: string;
    isMajorTitle?: boolean;
}

interface MatchResult {
    round: string;
    player1: {
        entryNo: number;
        won: number;
        lost: number;
    };
    player2: {
        entryNo: number;
        won: number;
        lost: number;
    };
    winner: number;
}

interface Props {
    tournamentId: string;
    year: string;
    entries: PlayerEntry[];
    matches: MatchResult[] | null;
    meta: TournamentMeta;
}

export default function EntryDataPage({ tournamentId, year, entries, matches, meta }: Props) {
    const jsonStr = JSON.stringify(entries, null, 2);

    return (
        <>
            <MetaHead
                title={`${meta.name} ${year} 大会データ（JSON形式） - ソフトテニス情報`}
                description={`${meta.name} ${year} 年の大会出場選手データ（JSON形式）を掲載。非営利目的の活用が可能です。`}
                url={`https://softeni-pick.com/tournaments/${tournamentId}/${year}/data`}
                type="article"
            />

            <Head>
                <title>{meta.name} {year} 大会データ（JSON形式） | ソフトテニス情報</title>
                <meta name="description" content={`${meta.name} ${year} 年の大会データ（JSON形式）を掲載しています。`} />
            </Head>

            <main className="max-w-3xl mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold mb-4">{meta.name} {year} 大会データ（JSON形式）</h1>

                <div className="text-sm text-gray-700 mb-6">
                    <p>このページでは、Softeni Pick が独自にまとめた「<strong>{meta.name} {year}</strong>」の大会データ（JSON形式）を掲載しています。</p>
                    <ul className="list-disc list-inside mt-2">
                        <li>個人利用、非営利目的での使用は自由です。</li>
                        <li>学校・団体名や選手名の表記は一部誤記の可能性があります。</li>
                        <li>公式発表とは異なる場合がありますので、正式な情報は各大会主催者の発表をご確認ください。</li>
                    </ul>
                </div>

                <h2 className="text-xl font-semibold mt-10 mb-4">出場選手</h2>

                <pre className="bg-gray-100 p-4 rounded text-sm max-h-[300px] overflow-auto">
                    {jsonStr}
                </pre>

                <button
                    onClick={() => {
                        navigator.clipboard.writeText(jsonStr);
                        alert('クリップボードにコピーしました');
                    }}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    JSONをコピー
                </button>

                {matches && (
                    <>
                        <h2 className="text-xl font-semibold mt-10 mb-4">対戦結果</h2>

                        <pre className="bg-gray-100 p-4 rounded text-sm max-h-[300px] overflow-auto">
                            {JSON.stringify(matches, null, 2)}
                        </pre>

                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(JSON.stringify(matches, null, 2));
                                alert('クリップボードにコピーしました');
                            }}
                            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            JSONをコピー（対戦結果）
                        </button>
                    </>
                )}

                <div className="mt-6 text-xs text-gray-500 border-t pt-4">
                    <p>
                        ※ 本データはSofteni Pickが独自に整理・構築したものであり、正確性を保証するものではありません。<br />
                        ご利用にあたって生じた不利益等について、当サイトは一切の責任を負いません。
                    </p>
                </div>
            </main>
        </>
    );
}

export const getStaticPaths: GetStaticPaths = async () => {
    const baseDir = path.join(process.cwd(), 'data/tournaments');
    const tournamentIds = fs.readdirSync(baseDir);

    const paths: { params: { tournamentId: string; year: string } }[] = [];

    for (const tid of tournamentIds) {
        const yearDir = path.join(baseDir, tid);
        if (!fs.statSync(yearDir).isDirectory()) continue;

        const years = fs.readdirSync(yearDir);
        for (const y of years) {
            const entryPath = path.join(yearDir, y, 'entries.json');
            if (fs.existsSync(entryPath)) {
                paths.push({
                    params: {
                        tournamentId: tid,
                        year: y,
                    },
                });
            }
        }
    }

    return {
        paths,
        fallback: false,
    };
};

export const getStaticProps: GetStaticProps = async (context) => {
    const { tournamentId, year } = context.params as { tournamentId: string; year: string };
    const basePath = path.join(process.cwd(), 'data/tournaments', tournamentId);

    const meta = JSON.parse(fs.readFileSync(path.join(basePath, 'meta.json'), 'utf-8'));
    const entries = JSON.parse(fs.readFileSync(path.join(basePath, year, 'entries.json'), 'utf-8'));

    const matchesPath = path.join(basePath, year, 'matches.json');
    const matches = fs.existsSync(matchesPath)
        ? JSON.parse(fs.readFileSync(matchesPath, 'utf-8'))
        : null; // 存在しなければ null

    return {
        props: {
            tournamentId,
            year,
            entries,
            matches,
            meta,
        },
    };
};
