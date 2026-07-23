/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development';
const buildStamp = process.env.MINIBILL_BUILD_STAMP || String(Date.now());

// Next App Router entries use [chunkhash]; async chunks / CSS use [contenthash].
function appendStamp(template) {
  if (typeof template !== 'string') return template;
  if (template.includes(`-${buildStamp}`)) return template;
  if (template.includes('[chunkhash]')) {
    return template.replace('[chunkhash]', `[chunkhash]-${buildStamp}`);
  }
  if (template.includes('[contenthash]')) {
    return template.replace('[contenthash]', `[contenthash]-${buildStamp}`);
  }
  return template;
}

const nextConfig = {
  // 开发模式不用 static export，否则 rewrites 不生效，/api 无法代理到后端
  ...(isDev ? {} : { output: 'export' }),
  trailingSlash: true,
  images: { unoptimized: true },
  generateBuildId: async () => buildStamp,
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.output.filename = appendStamp(config.output.filename);
      config.output.chunkFilename = appendStamp(config.output.chunkFilename);
      const cssPlugin = config.plugins.find(
        (p) =>
          p?.constructor?.name === 'MiniCssExtractPlugin' ||
          (typeof p?.options?.filename === 'string' &&
            p.options.filename.includes('static/css'))
      );
      if (cssPlugin?.options) {
        cssPlugin.options.filename = appendStamp(cssPlugin.options.filename);
        cssPlugin.options.chunkFilename = appendStamp(cssPlugin.options.chunkFilename);
      }
    }
    return config;
  },
  async rewrites() {
    return isDev
      ? [{ source: '/api/:path*', destination: 'http://127.0.0.1:8080/api/:path*' }]
      : [];
  },
};

module.exports = nextConfig;
