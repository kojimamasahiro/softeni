import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        config: Record<string, unknown>,
      ) => YouTubePlayerInstance;
      PlayerState?: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YouTubePlayerInstance = {
  destroy: () => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  setSize?: (width: number, height: number) => void;
};

export type YouTubeRangePlayerHandle = {
  captureCurrentTimeMs: () => number | null;
  isPlaying: () => boolean;
  pause: () => void;
  play: () => void;
  playFrom: (startMs: number) => void;
  playRange: (startMs: number, endMs?: number | null) => void;
  seekToMs: (timeMs: number) => void;
};

type YouTubeRangePlayerProps = {
  aspectRatio?: number;
  className?: string;
  onEmbedBlocked?: () => void;
  onReady?: () => void;
  playerHeight?: number;
  responsive?: boolean;
  videoId: string;
};

const DEFAULT_PLAYBACK_WINDOW_MS = 15_000;
const DEFAULT_PLAYER_HEIGHT = 360;
const PLAYER_WIDTH = 640;

const loadYouTubeIframeApi = () =>
  new Promise<void>((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    if (window.YT?.Player) {
      resolve();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );

    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };

    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.body.appendChild(script);
    }
  });

const YouTubeRangePlayer = forwardRef<
  YouTubeRangePlayerHandle,
  YouTubeRangePlayerProps
>(function YouTubeRangePlayer(
  {
    aspectRatio,
    className,
    onEmbedBlocked,
    onReady,
    playerHeight,
    responsive,
    videoId,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const onEmbedBlockedRef = useRef(onEmbedBlocked);
  const onReadyRef = useRef(onReady);
  const rangeEndMsRef = useRef<number | null>(null);
  const pausePollRef = useRef<number | null>(null);
  const [playerKey, setPlayerKey] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const resolvedAspectRatio =
    aspectRatio ?? PLAYER_WIDTH / DEFAULT_PLAYER_HEIGHT;
  const resolvedPlayerHeight =
    responsive && containerWidth > 0
      ? Math.round(containerWidth / resolvedAspectRatio)
      : (playerHeight ?? DEFAULT_PLAYER_HEIGHT);

  useEffect(() => {
    if (!responsive || !containerRef.current || typeof window === 'undefined') {
      return;
    }

    const updateWidth = () => {
      setContainerWidth(containerRef.current?.clientWidth ?? 0);
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [responsive]);

  useEffect(() => {
    onEmbedBlockedRef.current = onEmbedBlocked;
  }, [onEmbedBlocked]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  const clearPausePoll = () => {
    if (pausePollRef.current !== null) {
      window.clearInterval(pausePollRef.current);
      pausePollRef.current = null;
    }
  };

  const startPausePoll = () => {
    clearPausePoll();
    pausePollRef.current = window.setInterval(() => {
      const endMs = rangeEndMsRef.current;
      const player = playerRef.current;
      if (!player || endMs === null) return;

      const currentMs = Math.floor(player.getCurrentTime() * 1000);
      if (currentMs >= endMs) {
        player.pauseVideo();
        clearPausePoll();
      }
    }, 200);
  };

  useImperativeHandle(ref, () => ({
    captureCurrentTimeMs: () => {
      const player = playerRef.current;
      if (!player) return null;
      return Math.floor(player.getCurrentTime() * 1000);
    },
    isPlaying: () => {
      const player = playerRef.current;
      if (!player) return false;
      return player.getPlayerState() === window.YT?.PlayerState?.PLAYING;
    },
    pause: () => {
      playerRef.current?.pauseVideo();
      clearPausePoll();
    },
    play: () => {
      const player = playerRef.current;
      if (!player) return;
      rangeEndMsRef.current = null;
      clearPausePoll();
      player.playVideo();
    },
    playFrom: (startMs: number) => {
      const player = playerRef.current;
      if (!player) return;

      rangeEndMsRef.current = null;
      clearPausePoll();
      player.seekTo(Math.max(0, startMs) / 1000, true);
      player.playVideo();
    },
    playRange: (startMs: number, endMs?: number | null) => {
      const player = playerRef.current;
      if (!player) return;

      const safeStartMs = Math.max(0, startMs);
      const safeEndMs =
        typeof endMs === 'number' && endMs >= safeStartMs
          ? endMs
          : safeStartMs + DEFAULT_PLAYBACK_WINDOW_MS;

      rangeEndMsRef.current = safeEndMs;
      player.seekTo(safeStartMs / 1000, true);
      player.playVideo();
      startPausePoll();
    },
    seekToMs: (timeMs: number) => {
      const player = playerRef.current;
      if (!player) return;
      rangeEndMsRef.current = null;
      clearPausePoll();
      player.seekTo(Math.max(0, timeMs) / 1000, true);
    },
  }));

  useEffect(() => {
    let cancelled = false;

    const initializePlayer = async () => {
      if (!containerRef.current) return;

      await loadYouTubeIframeApi();
      if (cancelled || !containerRef.current || !window.YT?.Player) return;

      const resolvedWidth =
        responsive && containerWidth > 0 ? '100%' : String(PLAYER_WIDTH);
      const player = new window.YT.Player(containerRef.current, {
        height: String(resolvedPlayerHeight),
        width: resolvedWidth,
        videoId,
        playerVars: {
          playsinline: 1,
          rel: 0,
        },
        events: {
          onError: (event: { data?: number }) => {
            if (event.data === 101 || event.data === 150) {
              onEmbedBlockedRef.current?.();
            }
          },
          onReady: () => {
            onReadyRef.current?.();
          },
          onStateChange: (event: { data?: number }) => {
            if (
              event.data === window.YT?.PlayerState?.PAUSED ||
              event.data === window.YT?.PlayerState?.ENDED
            ) {
              clearPausePoll();
            }
          },
        },
      });

      playerRef.current = player;
    };

    void initializePlayer();

    return () => {
      cancelled = true;
      clearPausePoll();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [containerWidth, playerKey, resolvedPlayerHeight, responsive, videoId]);

  useEffect(() => {
    if (!responsive || containerWidth <= 0) return;

    playerRef.current?.setSize?.(containerWidth, resolvedPlayerHeight);
  }, [containerWidth, resolvedPlayerHeight, responsive]);

  useEffect(() => {
    setPlayerKey((previous) => previous + 1);
  }, [videoId]);

  return (
    <div
      className={className}
      ref={containerRef}
      style={{
        height: `${resolvedPlayerHeight}px`,
        width: '100%',
      }}
    />
  );
});

export default YouTubeRangePlayer;
