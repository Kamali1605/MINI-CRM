/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pg'],
  optimizeFonts: false,
};

module.exports = nextConfig;
