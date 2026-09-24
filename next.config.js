require('dotenv').config()
/** @type {import('next').NextConfig} */

const nextConfig = {
  // Unificação por abas: o app vive em app.grupocoletivo.com.br/send
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '/send',
  productionBrowserSourceMaps: false,
  // Sem "X-Powered-By: Next.js" (não anuncia a stack)
  poweredByHeader: false,
  // Saída enxuta para o Dockerfile (node server.js). Funciona com basePath —
  // o Kadro roda assim há meses.
  output: 'standalone',
  // "Novo envio" é o formulário da home; /nova respondia 404 (auditoria).
  async redirects() {
    return [{ source: '/nova', destination: '/', permanent: false }]
  },
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
