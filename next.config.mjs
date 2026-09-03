/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }
      ]
    }, {
      source: "/tool-logo.webp",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }]
    }, {
      source: "/signup-bg.png",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }]
    }];
  }
};
export default nextConfig;
