require('dotenv').config()
/** @type {import('next').NextConfig} */

const nextConfig = {
  // Unificação por abas: o app vive em app.grupocoletivo.com.br/send
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '/send',
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
