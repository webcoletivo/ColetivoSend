require('dotenv').config()
/** @type {import('next').NextConfig} */

const nextConfig = {
  productionBrowserSourceMaps: false,
  // output: 'standalone', // Disabled primarily to debug 404s
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
      }
    ],
  },
}

module.exports = nextConfig
