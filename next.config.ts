import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  outputFileTracingRoot: projectRoot,
  serverExternalPackages: ["@napi-rs/canvas"],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
