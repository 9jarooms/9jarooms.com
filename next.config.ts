import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  images: {
    // Serve images straight from Supabase Storage instead of Vercel's image
    // optimizer. The optimizer hit its monthly quota (402 Payment Required),
    // which broke every not-yet-cached thumbnail. Uploads are already
    // compressed (<=1MB, 1920px) via MediaUploader, so raw delivery is fine.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "zgumxpnsestwzmztagbr.supabase.co",
        pathname: "/storage/**",
      },
    ],
  },
  // The old admin portal is retired: its addresses (bookmarks) open the new console instead.
  // Only owner management still lives there, at /admin/owners.
  async redirects() {
    return [
      { source: "/admin", destination: "/crm/overview", permanent: false },
      { source: "/admin/bookings/:path*", destination: "/crm/reservations", permanent: false },
      { source: "/admin/properties/:path*", destination: "/crm/properties", permanent: false },
      { source: "/admin/:page(admins|caretakers|operators|settings)/:path*", destination: "/crm/settings", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
