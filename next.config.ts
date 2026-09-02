import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  // Vercel terminates TLS for every request already; this just stops a
  // browser from ever trying plain http:// again for this origin.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    // 'unsafe-inline' on script-src is a real tradeoff, not an oversight:
    // Next.js's App Router streams the RSC payload as inline <script> tags
    // on every page, which CSP blocks outright without either
    // 'unsafe-inline' or a per-request nonce. A nonce would have to be
    // minted and injected by middleware on every request, which is exactly
    // the cost the marketing pages' static-caching fix (see nav-auth.tsx)
    // was written to avoid paying. The other directives (script origin
    // restricted to self, no plugins/objects via default-src, no framing)
    // still meaningfully narrow what an XSS payload could do — and this is
    // a plain React app with no dangerouslySetInnerHTML rendering user
    // input (the one use, in the marketing page's JSON-LD, is a hardcoded
    // static object), so the actual XSS surface CSP is defending here is
    // already small. frame-ancestors
    // mirrors X-Frame-Options for browsers that only honor CSP.
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: https:",
      "connect-src 'self' https://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
