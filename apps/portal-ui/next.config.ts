import type { NextConfig } from 'next';

const { API_ORIGIN = 'http://localhost:3000' } = process.env;

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
