import { formatVideoTimestamp, parseSecondsInputToMs } from '../../../../lib/youtubePlayback';
import type { PointDataState } from './types';

type VideoTimeRangeInputsProps = {
  pointData: PointDataState;
  onChange: (updates: Partial<PointDataState>) => void;
  startInputValue: string;
  endInputValue: string;
};

/**
 * ポイントの動画開始・終了時刻を入力するフォーム。デスクトップ動画サイドバーと
 * ポイント入力フォームの両方から使う（元は input.tsx に同一JSXとして重複していた）。
 */
const VideoTimeRangeInputs = ({ pointData, onChange, startInputValue, endInputValue }: VideoTimeRangeInputsProps) => (
  <div>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h4 className="text-sm font-medium">動画時刻</h4>
        <p className="text-xs text-gray-500">開始だけでも保存できます。終了未設定時は詳細画面で 15 秒再生します。</p>
      </div>
    </div>

    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs text-gray-600">開始時刻 (秒)</label>
        <input
          type="text"
          inputMode="decimal"
          value={startInputValue}
          onChange={(event) => onChange({ video_start_ms: parseSecondsInputToMs(event.target.value) })}
          className="w-full rounded border p-2 text-sm"
          placeholder="例: 83.4 or 1:23"
        />
        <p className="mt-1 text-xs text-gray-500">表示: {formatVideoTimestamp(pointData.video_start_ms, true)}</p>
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-600">終了時刻 (秒)</label>
        <input
          type="text"
          inputMode="decimal"
          value={endInputValue}
          onChange={(event) => onChange({ video_end_ms: parseSecondsInputToMs(event.target.value) })}
          className="w-full rounded border p-2 text-sm"
          placeholder="例: 95.0 or 1:35"
        />
        <p className="mt-1 text-xs text-gray-500">表示: {formatVideoTimestamp(pointData.video_end_ms, true)}</p>
      </div>
    </div>
  </div>
);

export default VideoTimeRangeInputs;
