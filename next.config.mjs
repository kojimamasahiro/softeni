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
    NEXT_PUBLIC_SITE_MODE: process.env.NEXT_PUBLIC_SITE_MODE,
    NEXT_PUBLIC_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_PUBLIC_BASE_URL,
    NEXT_PUBLIC_SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME,
    NEXT_PUBLIC_PUBLIC_OG_IMAGE: process.env.NEXT_PUBLIC_PUBLIC_OG_IMAGE,
  },
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false };
    return config;
  },
  reactStrictMode: true,
};

export default nextConfig;
