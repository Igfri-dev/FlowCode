// @ts-check
import { fileURLToPath } from "node:url";

/** @type {import("next").NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["192.168.10.8"],
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
};

export default nextConfig;
