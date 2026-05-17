// next.config.mjs
/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === 'production';

const nextConfig = {
  // Keep API routes available in development while preserving static export in production.
  ...(isProduction ? { output: 'export' } : {}),
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
