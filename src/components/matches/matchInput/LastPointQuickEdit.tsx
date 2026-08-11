import { getResultTypeLabel } from '../../../../lib/matchLogic';
import type { Game, Point } from '../../../types/database';

type LastPointQuickEditProps = {
  lastPoint: Point;
  lastPointGame: Game;
  canEdit: boolean;
  onEditLastPoint: () => void;
};

/**
 * 直前に記録したポイントの要約を入力フォームのすぐ上に常時表示し、
 * 「修正」ボタン1つで編集モードへ入れるようにするカード。
 *
 * これが無いとゲーム履歴まで下方向にスクロールして該当ポイントを探す必要があり、
 * 入力中に「今のは違った」と気づいたときの修正コストが高い。
 */
const LastPointQuickEdit = ({ lastPoint, lastPointGame, canEdit, onEditLastPoint }: LastPointQuickEditProps) => {
  // 選手名は長くて折り返すため、チーム A / B の表記だけにして1行に収める
  const summaryParts = [
    `第${lastPointGame.game_number}ゲーム #${lastPoint.point_number}`,
    `チーム ${lastPoint.winner_team} 獲得`,
    getResultTypeLabel(lastPoint.result_type),
    lastPoint.rally_count ? `${lastPoint.rally_count}ラリー` : '',
    lastPoint.serving_team ? `サーブ: チーム ${lastPoint.serving_team}` : '',
  ].filter(Boolean);

  return (
    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-xs font-medium text-amber-800">直前のポイント</span>
          <p className="text-sm text-gray-800">{summaryParts.join(' ／ ')}</p>
        </div>
        <button
          type="button"
          onClick={onEditLastPoint}
          disabled={!canEdit}
          className="shrink-0 rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:bg-gray-300"
        >
          {canEdit ? '直前を修正' : '記録中...'}
        </button>
      </div>
    </div>
  );
};

export default LastPointQuickEdit;
