/** @type {import('next-sitemap').IConfig} */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

// --- 実データ由来の lastmod テーブルを構築（起動時に一度だけ） ---

// tournamentId -> { year -> endDate|startDate }
const tournamentDates = {};
// playerId(number) -> 最新出場大会の日付 (ISO)
const playerLastmod = {};

function loadData() {
  try {
    const infoDir = path.join(
      process.cwd(),
      'data',
      'tournaments',
      'information',
    );
    if (fs.existsSync(infoDir)) {
      for (const file of fs.readdirSync(infoDir)) {
        if (!file.endsWith('.json')) continue;
        const tid = file.replace(/\.json$/, '');
        try {
          const entries = JSON.parse(
            fs.readFileSync(path.join(infoDir, file), 'utf-8'),
          );
          if (!Array.isArray(entries)) continue;
          tournamentDates[tid] = {};
          for (const e of entries) {
            const date = e.endDate || e.startDate || null;
            if (e.year && date) tournamentDates[tid][String(e.year)] = date;
          }
        } catch {
          // ignore broken file
        }
      }
    }

    // 姓名 -> playerId（count>=5、同姓同名は最初の ID。ページ側と同じ規約）
    const nameToId = new Map();
    const indexPath = path.join(process.cwd(), 'data', 'players', 'index.json');
    if (fs.existsSync(indexPath)) {
      const playersIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      for (const p of playersIndex) {
        if ((p.count ?? 0) < 5) continue;
        const key = `${p.lastName}::${p.firstName}`;
        if (!nameToId.has(key)) nameToId.set(key, p.id);
      }
    }

    // details を走査して各選手の最新出場日を求める
    const detailsDir = path.join(
      process.cwd(),
      'data',
      'tournaments',
      'details',
    );
    if (fs.existsSync(detailsDir)) {
      for (const tid of fs.readdirSync(detailsDir)) {
        const tidDir = path.join(detailsDir, tid);
        if (!fs.statSync(tidDir).isDirectory()) continue;
        for (const year of fs.readdirSync(tidDir)) {
          const yearDir = path.join(tidDir, year);
          if (!fs.statSync(yearDir).isDirectory()) continue;
          const date = tournamentDates[tid]
            ? tournamentDates[tid][String(year)]
            : null;
          if (!date) continue;
          for (const file of fs.readdirSync(yearDir)) {
            if (!file.endsWith('.json')) continue;
            try {
              const detail = JSON.parse(
                fs.readFileSync(path.join(yearDir, file), 'utf-8'),
              );
              for (const p of detail.participants ?? []) {
                if (!p.lastName || !p.firstName) continue;
                const id = nameToId.get(`${p.lastName}::${p.firstName}`);
                if (id === undefined) continue;
                if (!playerLastmod[id] || date > playerLastmod[id]) {
                  playerLastmod[id] = date;
                }
              }
            } catch {
              // ignore broken file
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('next-sitemap: failed to build lastmod tables', err);
  }
}

loadData();

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
  changefreq: 'weekly', // ページ更新頻度
  priority: 0.7, // ページ優先度
  // ベータ機能とテスト用エンドポイントは sitemap から除外
  exclude: [
    '/beta',
    '/beta/*',
    '/api/*', // すべてのAPIエンドポイントを除外
    '/api/test-db', // テスト用DBエンドポイント（明示的）
    '/test-db', // テスト用DBページ
    '*/data', // すべての /data パスを除外
    '/highschool', // noindex のリダイレクト用入口ページを除外
  ],
  transform: async (config, loc) => {
    let lastmod;

    // 選手結果ページ: /players/{numericId}/results/
    const playerMatch = loc.match(/^\/players\/(\d+)\/results\/?$/);
    if (playerMatch) {
      lastmod = playerLastmod[Number(playerMatch[1])];
    }

    // 大会結果ページ: /tournaments/{generation}/{tid}/{year}/...
    const tournamentMatch = loc.match(
      /^\/tournaments\/[^/]+\/([^/]+)\/(\d{4})\//,
    );
    if (tournamentMatch) {
      lastmod = tournamentDates[tournamentMatch[1]]
        ? tournamentDates[tournamentMatch[1]][tournamentMatch[2]]
        : undefined;
    }

    return {
      loc, // ページURL
      ...(lastmod ? { lastmod } : {}),
      changefreq: config.changefreq, // 頻度
      priority: config.priority, // 優先度
    };
  },
};
