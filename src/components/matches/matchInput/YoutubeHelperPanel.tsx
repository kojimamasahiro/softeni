import { useEffect, useState, type RefObject } from 'react';

import YouTubeRangePlayer, { type YouTubeRangePlayerHandle } from '../../YouTubeRangePlayer';

type YoutubeHelperPanelProps = {
  wrapperClassName: string;
  videoId: string;
  playerRef: RefObject<YouTubeRangePlayerHandle | null>;
  playerHeight?: number;
  onReady: () => void;
  youtubeEmbedBlocked: boolean;
  youtubeUrl: string;
  onEmbedBlocked: () => void;
  onResume: () => void;
  onPause: () => void;
};

// 記録を速くするための再生速度（2026-09-27。見る時間が記録時間の大半のため）。選んだ速度はこの端末に覚えておく
const PLAYBACK_RATES = [1, 1.5, 2] as const;
const PLAYBACK_RATE_STORAGE_KEY = 'matchInput.playbackRate';

const readStoredRate = (): number => {
  try {
    const stored = Number(window.localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY));
    return PLAYBACK_RATES.includes(stored as (typeof PLAYBACK_RATES)[number]) ? stored : 1;
  } catch {
    return 1;
  }
};

/**
 * ポイント入力画面でモバイル・デスクトップ両レイアウトから使う
 * YouTube ポイント記録補助パネル（元は input.tsx に2箇所ほぼ同一のJSXとして重複していた）。
 */
const YoutubeHelperPanel = ({
  wrapperClassName,
  videoId,
  playerRef,
  playerHeight,
  onReady,
  youtubeEmbedBlocked,
  youtubeUrl,
  onEmbedBlocked,
  onResume,
  onPause,
}: YoutubeHelperPanelProps) => {
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    setPlaybackRate(readStoredRate());
  }, []);

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    try {
      window.localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, String(rate));
    } catch {
      // 保存できなくても今の画面では効く
    }
  };

  return (
    <div className={wrapperClassName}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">YouTube ポイント記録補助</h3>
          <p className="text-xs text-gray-500">`Ctrl + S` で開始、`Ctrl + E` で終了、`Ctrl + D` で再生、`Ctrl + F` でクリア、`← / →` で 5 秒移動</p>
        </div>
        {youtubeEmbedBlocked && youtubeUrl && (
          <a href={youtubeUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
            YouTubeで開く
          </a>
        )}
      </div>

      {youtubeEmbedBlocked ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          この動画は埋め込み再生できなかったため、外部 YouTube で確認してください。
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg bg-black">
            <YouTubeRangePlayer
              ref={playerRef}
              videoId={videoId}
              playerHeight={playerHeight}
              onReady={onReady}
              onEmbedBlocked={onEmbedBlocked}
              playbackRate={playbackRate}
              className="aspect-video w-full"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onResume} className="rounded bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700">
              続きから再生
            </button>
            <button type="button" onClick={onPause} className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-white">
              一時停止
            </button>
            <div className="ml-auto inline-flex items-center gap-1" role="group" aria-label="再生速度">
              <span className="text-xs text-gray-500">再生速度</span>
              {PLAYBACK_RATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => changePlaybackRate(rate)}
                  aria-pressed={playbackRate === rate}
                  className={`rounded border px-2.5 py-1.5 text-sm ${
                    playbackRate === rate ? 'border-slate-800 bg-slate-800 text-white' : 'border-gray-300 hover:bg-white'
                  }`}
                >
                  {rate}倍
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YoutubeHelperPanel;
