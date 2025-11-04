import { NextApiRequest, NextApiResponse } from 'next';

import { createServerClient } from '../../../lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();

    console.log('Testing Supabase connection...');
    console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('Service Key exists:', !!process.env.SUPABASE_SERVICE_KEY);

    // テーブルの存在確認
    const { error: matchesError } = await supabase
      .from('matches')
      .select('count')
      .limit(1);

    const { error: gamesError } = await supabase
      .from('games')
      .select('count')
      .limit(1);

    const { error: pointsError } = await supabase
      .from('points')
      .select('count')
      .limit(1);

    const results = {
      connection: 'OK',
      tables: {
        matches: matchesError ? { error: matchesError.message } : 'OK',
        games: gamesError ? { error: gamesError.message } : 'OK',
        points: pointsError ? { error: pointsError.message } : 'OK',
      },
      env: {
        supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
      },
    };

    console.log('Test results:', results);

    res.status(200).json(results);
  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
