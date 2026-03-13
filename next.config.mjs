import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // 反向代理：通过同一域名访问后端，便于 ngrok 单域名 (ediportal.ngrok.app) 访问前后端
  async rewrites() {
    return [
      { source: '/v1/:path*', destination: 'http://127.0.0.1:8000/v1/:path*' },
      { source: '/openapi.json', destination: 'http://127.0.0.1:8000/openapi.json' },
      { source: '/docs', destination: 'http://127.0.0.1:8000/docs' },
      { source: '/docs/:path*', destination: 'http://127.0.0.1:8000/docs/:path*' },
      { source: '/redoc', destination: 'http://127.0.0.1:8000/redoc' },
      { source: '/redoc/:path*', destination: 'http://127.0.0.1:8000/redoc/:path*' },
    ]
  },
}

export default nextConfig
