import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/graphistes",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
