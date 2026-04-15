/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Transpile mapbox-gl for compatibility
  transpilePackages: ['mapbox-gl'],
};

module.exports = nextConfig;
