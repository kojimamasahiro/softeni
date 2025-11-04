import { createClient } from '@supabase/supabase-js';

import { isTestMode } from './env';

// 本番環境またはテスト環境のSupabase設定を取得
const getSupabaseConfig = () => {
  if (isTestMode()) {
    // テストモードでは専用の環境変数が必須
    if (!process.env.NEXT_PUBLIC_SUPABASE_TEST_URL) {
      throw new Error(
        'テストモードが有効ですが、NEXT_PUBLIC_SUPABASE_TEST_URLが設定されていません。',
      );
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_TEST_ANON_KEY) {
      throw new Error(
        'テストモードが有効ですが、NEXT_PUBLIC_SUPABASE_TEST_ANON_KEYが設定されていません。',
      );
    }
    if (!process.env.SUPABASE_TEST_SERVICE_KEY) {
      throw new Error(
        'テストモードが有効ですが、SUPABASE_TEST_SERVICE_KEYが設定されていません。',
      );
    }

    return {
      url: process.env.NEXT_PUBLIC_SUPABASE_TEST_URL,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_TEST_ANON_KEY,
      serviceKey: process.env.SUPABASE_TEST_SERVICE_KEY,
    };
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceKey: process.env.SUPABASE_SERVICE_KEY!,
  };
};

const config = getSupabaseConfig();

// クライアント側用（公開API）
export const supabase = createClient(config.url, config.anonKey);

// サーバー側用（Service Key）
export const createServerClient = () => {
  return createClient(config.url, config.serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
