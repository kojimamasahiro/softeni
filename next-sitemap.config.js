/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://softeni-pick.com', // サイトのURLを指定
  generateRobotsTxt: true, // robots.txtを生成
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/beta/', '/test-db'],
      },
    ],
  },
  changefreq: 'daily', // ページ更新頻度
  priority: 0.7, // ページ優先度
  // ベータ機能とテスト用エンドポイントは sitemap から除外
  exclude: [
    '/beta',
    '/beta/*',
    '/api/*', // すべてのAPIエンドポイントを除外
    '/api/test-db', // テスト用DBエンドポイント（明示的）
    '/test-db', // テスト用DBページ
  ],
  transform: async (config, path) => {
    return {
      loc: path, // ページURL
      // lastmodを省略（削除）することで表示されないようにする
      // lastmod: undefined,  // もしくは、lastmod を削除
      changefreq: 'daily', // 頻度
      priority: 0.7, // 優先度
    };
  },
};
