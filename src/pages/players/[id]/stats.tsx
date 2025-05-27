// pages/players/[id]/stats.tsx
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import path from "path";
import fs from "fs/promises";

type MatchStats = {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
};

type GameStats = {
  total: number;
  won: number;
  lost: number;
  gameRate: number;
};

type PartnerStats = {
  [partnerId: string]: {
    matches: MatchStats;
    games: GameStats;
  };
};

type YearStats = {
  [year: string]: {
    matches: MatchStats;
    games: GameStats;
  };
};

type PlayerStats = {
  totalMatches: number;
  wins: number;
  losses: number;
  totalWinRate: number;
  byPartner: PartnerStats;
  byYear: YearStats;
};

export default function PlayerStats({ stats }: { stats: PlayerStats }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-sm">
      <h1 className="text-xl font-bold mb-4">対戦成績</h1>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">■ 全体成績</h2>
        <ul className="list-disc list-inside">
          <li>試合数：{stats.totalMatches}</li>
          <li>勝敗：{stats.wins}勝 {stats.losses}敗</li>
          <li>勝率：{(stats.totalWinRate * 100).toFixed(1)}%</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">■ パートナー別成績</h2>
        <table className="w-full border text-center">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1">パートナー</th>
              <th className="border px-2 py-1">試合数</th>
              <th className="border px-2 py-1">勝率</th>
              <th className="border px-2 py-1">ゲーム勝率</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(stats.byPartner).map(([partnerId, data]) => (
              <tr key={partnerId}>
                <td className="border px-2 py-1">{partnerId}</td>
                <td className="border px-2 py-1">{data.matches.total}</td>
                <td className="border px-2 py-1">
                  {(data.matches.winRate * 100).toFixed(1)}%
                </td>
                <td className="border px-2 py-1">
                  {(data.games.gameRate * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="font-semibold mb-2">■ 年度別成績</h2>
        <table className="w-full border text-center">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1">年度</th>
              <th className="border px-2 py-1">試合数</th>
              <th className="border px-2 py-1">勝率</th>
              <th className="border px-2 py-1">ゲーム勝率</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(stats.byYear).map(([year, data]) => (
              <tr key={year}>
                <td className="border px-2 py-1">{year}</td>
                <td className="border px-2 py-1">{data.matches.total}</td>
                <td className="border px-2 py-1">
                  {(data.matches.winRate * 100).toFixed(1)}%
                </td>
                <td className="border px-2 py-1">
                  {(data.games.gameRate * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// --- 動的にJSON読み込み ---
export async function getStaticPaths() {
  const dir = path.join(process.cwd(), "data/players");
  const files = await fs.readdir(dir);

  // ディレクトリだけに限定
  const paths = [];
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      paths.push({ params: { id: file } });
    }
  }

  return { paths, fallback: false };
}

export async function getStaticProps({ params }: { params: { id: string } }) {
  const statsPath = path.join(
    process.cwd(),
    "data/players",
    params.id,
    "analysis.json"
  );
  const file = await fs.readFile(statsPath, "utf-8");
  const stats: PlayerStats = JSON.parse(file);

  return {
    props: { stats },
  };
}
