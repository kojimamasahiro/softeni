/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://softeni-pick.com', // サイトのURLを指定
  generateRobotsTxt: true, // robots.txtを生成
  changefreq: 'daily', // ページ更新頻度
  priority: 0.7, // ページ優先度
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


