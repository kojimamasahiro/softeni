const fs = require('fs');
const path = require('path');

const baseUrl = 'https://softeni.vercel.app'; // あなたのサイトURLに変更

const pages = [
  '/',
  '/players/uematsu-toshiki/results'
  // ここにページが増えたら、どんどん追加する
];

const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${pages
    .map((page) => {
      return `
  <url>
    <loc>${baseUrl}${page}</loc>
  </url>
  `;
    })
    .join('')}
</urlset>`;

const sitemapPath = path.join(__dirname, '..', 'public', 'sitemap.xml');

// publicフォルダに書き出し
fs.writeFileSync(sitemapPath, sitemapContent, 'utf8');

console.log('✅ sitemap.xml を作成しました！');
