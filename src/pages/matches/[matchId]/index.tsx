import type { GetStaticPaths, GetStaticProps } from 'next';

import { getPublicMatchDetailStaticPaths, getPublicMatchDetailStaticProps, PublicMatchDetailPage } from '@/pages/beta/matches-results/[matchId]';

// 両モードで公開(docs/ui C-1・M3)。siteLink ありの試合は canonical が
// 大会配下ネスト URL を指す(getPublicMatchDetailPath)。
export const getStaticPaths: GetStaticPaths = async (context) => {
  return getPublicMatchDetailStaticPaths(context);
};

export const getStaticProps: GetStaticProps = async (context) => {
  return getPublicMatchDetailStaticProps(context);
};

export default PublicMatchDetailPage;
