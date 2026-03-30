import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/dashboard",
  reactCompiler: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
