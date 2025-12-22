// next.config.mjs
console.log('--- DEBUG START ---');
console.log(
  'BUILD TIME GA_ID:',
  process.env.NEXT_PUBLIC_GA_ID || '値が空（undefined or empty）です',
);
console.log('--- DEBUG END ---');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Static export for Cloudflare Pages
  trailingSlash: true,
  images: {
    unoptimized: true, // Required for static export
  },
  env: {
    NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
  },
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false };
    return config;
  },
  reactStrictMode: true,
};

export default nextConfig;
