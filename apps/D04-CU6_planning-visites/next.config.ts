import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/visites",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
