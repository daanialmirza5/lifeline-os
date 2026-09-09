import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for docker/Dockerfile's multi-stage build, which copies
  // .next/standalone rather than shipping full node_modules in the final
  // image. Has no effect on `next dev`/`next start` outside Docker.
  output: "standalone",
};

export default nextConfig;
