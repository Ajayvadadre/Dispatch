import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages touch the filesystem / WASM at runtime, so let Node load them directly.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "exceljs", "nodemailer"],
  devIndicators: false,
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
