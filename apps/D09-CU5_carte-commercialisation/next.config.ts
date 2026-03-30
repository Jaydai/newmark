import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "export",
  basePath: "/commercialisation",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
