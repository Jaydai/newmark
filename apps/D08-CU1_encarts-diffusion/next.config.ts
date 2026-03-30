import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/encarts",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
