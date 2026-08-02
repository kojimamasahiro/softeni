import type { GetStaticProps } from 'next';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { fetchBetaMatches, hasLiveMatchApi } from '../../../../lib/betaMatchesClient';
import { isDebugMode } from '../../../../lib/env';
import { isScoreSiteMode } from '../../../../lib/siteConfig';
import DevOnlyNotice from '../../../components/matches/DevOnlyNotice';
import { Game, Match } from '../../../types/database';

type MatchStatusInfo = {
  kind: 'not_started' | 'in_progress' | 'finished';
  label: string;
};

const getMatchStatusInfo = (match: Match): MatchStatusInfo => {
  if (!match.games || match.games.length === 0) {
    return { kind: 'not_started', label: '未開始' };
  }

  const gamesWonA = match.games.filter((game: Game) => game.winner_team === 'A').length;
  const gamesWonB = match.games.filter((game: Game) => game.winner_team === 'B').length;
  const requiredWins = Math.ceil(match.best_of / 2);

  if (gamesWonA >= requiredWins || gamesWonB >= requiredWins) {
    return { kind: 'finished', label: `終了 (${gamesWonA}-${gamesWonB})` };
  }

  const currentGame = match.games.find((game: Game) => !game.winner_team);
  if (currentGame) {
    return {
      kind: 'in_progress',
      label: `進行中 第${currentGame.game_number}ゲーム (${currentGame.points_a}-${currentGame.points_b})`,
    };
  }

  return { kind: 'in_progress', label: `${gamesWonA}-${gamesWonB}` };
};

const STATUS_BADGE_STYLES: Record<MatchStatusInfo['kind'], string> = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-50 text-blue-700',
  finished: 'bg-green-50 text-green-700',
};

const MatchStatusBadge = ({ status }: { status: MatchStatusInfo }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_STYLES[status.kind]}`}>
    {status.kind === 'in_progress' && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden="true" />}
    {status.label}
  </span>
);

// フォーカス時のキーボード操作向けリング（共通スタイル）
const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

const MatchList = () => {
  const canEditMatches = isDebugMode() && hasLiveMatchApi();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // 開発環境でない場合はアクセス拒否
  useEffect(() => {
    if (isDebugMode()) {
      fetchMatches();
    }
  }, []);

  if (!isDebugMode()) {
    return <DevOnlyNotice title="アクセス拒否" message="この機能は開発環境でのみ利用可能です。" />;
  }

  const fetchMatches = async () => {
    try {
      const loadedMatches = await fetchBetaMatches();
      setMatches(loadedMatches);
    } catch (error) {
      console.error('Failed to fetch matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteMatch = async (matchId: string) => {
    if (!canEditMatches) {
      alert('この環境ではマッチの削除はできません');
      return;
    }

    if (!confirm('本当にこのマッチを削除しますか？\n関連するゲームやポイントデータもすべて削除されます。')) {
      return;
    }

    setDeleting(matchId);
    try {
      const response = await fetch(`/api/matches/${matchId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // 一覧から削除
        setMatches(matches.filter((match) => match.id !== matchId));
      } else {
        const data = await response.json();
        alert(`削除に失敗しました: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to delete match:', error);
      alert('削除に失敗しました');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">マッチ一覧</h1>
        {canEditMatches ? (
          <Link
            href="/beta/matches/create"
            className={`inline-flex items-center justify-center rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 ${FOCUS_RING} focus-visible:ring-blue-400`}
          >
            新しいマッチを作成
          </Link>
        ) : (
          <span className="text-sm text-gray-500">静的公開中: 閲覧のみ</span>
        )}
      </div>

      <div className="grid gap-4">
        {matches.map((match) => {
          const status = getMatchStatusInfo(match);

          return (
            <div key={match.id} className="rounded-lg bg-white p-6 shadow-md">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">
                      {match.team_a} vs {match.team_b}
                    </h3>
                    <MatchStatusBadge status={status} />
                  </div>
                  <p className="mb-1 text-gray-600">{match.tournament_name}</p>
                  <p className="text-sm text-gray-500">{match.best_of}ゲームマッチ</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canEditMatches && (
                    <Link
                      href={`/beta/matches/${match.id}/input`}
                      className={`rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 ${FOCUS_RING} focus-visible:ring-green-400`}
                    >
                      記録入力
                    </Link>
                  )}
                  {canEditMatches && (
                    <Link
                      href={`/beta/matches/${match.id}/video-review`}
                      className={`rounded border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-100 ${FOCUS_RING} focus-visible:ring-indigo-400`}
                    >
                      動画レビュー
                    </Link>
                  )}
                  <Link
                    href={`/beta/matches/${match.id}`}
                    className={`rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 ${FOCUS_RING} focus-visible:ring-gray-400`}
                  >
                    詳細表示
                  </Link>
                  {canEditMatches && (
                    <button
                      onClick={() => deleteMatch(match.id)}
                      disabled={deleting === match.id}
                      aria-label={`${match.team_a} vs ${match.team_b} を削除`}
                      className={`rounded border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 ${FOCUS_RING} focus-visible:ring-red-400`}
                    >
                      {deleting === match.id ? '削除中...' : '削除'}
                    </button>
                  )}
                </div>
              </div>

              {/* ゲームスコア表示 */}
              {match.games && match.games.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                  {match.games.map((game: Game) => (
                    <div key={game.id} className="rounded bg-gray-50 px-2.5 py-1 text-sm">
                      <span className="mr-1.5 text-gray-500">G{game.game_number}</span>
                      <span className={game.winner_team === 'A' ? 'font-bold text-blue-700' : 'text-gray-700'}>{game.points_a}</span>
                      <span className="mx-0.5 text-gray-400">-</span>
                      <span className={game.winner_team === 'B' ? 'font-bold text-red-700' : 'text-gray-700'}>{game.points_b}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {matches.length === 0 && (
          <div className="py-12 text-center">
            <p className="mb-4 text-gray-500">まだマッチがありません</p>
            {canEditMatches && (
              <Link
                href="/beta/matches/create"
                className={`inline-flex items-center justify-center rounded bg-blue-500 px-6 py-2 text-white hover:bg-blue-600 ${FOCUS_RING} focus-visible:ring-blue-400`}
              >
                最初のマッチを作成
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchList;

export const getStaticProps: GetStaticProps = async () => {
  if (isScoreSiteMode()) {
    return { notFound: true };
  }

  return {
    props: {},
  };
};
