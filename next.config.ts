/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    MICROCMS_SERVICE_DOMAIN: process.env.MICROCMS_SERVICE_DOMAIN,
    MICROCMS_API_KEY: process.env.MICROCMS_API_KEY,
  },
  async redirects() {
    return [
      {
        source: '/',
        has: [
          {
            type: 'host',
            value: 'softeni.vercel.app',
          },
        ],
        destination: 'https://softeni-pick.com',
        permanent: true,
      },
      {
        source: '/tournaments/highschool-japan-cup/:year',
        destination: '/tournaments/highschool/highschool-japan-cup/:year',
        permanent: true,
      },
      {
        source: '/tournaments/highschool-japan-cup/:year/data',
        destination: '/tournaments/highschool/highschool-japan-cup/:year/data',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
