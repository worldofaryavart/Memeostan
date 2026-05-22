import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root: a stray lockfile in the home dir confuses Next's
  // auto-detection. This project dir is the root.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
