import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "export",
  basePath: "/offre-retail",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
