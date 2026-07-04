import type { GetStaticProps } from 'next';

import { getPublicMatchesListStaticProps, PublicMatchesListPage } from '@/pages/beta/matches-results';

// 両モードで公開(docs/ui C-1・M3)。実装本体は beta/matches-results(旧URLは301)。
export const getStaticProps: GetStaticProps = async (context) => {
  return getPublicMatchesListStaticProps(context);
};

export default PublicMatchesListPage;
