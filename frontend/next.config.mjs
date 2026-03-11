/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    return [
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
