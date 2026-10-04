import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Static shells + streamed personalised parts; data cached with "use cache" and tags.
  cacheComponents: true,
  // Prefetch one reusable App Shell per route instead of one request per link.
  partialPrefetching: true,
  // Automatic memoisation — fewer re-renders (big win for the bulk uploader).
  reactCompiler: true,
  experimental: {
    // Keep visited/prefetched pages in the client router for instant back/forward.
    staleTimes: { dynamic: 30, static: 300 },
    serverActions: {
      // community submissions send small generated thumbnails along with the form
      bodySizeLimit: "4mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/brand/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/pdf.worker.min.mjs",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      },
    ];
  },
};

export default nextConfig;
