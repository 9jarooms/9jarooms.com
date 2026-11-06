import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // enforced: no plugins, no redirecting the base URL, no framing, forms only to this site
  { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'" },
  // watched, not yet enforced: tighten once the reports are clean
  { key: "Content-Security-Policy-Report-Only", value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' https://zgumxpnsestwzmztagbr.supabase.co; connect-src 'self' https://zgumxpnsestwzmztagbr.supabase.co wss://zgumxpnsestwzmztagbr.supabase.co https://*.google-analytics.com https://www.google.com https://www.facebook.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; report-uri /api/csp-report" },
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
      { source: "/admin", destination: "/crm/activity", permanent: false },
      { source: "/admin/bookings/:path*", destination: "/crm/reservations", permanent: false },
      { source: "/admin/properties/:path*", destination: "/crm/properties", permanent: false },
      { source: "/admin/:page(admins|caretakers|operators|settings)/:path*", destination: "/crm/settings", permanent: false },
      // the old call-operator screen is retired too (no operators on the team)
      { source: "/operator/:path*", destination: "/crm/today", permanent: false },
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
