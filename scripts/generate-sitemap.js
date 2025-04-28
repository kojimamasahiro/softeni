const fs = require('fs');
const path = require('path');

// プレイヤー一覧
const players = [
  'uematsu-toshiki',
  'uchida-riku'
];

// サイトのドメイン
const baseUrl = 'https://softeni.vercel.app';

function generateSitemap() {
  let urls = '';

  players.forEach((player) => {
    urls += `
  <url>
    <loc>${baseUrl}/players/${player}/results</loc>
  </url>
  <url>
    <loc>${baseUrl}/players/${player}/information</loc>
  </url>
`;
  });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
>
${urls}
</urlset>
`;

  fs.writeFileSync(path.join(__dirname, '../public/sitemap.xml'), sitemap.trim());
  console.log('✅ sitemap.xml を生成しました');
}

generateSitemap();
