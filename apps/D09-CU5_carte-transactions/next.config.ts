import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "export",
  basePath: "/transactions",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
