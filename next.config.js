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
  experimental: {
    // Increase body size limit for API routes (for chunked uploads)
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

module.exports = nextConfig
