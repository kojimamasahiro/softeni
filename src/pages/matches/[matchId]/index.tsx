import type { GetStaticPaths, GetStaticProps } from 'next';

import {
  getPublicMatchDetailStaticPaths,
  getPublicMatchDetailStaticProps,
  PublicMatchDetailPage,
} from '@/pages/beta/matches-results/[matchId]';
import { isScoreSiteMode } from '@/lib/siteConfig';

export const getStaticPaths: GetStaticPaths = async (context) => {
  if (!isScoreSiteMode()) {
    return {
      paths: [],
      fallback: false,
    };
  }

  return getPublicMatchDetailStaticPaths(context);
};

export const getStaticProps: GetStaticProps = async (context) => {
  if (!isScoreSiteMode()) {
    return { notFound: true };
  }

  return getPublicMatchDetailStaticProps(context);
};

export default PublicMatchDetailPage;
