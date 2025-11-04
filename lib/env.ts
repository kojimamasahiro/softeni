// 開発環境かどうかを判定
export const isDevelopment = () => {
  return process.env.NODE_ENV === 'development';
};

// デバッグ機能が有効かどうかを判定
export const isDebugMode = () => {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_DEBUG_MODE === 'true'
  );
};

// 管理者かどうかを判定（開発環境または管理者モード）
export const isAdmin = () => {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_ADMIN_MODE === 'true'
  );
};
