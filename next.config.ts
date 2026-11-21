import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autonome, idéal pour Docker / Coolify
  output: "standalone",
};

export default nextConfig;
