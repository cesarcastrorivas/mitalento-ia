import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**', // Google Auth avatars
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/**', // Legacy Firebase Storage URLs
      },
      {
        protocol: 'https',
        hostname: '*.firebasestorage.app',
        pathname: '/**', // New Firebase Storage URLs (any project)
      },
    ],
  },
  async headers() {
    // Firebase domains needed for CSP connect-src
    const firebaseDomains = [
      'https://*.googleapis.com',
      'https://*.google.com',
      'https://*.firebaseio.com',
      'wss://*.firebaseio.com',
      'https://*.firebasestorage.app',
    ].join(' ');

    const csp = [
      "default-src 'self'",
      // Next.js requires 'unsafe-inline' for hydration; tighten with nonces in the future
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      // Allow images from Firebase Storage, Google Auth avatars, and data URIs
      "img-src 'self' https: data: blob:",
      "font-src 'self' data:",
      // Firebase SDK makes requests to these domains
      `connect-src 'self' ${firebaseDomains}`,
      // Videos served from Firebase Storage
      "media-src 'self' https: blob:",
      // Block all frame embedding (protects against clickjacking)
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; ');

    const securityHeaders = [
      // Prevent MIME-type sniffing
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      // Block all iframe embedding (backup for frame-ancestors CSP)
      { key: 'X-Frame-Options', value: 'DENY' },
      // Control referrer information
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // Restrict browser features
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      // Full CSP
      { key: 'Content-Security-Policy', value: csp },
    ];

    return [
      // Service Worker cache headers (existing)
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      // Security headers for all routes
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
