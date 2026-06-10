/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pg'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
  optimizeFonts: false,
};

module.exports = nextConfig;
