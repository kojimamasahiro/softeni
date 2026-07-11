import fs from 'fs';
import path from 'path';

// 希少イベント（rare-events.json）を読むサーバー専用ヘルパー。
// 生成は scripts/generate-rare-events.mjs（prebuild）、検知ロジックは lib/rareEvents.mjs。
// getStaticProps からのみ使う（fs 依存のためクライアントへ import しない）。
// 仕様: docs/wiki/rare-events.md

export type RareEventKind = 'longest-rally' | 'service-ace' | 'longest-deuce' | 'biggest-comeback' | 'longest-point-streak' | 'pattern';

export interface RareEvent {
  kind: RareEventKind;
  scope: 'tournament';
  tournamentId: string;
  year: number;
  matchId: string;
  round: string | null;
  teamA: string;
  teamB: string;
  detailPath: string;
  gameId: string;
  gameNumber: number;
  pointId: string;
  pointNumber: number;
  subjectTeam: 'A' | 'B' | null;
  subjectPlayer?: string | null;
  /** kind === 'pattern' のとき、昇格元パターンの id（RARE_EVENT_CONFIG.patterns） */
  patternId?: string;
  detail: Record<string, string | number>;
  videoUrl: string | null;
  /** 描画用の素文（例:「この大会最長の25本ラリー」）。自然文生成はしない（ADR-005） */
  label: string;
  /** 「この大会」＝記録済み試合の範囲での比較である旨の注記（表示必須） */
  scopeNote: string;
  postable: boolean;
}

type RareEventsFile = {
  generatedAt?: string;
  events?: RareEvent[];
  byMatch?: Record<string, RareEvent[]>;
};

const rareEventsPath = path.join(process.cwd(), 'public', 'data', 'beta-matches', 'rare-events.json');

// 試合詳細ページの getStaticProps から試合数ぶん呼ばれるため、プロセス内で一度だけ読む
let cached: RareEventsFile | null | undefined;

const readFile = (): RareEventsFile | null => {
  if (cached !== undefined) return cached;
  try {
    cached = fs.existsSync(rareEventsPath) ? (JSON.parse(fs.readFileSync(rareEventsPath, 'utf-8')) as RareEventsFile) : null;
  } catch {
    cached = null;
  }
  return cached;
};

/** 指定試合で起きた希少イベント一覧（無ければ空配列） */
export const getRareEventsForMatch = (matchId: string): RareEvent[] => {
  return readFile()?.byMatch?.[matchId] ?? [];
};
