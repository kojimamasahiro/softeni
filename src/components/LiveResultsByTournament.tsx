'use client';

import { LIVE_PERIOD } from '@/config/livePeriod';
import { getLiveData } from '@/lib/microcms';
import { LiveData, PlayerInfo } from '@/types/index';
import Link from 'next/link';
import useSWR from 'swr';

const getFormattedDateTime = (date: Date) => {
  const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
  const day = daysOfWeek[date.getDay()];
  const month = date.getMonth() + 1;
  const dayOfMonth = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes().toString().padStart(2, '0');
  return `${month}月${dayOfMonth}日(${day}) ${hour}時${minute}分`;
};

const SectionWrapper = ({ children }: { children: React.ReactNode }) => (
  <section className="mb-8 px-4">
    <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">📢 大会速報</h2>
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">{children}</div>
  </section>
);

const Message = ({ text }: { text: string }) => (
  <div className="py-6 text-gray-600 dark:text-gray-300 whitespace-pre-line">{text}</div>
);


export default function LiveResultsByTournament({ playersData }: { playersData: PlayerInfo[] }) {
  const nowJST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const startDate = new Date(LIVE_PERIOD.startDate);
  const endDate = new Date(LIVE_PERIOD.endDate);
  const isInRange = nowJST >= startDate && nowJST <= endDate;

  const { data: liveData, error, isLoading } = useSWR<LiveData>(
    isInRange ? 'liveData' : null,
    getLiveData,
    { dedupingInterval: 60000, revalidateOnFocus: false }
  );

if (!isInRange) {
  const scheduledPlayers = [
    '1. 上松俊貴',
    '73. 上岡俊介',
    '145. 橋場柊一郎',
    '216. 広岡宙',
    '217. 丸山海斗',
    '288. 内田理久',
  ];
  const message =
    nowJST > endDate
      ? '次回の大会速報までお待ちください。'
      : `次回の大会速報は${getFormattedDateTime(startDate)}に開始予定です。\n\n第32回 全日本シングルス選手権大会
以下の出場予定の選手を速報予定です。\n- ${scheduledPlayers.join('\n- ')}`;
  return (
    <SectionWrapper>
      <Message text={message} />
    </SectionWrapper>
  );
}


  if (error || playersData.length === 0) return null;

  return (
    <SectionWrapper>
      {isLoading ? (
        <Message text="⏳ 大会速報を読み込み中です..." />
      ) : liveData ? (
        <>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
            {liveData.tournament}
          </h3>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-3 text-sm font-semibold text-gray-600 dark:text-gray-300 border-b pb-1 mb-2">
              <div className="text-center">選手</div>
              <div className="text-center col-span-2">最新結果</div>
            </div>
            {liveData.players.map((player, index) => {
              const playerInfo = playersData.find((p) => p.id === player.playerId);
              const playerName = playerInfo
                ? `${playerInfo.lastName}${playerInfo.firstName}`
                : player.playerId;

              return (
                <div
                  key={index}
                  className="grid grid-cols-3 items-center py-1 border-b border-gray-200 dark:border-gray-700"
                >
                  <Link
                    href={`/players/${player.playerId}/results`}
                    className="text-center text-inherit underline underline-offset-2 decoration-dotted hover:decoration-solid"
                  >
                    {playerName}
                  </Link>
                  <div className="col-span-2 text-center text-gray-800 dark:text-white">
                    {player.latestResult}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 text-right text-sm text-gray-600 dark:text-gray-300">
            最終更新: {getFormattedDateTime(new Date(liveData.updatedAt))}
          </div>
        </>
      ) : (
        <Message text="📭 表示できる速報データがありません。" />
      )}
    </SectionWrapper>
  );
}
