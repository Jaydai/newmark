import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/proprietaire",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
