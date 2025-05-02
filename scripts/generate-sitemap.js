const fs = require('fs');
const path = require('path');

const baseUrl = 'https://softeni.vercel.app';
const todayStr = new Date().toISOString().split('T')[0];
const sitemapPath = path.join(__dirname, '../public/sitemap.xml');

// 旧 sitemap.xml から既存の lastmod を読み込む
let previousLastmods = {};
if (fs.existsSync(sitemapPath)) {
  const oldXml = fs.readFileSync(sitemapPath, 'utf8');
  const matches = [...oldXml.matchAll(/<loc>(.*?)<\/loc>\s*<lastmod>(.*?)<\/lastmod>/g)];
  matches.forEach(([, loc, lastmod]) => {
    previousLastmods[loc] = lastmod;
  });
}

// 1. 静的ページ（変更日 = 今日）
const staticPages = ['/', '/about'];

const staticUrls = staticPages.map(pathname => {
  const loc = `${baseUrl}${pathname}`;
  const lastmod = previousLastmods[loc] || todayStr;
  return { loc, lastmod };
});

// 2. 選手ページ（変更日 = information.json の更新日）
const playersDir = path.join(__dirname, '../data/players');
const playerDirs = fs.readdirSync(playersDir).filter(dir =>
  fs.existsSync(path.join(playersDir, dir, 'information.json'))
);

const dynamicUrls = playerDirs.flatMap(playerId => {
  const infoPath = path.join(playersDir, playerId, 'information.json');
  const stats = fs.statSync(infoPath);
  const lastmod = stats.mtime.toISOString().split('T')[0]; // 更新日（日本時間ではなくUTC）

  return [
    {
      loc: `${baseUrl}/players/${playerId}/information`,
      lastmod,
    },
    {
      loc: `${baseUrl}/players/${playerId}/results`,
      lastmod,
    }
  ];
});

// 3. 全URLまとめて XML に変換
const allUrls = [...staticUrls, ...dynamicUrls];

const urlsXml = allUrls.map(({ loc, lastmod }) => {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`;
}).join('\n');

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>`;

fs.writeFileSync(sitemapPath, sitemapXml.trim());
console.log('✅ sitemap.xml を生成しました（選手ごとの lastmod を反映）');
