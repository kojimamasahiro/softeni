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

  const { data: liveData, error, isLoading } = useSWR<LiveData>(
    isInRange ? 'liveData' : null,
    getLiveData,
    {
      dedupingInterval: 60000,
      revalidateOnFocus: false,
    }
  );

  if (!isInRange || error) return null;

  return (
    <section className="mb-8 p-4">
      <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">📢 大会速報</h2>

      <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm bg-white dark:bg-gray-800">
        {isLoading ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400 animate-pulse">
            大会速報を読み込み中です...
          </div>
        ) : liveData ? (() => {
          const playerLiveResult = liveData.players.find((player) => player.playerId === playerId);
          return playerLiveResult ? (
            <div className="space-y-3 text-gray-800 dark:text-gray-200">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">大会名</div>
                <div>{liveData.tournament}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">現在の状況</div>
                <div>{playerLiveResult.status}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">最新結果</div>
                <div>{playerLiveResult.latestResult}</div>
              </div>
              {/* もし nextMatch など追加するならここに */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 text-sm text-gray-500 dark:text-gray-400">
                最終更新: {new Date(liveData.updatedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              表示できる速報データがありません。
            </div>
          );
        })() : (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            表示できる速報データがありません。
          </div>
        )}
      </div>
    </section>
  );
}
