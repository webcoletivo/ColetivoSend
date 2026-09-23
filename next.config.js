require('dotenv').config()
/** @type {import('next').NextConfig} */

const nextConfig = {
  // Unificação por abas: o app vive em app.grupocoletivo.com.br/send
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '/send',
  productionBrowserSourceMaps: false,
  // Saída enxuta para o Dockerfile (node server.js). Funciona com basePath —
  // o Kadro roda assim há meses.
  output: 'standalone',
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
