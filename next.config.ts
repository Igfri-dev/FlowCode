import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.10.8"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
