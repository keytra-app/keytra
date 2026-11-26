import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // JSON imports go through a Server Action; the UI caps files at 5 MB (default limit is 1 MB).
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
