import { GetStaticProps } from 'next';
import Link from 'next/link';

import { createServerClient } from '@/lib/supabase';

import { Match } from '../../../types/database';

interface Props {
  matches: Match[];
  lastUpdated: string;
}

export default function MatchesListISR({ matches, lastUpdated }: Props) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            試合結果一覧 (ISR版)
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            最終更新: {new Date(lastUpdated).toLocaleString('ja-JP')}
          </p>
          <p className="mt-1 text-xs text-blue-600">
            ⚡ Incremental Static Regeneration - 60秒ごとに自動更新
          </p>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {matches.map((match) => (
              <li key={match.id}>
                <Link
                  href={`/beta/matches-results/${match.id}`}
                  className="block p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900">
                        {match.team_a} vs {match.team_b}
                      </h3>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {match.tournament_name && (
                          <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                            {match.tournament_name}
                          </span>
                        )}
                        {match.tournament_generation && (
                          <span className="inline-flex px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                            {match.tournament_generation}
                          </span>
                        )}
                        {match.tournament_category && (
                          <span className="inline-flex px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                            {match.tournament_category}
                          </span>
                        )}
                      </div>
                      {match.round_name && (
                        <p className="mt-2 text-sm text-gray-600">
                          {match.round_name}
                        </p>
                      )}
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-sm text-gray-500">
                        Best of {match.best_of}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(match.created_at).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                  </div>

                  {/* ゲームスコア概要 */}
                  {match.games && match.games.length > 0 && (
                    <div className="mt-3 flex space-x-2">
                      {match.games.slice(0, 5).map((game) => (
                        <div
                          key={game.id}
                          className="flex items-center text-sm font-mono"
                        >
                          <span className="text-gray-500">
                            G{game.game_number}:
                          </span>
                          <span
                            className={`ml-1 ${
                              game.points_a > game.points_b
                                ? 'text-green-600 font-bold'
                                : 'text-gray-700'
                            }`}
                          >
                            {game.points_a}
                          </span>
                          <span className="mx-1 text-gray-400">-</span>
                          <span
                            className={`${
                              game.points_b > game.points_a
                                ? 'text-green-600 font-bold'
                                : 'text-gray-700'
                            }`}
                          >
                            {game.points_b}
                          </span>
                        </div>
                      ))}
                      {match.games.length > 5 && (
                        <span className="text-sm text-gray-400">
                          ...+{match.games.length - 5}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {matches.length === 0 && (
            <div className="py-12 text-center">
              <div className="text-gray-400 text-6xl mb-4">📊</div>
              <p className="text-gray-500 text-lg">
                まだ試合が登録されていません
              </p>
              <p className="text-gray-400 text-sm mt-2">
                新しい試合が追加されると、自動的に表示されます
              </p>
            </div>
          )}
        </div>

        {/* ISR説明 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h2 className="text-sm font-medium text-blue-900 mb-2">
            🚀 Incremental Static Regeneration (ISR) について
          </h2>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• このページは60秒ごとに自動で再生成されます</li>
            <li>• 初回表示は高速（事前ビルド済み）</li>
            <li>• 新しいデータは背景で更新され、次回リクエスト時に反映</li>
            <li>• CDNキャッシュとの組み合わせで最適なパフォーマンス</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  try {
    console.log('🔄 ISR: Generating static page...');

    const supabase = createServerClient();

    const { data: matches, error } = await supabase
      .from('matches')
      .select('*, games(*)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }

    const safeMatches = matches || [];

    console.log(`✅ ISR: Generated page with ${safeMatches.length} matches`);

    return {
      props: {
        matches: safeMatches,
        lastUpdated: new Date().toISOString(),
      },
      // ISR設定
      revalidate: 120, // 120秒ごとに再生成
    };
  } catch (error) {
    console.error('❌ getStaticProps error:', error);

    // エラー時も空のページを返す
    return {
      props: {
        matches: [],
        lastUpdated: new Date().toISOString(),
      },
      revalidate: 30, // エラー時は30秒で再試行
    };
  }
};
