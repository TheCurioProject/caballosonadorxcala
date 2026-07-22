import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  compress: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  serverExternalPackages: ['@prisma/client', 'prisma', 'node-ical'],
};

export default nextConfig;
