// next.config.js  ← ESMで統一（必要なら next.config.mjs に）
import fs from 'fs';
import path from 'path';

const isProd = process.env.NODE_ENV === 'production';
const BASE_URL = isProd ? 'https://softeni-pick.com' : 'http://localhost:3000';

/** @typedef {{ source: string, destination: string }} RedirectMapping */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    MICROCMS_SERVICE_DOMAIN: process.env.MICROCMS_SERVICE_DOMAIN,
    MICROCMS_API_KEY: process.env.MICROCMS_API_KEY,
  },
  async redirects() {
    // 1) 既存の固定リダイレクト（必ず permanent を入れる）
    const fixedRedirects = [
      {
        source: '/',
        has: [{ type: 'host', value: 'softeni.vercel.app' }],
        destination: 'https://softeni-pick.com',
        permanent: true,
      },
      {
        source: '/tournaments/highschool-japan-cup/:year',
        destination: '/tournaments/highschool/highschool-japan-cup/:year',
        permanent: isProd, // devは302、本番は301
      },
      {
        source: '/tournaments/highschool-japan-cup/:year/data',
        destination: '/tournaments/highschool/highschool-japan-cup/:year/data',
        permanent: isProd,
      },
    ];

    // 2) 個別マッピング（redirects-map.json）を読む
    /** @type {RedirectMapping[]} */
    let map = [];
    const mapPath = path.join(process.cwd(), 'redirects-map.json');
    if (fs.existsSync(mapPath)) {
      try {
        map = /** @type {RedirectMapping[]} */ JSON.parse(
          fs.readFileSync(mapPath, 'utf8'),
        );
      } catch (e) {
        console.warn(
          'Failed to read redirects-map.json:',
          e instanceof Error ? e.message : String(e),
        );
      }
    }

    // 3) 変換（重複sourceを除外、destinationは相対→絶対化）
    const seen = new Set();
    interface RedirectMapping {
      source: string;
      destination: string;
    }

    interface Redirect {
      source: string;
      destination: string;
      permanent: boolean;
    }

    const dynamicRedirects: Redirect[] = map
      .filter(
        (r: RedirectMapping | null): r is RedirectMapping =>
          r !== null && !!r.source && !!r.destination,
      )
      .filter((r: RedirectMapping) => {
        if (seen.has(r.source)) return false;
        seen.add(r.source);
        return true;
      })
      .map((r: RedirectMapping): Redirect => {
        const dest = r.destination.startsWith('http')
          ? r.destination // 既に絶対URLならそのまま
          : `${BASE_URL}${r.destination}`; // 相対なら環境に合わせて絶対URL化
        return {
          source: r.source,
          destination: dest,
          permanent: isProd, // devは302、本番は301
        };
      });

    return [...fixedRedirects, ...dynamicRedirects];
  },
};

export default nextConfig;
