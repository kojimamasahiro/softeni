'use client';

import { LIVE_PERIOD } from '@/config/livePeriod';
import { getLiveData } from '@/lib/microcms';
import { LiveData, PlayerInfo } from '@/types/index';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function LiveResultsByTournament({ playersData }: { playersData: PlayerInfo[] }) {
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInRange, setIsInRange] = useState(false);

  // useEffect内で`nowJST`を計算してisInRangeを更新
  useEffect(() => {
    const nowJST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const startDate = new Date(LIVE_PERIOD.startDate);
    const endDate = new Date(LIVE_PERIOD.endDate);

    setIsInRange(nowJST >= startDate && nowJST <= endDate);
  }, []);  // 空の依存配列で初回レンダリング時のみ実行

  useEffect(() => {
    if (!isInRange) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await getLiveData();
        setLiveData(data);
      } catch {
        setError('データの取得に失敗しました。');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isInRange]);  // isInRangeが変わった時に再実行されるように

  if (!isInRange || error || playersData.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">🎾 大会速報</h2>
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
        {isLoading ? (
          <div className="text-center py-6 text-gray-600 dark:text-gray-300">
            ⏳ 大会速報を読み込み中です...
          </div>
        )  : liveData ? (
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
                      <div className="flex items-center gap-2">
                        <strong className="text-gray-800 dark:text-white">{playerName}</strong>
                        -
                        <Link
                          href={`/players/${player.playerId}/results`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          詳細
                        </Link>
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
        ) : (
          <div className="text-center py-6 text-gray-600 dark:text-gray-300">
            📭 表示できる速報データがありません。
          </div>
        )}
      </div>
    </section>
  );
}
