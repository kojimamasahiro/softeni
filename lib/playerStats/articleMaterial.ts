// lib/playerStats/articleMaterial.ts
// 記事生成（news-context-blocks 系）への供給点。
// エンジンは自然文を作らない（設計 §7.4）。milestones / careerTimeline / titles の
// 構造化イベント（label/shortLabel/detail/confidence）だけを返し、文章化は上位に委ねる。
//
// 既存の news パイプラインを書き換えず、必要時にこの 1 本を呼んで素材を得る（非破壊）。

import type {
  MilestoneEvent,
  TimelineEvent,
} from '../../src/types/playerStatistics';
import { getPlayerStatistics } from './playerStatistics';

export interface PlayerArticleMaterial {
  playerId: number;
  displayName: string;
  currentTeam: string | null;
  scope: 'site-covered';
  scopeNote: string;
  milestones: MilestoneEvent[];
  careerTimeline: TimelineEvent[];
  titlesTotal: number;
  titlesMajor: number;
}

/**
 * 記事の骨子となる構造化素材を返す。sections を絞って最小計算で取得する。
 */
export async function getPlayerArticleMaterial(
  playerId: number,
  root?: string,
): Promise<PlayerArticleMaterial> {
  const stats = await getPlayerStatistics(
    playerId,
    { sections: ['milestones', 'titles', 'careerTimeline', 'headToHead'] },
    root,
  );
  return {
    playerId: stats.playerId,
    displayName: stats.identity.displayName,
    currentTeam: stats.identity.currentTeam,
    scope: stats.scope,
    scopeNote: stats.scopeNote,
    milestones: stats.milestones,
    careerTimeline: stats.careerTimeline,
    titlesTotal: stats.titles.total,
    titlesMajor: stats.titles.major,
  };
}
