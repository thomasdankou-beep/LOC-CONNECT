/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  images: {
    // Les photos privées passent toujours par le contrôle d’accès, sans cache d’images partagé.
    localPatterns: [
      { pathname: "/api/files/public/**" },
      { pathname: "/brand/**" },
      { pathname: "/_next/static/media/**" },
      { pathname: "/icon.svg" },
    ],
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
