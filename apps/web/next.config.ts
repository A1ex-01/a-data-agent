import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Workspace packages must be listed here so Next.js transpiles them
  // instead of treating them as pre-built node_modules.
  transpilePackages: ["@a-data-agent/contracts"],
}

export default nextConfig
