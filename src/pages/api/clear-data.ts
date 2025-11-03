import { NextApiRequest, NextApiResponse } from 'next';

import { createServerClient } from '../../../lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 本番環境では実行しない
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not allowed in production' });
  }

  try {
    const supabase = createServerClient();

    console.log('Clearing all data...');

    // すべてのデータを削除（CASCADE により関連データも削除される）
    const { error: matchesError } = await supabase
      .from('matches')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 全件削除

    if (matchesError) {
      console.error('Error clearing matches:', matchesError);
      return res.status(400).json({ error: matchesError.message });
    }

    res.status(200).json({
      message: 'All data cleared successfully',
      warning: 'This operation is only available in development mode',
    });
  } catch (error) {
    console.error('Clear data error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
