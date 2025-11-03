import { GetStaticPaths, GetStaticProps } from 'next';
import Link from 'next/link';

import { createServerClient } from '@/lib/supabase';
import {
  generateTournamentUrlFromMatch,
  getTournamentInfoSSR,
  TournamentInfo,
} from '@/lib/tournamentHelpers';

import { Game, Match, Point } from '../../../../types/database';

interface PublicMatchDetailProps {
  match: Match;
  tournamentInfo: TournamentInfo | null;
  lastUpdated: string;
}

const PublicMatchDetail = ({
  match,
  tournamentInfo,
  lastUpdated,
}: PublicMatchDetailProps) => {
  // マッチデータから完全なURLを生成
  const fullTournamentUrl = generateTournamentUrlFromMatch(match);
  const getMatchWinner = () => {
    if (!match?.games) return null;

    const gamesWonA = match.games.filter(
      (game: Game) => game.winner_team === 'A',
    ).length;
    const gamesWonB = match.games.filter(
      (game: Game) => game.winner_team === 'B',
    ).length;
    const requiredWins = Math.ceil(match.best_of / 2);

    if (gamesWonA >= requiredWins) return 'A';
    if (gamesWonB >= requiredWins) return 'B';
    return null;
  };

  const getResultTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      winner: '決定打',
      forced_error: 'ミス誘発',
      unforced_error: '凡ミス',
      net: 'ネット',
      out: 'アウト',
    };
    return labels[type] || type;
  };

  const getTotalPoints = () => {
    if (!match?.games) return 0;
    return match.games.reduce(
      (sum, game) => sum + (game.points?.length || 0),
      0,
    );
  };

  const getTotalRallies = () => {
    if (!match?.games) return 0;
    return match.games.reduce(
      (sum, game) =>
        sum +
        (game.points?.reduce(
          (pSum, point) => pSum + (point.rally_count || 0),
          0,
        ) || 0),
      0,
    );
  };

  if (!match) return <div className="p-6">Match not found</div>;

  const matchWinner = getMatchWinner();

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <Link
          href="/beta/matches-results"
          className="text-blue-500 hover:underline"
        >
          ← 試合一覧に戻る
        </Link>
        <p className="text-sm text-gray-500">
          最終更新:{' '}
          {new Date(lastUpdated).toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Tokyo',
          })}
        </p>
      </div>

      {/* マッチ情報 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-2xl font-bold mb-4">
          {match.team_a} vs {match.team_b}
        </h1>

        {/* 大会情報 */}
        <div className="mb-4">
          {/* 大会名表示 */}
          <div className="flex items-center gap-2 mb-2">
            {tournamentInfo && fullTournamentUrl ? (
              <Link
                href={fullTournamentUrl}
                className="text-blue-600 hover:underline font-medium"
              >
                {tournamentInfo.meta.name}
              </Link>
            ) : tournamentInfo ? (
              <span className="font-medium text-gray-800">
                {tournamentInfo.meta.name}
              </span>
            ) : (
              <span className="font-medium text-gray-800">
                {match.tournament_name || '大会名不明'}
              </span>
            )}
          </div>

          {/* 回戦情報表示のみ */}
          <div className="flex flex-wrap gap-2 mb-2">
            {match.round_name && (
              <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                {match.round_name}
              </span>
            )}
          </div>
        </div>

        {matchWinner && (
          <div className="bg-green-100 border border-green-400 rounded p-4">
            <p className="text-lg font-semibold text-green-800">
              🏆 {matchWinner === 'A' ? match.team_a : match.team_b} の勝利！
            </p>
          </div>
        )}
      </div>

      {/* ゲーム結果サマリー */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">ゲーム結果</h2>
        <div className="grid gap-4">
          {match.games?.map((game: Game) => (
            <div key={game.id} className="border rounded p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">第{game.game_number}ゲーム</h3>
                {game.winner_team && (
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                    {game.winner_team === 'A' ? match.team_a : match.team_b}{' '}
                    勝利
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold mb-4">
                <span
                  className={game.winner_team === 'A' ? 'text-green-600' : ''}
                >
                  {game.points_a}
                </span>
                {' - '}
                <span
                  className={game.winner_team === 'B' ? 'text-green-600' : ''}
                >
                  {game.points_b}
                </span>
              </div>

              {/* ポイント詳細 */}
              {game.points && game.points.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">ポイント詳細</h4>
                  <div className="space-y-1">
                    {game.points.map((point: Point) => (
                      <div
                        key={point.id}
                        className="flex items-center gap-4 text-sm p-2 bg-gray-50 rounded"
                      >
                        <span className="font-medium">
                          #{point.point_number}
                        </span>
                        <span className="bg-blue-100 px-2 py-1 rounded">
                          {point.winner_team === 'A'
                            ? match.team_a
                            : match.team_b}
                        </span>
                        <span>
                          {getResultTypeLabel(point.result_type || '')}
                        </span>
                        <span>{point.rally_count}ラリー</span>
                        {point.winner_player && (
                          <span className="text-blue-600">
                            {point.winner_player}
                          </span>
                        )}
                        {point.first_serve_fault && (
                          <span className="text-orange-600 text-xs">
                            1stフォルト
                          </span>
                        )}
                        {point.double_fault && (
                          <span className="text-red-600 text-xs">
                            ダブルフォルト
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 統計情報 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">統計情報</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded">
            <div className="text-2xl font-bold">{getTotalPoints()}</div>
            <div className="text-sm text-gray-600">総ポイント数</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded">
            <div className="text-2xl font-bold">
              {match.games?.filter((game) => game.winner_team === 'A').length} -{' '}
              {match.games?.filter((game) => game.winner_team === 'B').length}
            </div>
            <div className="text-sm text-gray-600">ゲーム数</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded">
            <div className="text-2xl font-bold">{getTotalRallies()}</div>
            <div className="text-sm text-gray-600">総ラリー数</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ISR実装: 静的パス生成
export const getStaticPaths: GetStaticPaths = async () => {
  try {
    const supabase = createServerClient();

    // 最新50件のマッチIDを取得してプリビルド
    const { data: matches } = await supabase
      .from('matches')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(50);

    const paths = (matches || []).map((match) => ({
      params: { matchId: match.id.toString() },
    }));

    return {
      paths,
      fallback: 'blocking', // 新しいマッチは動的生成
    };
  } catch (error) {
    console.error('getStaticPaths error:', error);
    return {
      paths: [],
      fallback: 'blocking',
    };
  }
};

// ISR実装: 静的プロパティ生成
export const getStaticProps: GetStaticProps<PublicMatchDetailProps> = async ({
  params,
}) => {
  try {
    const matchId = params?.matchId as string;

    if (!matchId) {
      return { notFound: true };
    }

    const supabase = createServerClient();

    // マッチデータを取得
    const { data: match, error } = await supabase
      .from('matches')
      .select(
        `
        *,
        games(*, points(*))
      `,
      )
      .eq('id', matchId)
      .single();

    if (error || !match) {
      console.error('Match not found:', matchId, error);
      return { notFound: true };
    }

    // 大会情報を取得（サーバーサイド用関数を使用）
    let tournamentInfo: TournamentInfo | null = null;
    if (match.tournament_name) {
      try {
        tournamentInfo = await getTournamentInfoSSR(match.tournament_name);
      } catch (error) {
        console.error('Tournament info fetch failed:', error);
        // 大会情報の取得に失敗してもマッチデータは表示する
      }
    }

    return {
      props: {
        match,
        tournamentInfo,
        lastUpdated: new Date().toISOString(),
      },
      // ISR設定: 1分ごとに再生成（詳細ページはあまり変更されないため）
      revalidate: 60,
    };
  } catch (error) {
    console.error('getStaticProps error:', error);
    return { notFound: true };
  }
};

export default PublicMatchDetail;
