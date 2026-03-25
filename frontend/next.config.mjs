/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    const dataApi = process.env.DATA_API_URL || "http://localhost:8000";
    return [
      // Proxy EM-DAT parquet data API (FastAPI on port 8000)
      { source: "/api/emdat-monthly-risk", destination: `${dataApi}/api/emdat-monthly-risk` },
      { source: "/api/emdat-month-regions/:path*", destination: `${dataApi}/api/emdat-month-regions/:path*` },
      { source: "/api/emdat-event-markdown/:path*", destination: `${dataApi}/api/emdat-event-markdown/:path*` },
      // Proxy Wagtail CMS API to Django backend
      { source: "/api/:path*", destination: `${process.env.CMS_API_URL || "http://localhost:9201"}/api/:path*` },
      // Proxy Geo API — OGC Features/Tiles + custom domain endpoints
      { source: "/geo/:path*", destination: `${process.env.GEO_API_URL || "http://localhost:9202"}/:path*` },
      // Proxy Titiler — COG Raster Tile Server
      { source: "/cog/:path*", destination: `${process.env.TITILER_API_URL || "http://localhost:9203"}/:path*` },
    ];
  },
};

export default nextConfig;
