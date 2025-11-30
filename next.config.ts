// next.config.js  ← ESMで統一（必要なら next.config.mjs に）

const isProd = process.env.NODE_ENV === 'production';
const BASE_URL = isProd ? 'https://softeni-pick.com' : 'http://localhost:3000';

/** @typedef {{ source: string, destination: string }} RedirectMapping */

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Static export for Cloudflare Pages
  trailingSlash: true,
  images: {
    unoptimized: true, // Required for static export
  },
  webpack: (config: any) => {
    config.resolve.fallback = { fs: false, path: false };
    return config;
  },
  reactStrictMode: true,
  // Note: redirects() and outputFileTracingIncludes are not compatible with static export
  // Redirects should be handled by Cloudflare Pages _redirects file
};

export default nextConfig;
