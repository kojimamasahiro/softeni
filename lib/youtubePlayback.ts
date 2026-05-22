import { parseYouTubeVideoId } from './videoReview';

export const DEFAULT_POINT_VIDEO_WINDOW_MS = 15_000;

export const buildYouTubeWatchUrlFromVideoId = (
  videoId: string,
  startMs = 0,
) => {
  const url = new URL(`https://www.youtube.com/watch?v=${videoId}`);
  if (startMs > 0) {
    url.searchParams.set('t', `${Math.floor(startMs / 1000)}s`);
  }
  return url.toString();
};

export const normalizeYouTubeInput = (input: string) => {
  const trimmed = input.trim();
  const videoId = parseYouTubeVideoId(trimmed);
  if (!videoId) {
    return {
      videoId: null,
      watchUrl: trimmed || null,
    };
  }

  return {
    videoId,
    watchUrl: buildYouTubeWatchUrlFromVideoId(videoId),
  };
};

export const getPointVideoEndMs = (
  videoStartMs: number | null | undefined,
  videoEndMs: number | null | undefined,
) => {
  if (videoStartMs === null || videoStartMs === undefined) return null;
  if (videoEndMs !== null && videoEndMs !== undefined) return videoEndMs;
  return videoStartMs + DEFAULT_POINT_VIDEO_WINDOW_MS;
};

export const formatVideoTimestamp = (
  valueMs: number | null | undefined,
  includeMilliseconds = false,
) => {
  if (valueMs === null || valueMs === undefined) return '未設定';

  const totalMs = Math.max(0, valueMs);
  const totalSeconds = Math.floor(totalMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (!includeMilliseconds) {
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  const milliseconds = Math.floor((totalMs % 1000) / 100);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${milliseconds}`;
};

export const parseSecondsInputToMs = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map((part) => Number(part));
    if (parts.some((part) => Number.isNaN(part))) return null;

    let seconds = 0;
    for (const part of parts) {
      seconds = seconds * 60 + part;
    }
    return Math.round(seconds * 1000);
  }

  const asNumber = Number(trimmed);
  if (Number.isNaN(asNumber)) return null;
  return Math.round(asNumber * 1000);
};

export const formatMsForInput = (valueMs: number | null | undefined) => {
  if (valueMs === null || valueMs === undefined) return '';
  return (valueMs / 1000).toFixed(1).replace(/\.0$/, '');
};
