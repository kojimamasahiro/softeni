// src/components/InternationalTournaments.tsx
import ResultsTable from '@/components/ResultsTable';
import { MatchResult, Stage, Tournament } from '@/types/index';


interface PlayerMatchesData {
  player: string;
  matches: Tournament[];
}

export default function InternationalTournaments({ playerData }: { playerData: PlayerMatchesData }) {
  // playerData.matchesが存在するか確認
  if (!playerData || !playerData.matches) {
    return <div>データがありません。</div>;
  }

  const internationalMatches = playerData.matches.filter(m => 
    m.location?.includes('韓国') || m.location?.includes('中国') || m.location?.includes('アジア') || m.location?.includes('世界')
  );

  return (
    <section className="mb-8 px-4">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">🌏 国際大会</h2>
      {internationalMatches.length > 0 ? (
        internationalMatches.map((tournament, index) => (
          <div
            key={index}
            className="mb-6 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm bg-white dark:bg-gray-800"
          >
            <h3 className="text-lg font-bold mb-2">{tournament.tournament}</h3>
            {tournament.dateRange && (
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">日程：{tournament.dateRange}</div>
            )}
            {tournament.location && (
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">開催地：{tournament.location}</div>
            )}
            {tournament.finalResult && (
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">最終結果：{tournament.finalResult}</div>
            )}
            {tournament.link && (
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                <a href={tournament.link} target="_blank" rel="noopener noreferrer" className="underline text-blue-600 dark:text-blue-400">
                  大会ページ
                </a>
              </div>
            )}

            {tournament.format === 'combined' && (
              <>
                {tournament.groupStage && (
                  <div className="mb-3">
                    <h4 className="font-semibold mb-1">グループステージ</h4>
                    <ResultsTable results={tournament.groupStage.results} />
                  </div>
                )}
                {tournament.finalStage && (
                  <div className="mb-3">
                    <h4 className="font-semibold mb-1">決勝トーナメント</h4>
                    <ResultsTable results={tournament.finalStage.results} />
                  </div>
                )}
              </>
            )}

            {tournament.format !== 'combined' && tournament.results && (
              <div className="mb-3">
                <ResultsTable results={tournament.results} />
              </div>
            )}
          </div>
        ))
      ) : (
        <p>国際大会のデータがありません。</p>
      )}
    </section>
  );
}
