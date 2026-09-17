/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@a11y-guard/config', '@a11y-guard/logger', '@a11y-guard/shared-types'],
};

export default nextConfig;
