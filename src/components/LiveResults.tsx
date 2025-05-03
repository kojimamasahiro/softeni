'use client';

import { useEffect, useState } from 'react';
import { getLiveData } from '@/lib/microcms';

interface LiveData {
  tournament: string;
  updatedAt: string;
  players: Players[];
}

interface Players {
  playerId: string;
  status: string;
  latestResult: string;
  nextMatch: string;
}

export default function LiveResults({ playerId }: { playerId: string }) {
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null); // エラーメッセージを格納

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getLiveData();
        setLiveData(data);
        setError(null);  // エラーが解消された場合、エラーメッセージをリセット
      } catch (error: unknown) {
        setError('データの取得に失敗しました。');
      }
    };

    fetchData();
  }, []);

  if (error) {
    return null; // エラーが発生した場合は何も表示しない
  }

  if (!liveData) return null;

  const todayJST = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const updatedAtJST = new Date(liveData.updatedAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });

  if (updatedAtJST !== todayJST) {
    return null; // 日本時間で今日でなければ非表示
  }

  const playerLiveResult = liveData.players.find((player) => player.playerId === playerId);

  if (!playerLiveResult) return null;

  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">🎾 大会速報</h2>
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md overflow-x-auto">
        <p className="text-gray-700 dark:text-gray-300"><strong>大会名:</strong> {liveData.tournament}</p>
        <p className="text-gray-700 dark:text-gray-300"><strong>現在の状況:</strong> {playerLiveResult.status}</p>
        <p className="text-gray-700 dark:text-gray-300"><strong>最新結果:</strong> {playerLiveResult.latestResult}</p>
        <p className="text-gray-700 dark:text-gray-300"><strong>次の試合:</strong> {playerLiveResult.nextMatch}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          最終更新: {new Date(liveData.updatedAt).toLocaleString('ja-JP')}
        </p>
      </div>
    </section>
  );
}
