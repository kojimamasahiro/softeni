import type { GetStaticPaths, GetStaticProps } from 'next';

import {
  getPublicMatchDetailStaticProps,
  PublicMatchDetailPage,
} from '@/pages/beta/matches-results/[matchId]';
import { getSiteLinkedMatchPaths } from '@/lib/betaMatchesStatic';
import { isScoreSiteMode } from '@/lib/siteConfig';

// 掲載大会に紐づく試合の indexable な公開面。
// 試合詳細コンポーネントは /beta/matches-results/[matchId] と共通。
// canonical / OGP は siteLink により本ネスト URL を向く（lib/siteConfig getPublicMatchDetailPath）。
// 仕様: docs/wiki/score-site-link.md
export const getStaticPaths: GetStaticPaths = async () => {
  // score モードは大会ページ群を持たないためネスト URL を生成しない。
  if (isScoreSiteMode()) {
    return { paths: [], fallback: false };
  }

  const siteLinked = await getSiteLinkedMatchPaths();

  return {
    paths: siteLinked.map((segment) => ({
      params: {
        generation: segment.generation,
        tournamentId: segment.tournamentId,
        year: segment.year,
        gameCategory: segment.gameCategory,
        ageCategory: segment.ageCategory,
        gender: segment.gender,
        matchId: segment.matchId,
      },
    })),
    fallback: false,
  };
};

// params.matchId のみ使う（getPublicMatchDetailStaticProps が試合 ID で解決する）。
export const getStaticProps: GetStaticProps = async (context) => {
  if (isScoreSiteMode()) {
    return { notFound: true };
  }

  return getPublicMatchDetailStaticProps(context);
};

export default PublicMatchDetailPage;
