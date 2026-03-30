import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
  async rewrites() {
    const dataApi = process.env.DATA_API_URL || "http://localhost:8000";
    return [
      { source: "/api/emdat-monthly-risk", destination: `${dataApi}/api/emdat-monthly-risk` },
      { source: "/api/emdat-month-regions/:path*", destination: `${dataApi}/api/emdat-month-regions/:path*` },
      { source: "/api/emdat-event-markdown/:path*", destination: `${dataApi}/api/emdat-event-markdown/:path*` },
      { source: "/api/:path*", destination: `${process.env.CMS_API_URL || "http://localhost:9201"}/api/:path*` },
      { source: "/geo/:path*", destination: `${process.env.GEO_API_URL || "http://localhost:9202"}/:path*` },
      { source: "/cog/:path*", destination: `${process.env.TITILER_API_URL || "http://localhost:9203"}/:path*` },
    ];
  },
  webpack: (config) => {
    // Ensure single Jotai instance (required for veda-ui state management)
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      jotai: path.resolve(__dirname, "node_modules", "jotai"),
      "jotai-devtools": path.resolve(__dirname, "node_modules", "jotai-devtools"),
      "jotai-location": path.resolve(__dirname, "node_modules", "jotai-location"),
      "jotai-optics": path.resolve(__dirname, "node_modules", "jotai-optics"),
    };
    return config;
  },
  sassOptions: {
    includePaths: [],
  },
};

export default nextConfig;
