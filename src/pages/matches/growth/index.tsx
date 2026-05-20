import type { GetStaticProps } from 'next';

import {
  getPublicGrowthAnalysisStaticProps,
  PublicGrowthAnalysisPage,
} from '@/pages/beta/matches-results/growth';
import { isScoreSiteMode } from '@/lib/siteConfig';

export const getStaticProps: GetStaticProps = async (context) => {
  if (!isScoreSiteMode()) {
    return { notFound: true };
  }

  return getPublicGrowthAnalysisStaticProps(context);
};

export default PublicGrowthAnalysisPage;
