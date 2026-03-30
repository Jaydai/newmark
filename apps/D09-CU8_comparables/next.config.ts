import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/comparables",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
