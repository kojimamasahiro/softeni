'use client';

import { LIVE_PERIOD } from '@/config/livePeriod';
import { getLiveData } from '@/lib/microcms';
import { LiveData } from '@/types/index';
import useSWR from 'swr';

export default function LiveResults({ playerId }: { playerId: string }) {
  const nowJST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const startDate = new Date(LIVE_PERIOD.startDate);
  const endDate = new Date(LIVE_PERIOD.endDate);
  const isInRange = nowJST >= startDate && nowJST <= endDate;

  // SWRでデータ取得（isInRangeがtrueのときのみフェッチ）
  const { data: liveData, error, isLoading } = useSWR<LiveData>(
    isInRange ? 'liveData' : null,
    getLiveData,
    {
      dedupingInterval: 60000, // 同じキーのリクエストは30秒以内にまとめる
      revalidateOnFocus: false, // タブ復帰時の再取得を無効化
    }
  );

  if (!isInRange || error) return null;

  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">🎾 大会速報</h2>
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md overflow-x-auto">
        {isLoading ? (
          <div className="text-center py-6 text-gray-600 dark:text-gray-300">
            ⏳ 大会速報を読み込み中です...
          </div>
        ) : liveData ? (() => {
          const playerLiveResult = liveData.players.find((player) => player.playerId === playerId);
          return playerLiveResult ? (
            <>
              <p className="text-gray-700 dark:text-gray-300"><strong>大会名:</strong> {liveData.tournament}</p>
              <p className="text-gray-700 dark:text-gray-300"><strong>現在の状況:</strong> {playerLiveResult.status}</p>
              <p className="text-gray-700 dark:text-gray-300"><strong>最新結果:</strong> {playerLiveResult.latestResult}</p>
              {/* <p className="text-gray-700 dark:text-gray-300"><strong>次の試合:</strong> {playerLiveResult.nextMatch}</p> */}
              <p className="text-sm text-gray-500 dark:text-gray-400">
                最終更新: {new Date(liveData.updatedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
              </p>
            </>
          ) : (
            <div className="text-center py-6 text-gray-600 dark:text-gray-300">
              📭 表示できる速報データがありません。
            </div>
          );
        })() : (
          <div className="text-center py-6 text-gray-600 dark:text-gray-300">
            📭 表示できる速報データがありません。
          </div>
        )}
      </div>
    </section>
  );
}
