import type { GetStaticProps } from 'next';

import {
  getPublicMatchesListStaticProps,
  PublicMatchesListPage,
} from '@/pages/beta/matches-results';
import { isScoreSiteMode } from '@/lib/siteConfig';

export const getStaticProps: GetStaticProps = async (context) => {
  if (!isScoreSiteMode()) {
    return { notFound: true };
  }

  return getPublicMatchesListStaticProps(context);
};

export default PublicMatchesListPage;
