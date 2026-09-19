import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: '/customers/:path*', destination: '/', permanent: false }];
  },
};

export default nextConfig;
