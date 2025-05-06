'use client';

import { getLiveData } from '@/lib/microcms';
import { LiveData } from '@/types/index';
import { useEffect, useState } from 'react';

export default function LiveResults({ playerId }: { playerId: string }) {
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null); // エラーメッセージを格納

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getLiveData();
        setLiveData(data);
        setError(null); // エラーが解消された場合、エラーメッセージをリセット
      } catch {
        setError('データの取得に失敗しました。');
      }
    };

    fetchData();
  }, []);

  if (error) return null;
  if (!liveData) return null;

  // 日本時間の現在時刻を取得
  const nowJST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));

  // 開催期間に該当するかどうかを判定
  const isOngoing = (() => {
    const start = new Date(liveData.startDate);
    const end = new Date(liveData.endDate);
    return nowJST >= start && nowJST <= end;
  })();

  if (!isOngoing) return null;

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
          最終更新: {new Date(liveData.updatedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
        </p>
      </div>
    </section>
  );
}
