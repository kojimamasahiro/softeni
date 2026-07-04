import type { GetStaticProps } from 'next';

import { getPublicGrowthAnalysisStaticProps, PublicGrowthAnalysisPage } from '@/pages/beta/matches-results/growth';

// 両モードで有効(docs/ui C-1・M3)。内部運用面のため noindex は共有実装側で維持。
export const getStaticProps: GetStaticProps = async (context) => {
  return getPublicGrowthAnalysisStaticProps(context);
};

export default PublicGrowthAnalysisPage;
