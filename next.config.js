/** @type {import('next').NextConfig} */
const nextConfig = {
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
