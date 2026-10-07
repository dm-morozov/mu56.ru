import type { NextConfig } from "next";

const config: NextConfig = {
  output: process.env.DOCKER_STANDALONE === "1" ? "standalone" : undefined,
  poweredByHeader: false,
  devIndicators: false,
  allowedDevOrigins: (process.env.NEXT_DEV_ALLOWED_ORIGINS || "").split(",").map(host => host.trim()).filter(Boolean),
  images: {
    formats: ["image/webp"],
    localPatterns: [{ pathname: "/media/**", search: "" }, { pathname: "/uploads/**", search: "" }, { pathname: "/_next/static/media/**", search: "" }],
  },
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const origin = process.env.BACKEND_ORIGIN || "http://127.0.0.1:8000";
    return [
      { source: "/api/:path*", destination: `${origin}/api/:path*/` },
      { source: "/uploads/:path*", destination: `${origin}/uploads/:path*` },
    ];
  },
};
export default config;

