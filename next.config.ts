import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  basePath: '/next',
  output: 'standalone',
  // 使用nginx的br压缩
  compress: false,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: 'http://localhost:8080/:path*',
          basePath: false,
        },
      ],
    }
  },
}

export default nextConfig
