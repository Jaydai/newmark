import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/encarts",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
