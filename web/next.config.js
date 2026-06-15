/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development';

const nextConfig = {
  // 开发模式不用 static export，否则 rewrites 不生效，/api 无法代理到后端
  ...(isDev ? {} : { output: 'export' }),
  trailingSlash: true,
  images: { unoptimized: true },
  async rewrites() {
    return isDev
      ? [{ source: '/api/:path*', destination: 'http://127.0.0.1:8080/api/:path*' }]
      : [];
  },
};

module.exports = nextConfig;
