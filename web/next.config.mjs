const API_ORIGIN = process.env.API_ORIGIN || "http://localhost:3000"

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // The one-shot AI routes (drill scenario/grade, stress test, strategy mode)
  // are single non-streaming Nemotron calls that legitimately take 30-120s on
  // NVIDIA's hosted tier. The dev rewrite proxy below forwards /api/* to
  // Express, and Next's proxy defaults to a 30s timeout (see
  // next/dist/server/lib/router-utils/proxy-request.js) — which killed every
  // slow AI request with a 500 before Express could answer. Raise it well past
  // the worst observed latency so the browser gets the real response. Dev-only
  // (prod runs Next in-process in Express, no proxy hop).
  experimental: {
    proxyTimeout: 180_000,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: import.meta.dirname,
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` },
      { source: "/uploads/:path*", destination: `${API_ORIGIN}/uploads/:path*` },
      { source: "/case-uploads/:path*", destination: `${API_ORIGIN}/case-uploads/:path*` },
      { source: "/generated/:path*", destination: `${API_ORIGIN}/generated/:path*` },
    ]
  },
}

export default nextConfig
