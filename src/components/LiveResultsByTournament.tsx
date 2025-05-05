'use client';

import { useEffect, useState } from 'react';
import { getLiveData } from '@/lib/microcms';

interface PlayerInfo {
  id: string;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  team: string;
}

interface LiveData {
  tournament: string;
  updatedAt: string;
  players: {
    playerId: string;
    status: string;
    latestResult: string;
    nextMatch: string;
  }[];
}

export default function LiveResultsByTournament({ playersData }: { playersData: PlayerInfo[] }) {
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getLiveData();
        setLiveData(data);
        setError(null);
      } catch {
        setError('データの取得に失敗しました。');
      }
    };

    fetchData();
  }, []);

  if (error) return null;

  const todayJST = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const updatedAtJST = liveData
    ? new Date(liveData.updatedAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
    : null;

  const isToday = updatedAtJST === todayJST;

  let content;

  if (liveData && isToday && playersData?.length > 0) {
    content = (
      <>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          {liveData.tournament}
        </h3>
        <ul className="space-y-2 text-gray-700 dark:text-gray-300">
          {liveData.players.map((player, index) => {
            const playerInfo = playersData.find((p) => p.id === player.playerId);
            const playerName = playerInfo
              ? `${playerInfo.lastName}${playerInfo.firstName}`
              : player.playerId;

            return (
              <li key={index} className="mb-4">
                <div className="flex flex-col space-y-2">
                  <div className="flex justify-between">
                    <strong className="text-gray-800 dark:text-white">{playerName}</strong>
                  </div>
                  <div className="flex justify-between items-center space-x-4">
                    <div className="w-1/3 text-center text-gray-600 dark:text-gray-300">最新結果:</div>
                    <div className="flex-grow text-center text-gray-800 dark:text-white">
                      {player.latestResult}
                    </div>
                  </div>
                  <div className="flex justify-between items-center space-x-4">
                    <div className="w-1/3 text-center text-gray-600 dark:text-gray-300">次の試合:</div>
                    <div className="flex-grow text-center text-gray-800 dark:text-white">
                      {player.nextMatch}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 text-right text-sm text-gray-600 dark:text-gray-300">
          最終更新: {new Date(liveData.updatedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
        </div>
      </>
    );
  } else {
    content = (
      <p className="text-gray-700 dark:text-gray-300">
        現在、開催中の大会はありません。
      </p>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">🎾 大会速報</h2>
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
        {content}
      </div>
    </section>
  );
}
