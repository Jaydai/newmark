import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/graphistes",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
