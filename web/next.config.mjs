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
  // 20 minutes specifically covers /api/upload on Recording Insight's
  // full-round mode: without GROQ_API_KEY/HUME_API_KEY set, a long recording
  // falls back to local Whisper (scripts/lib/transcribe.mjs), which runs well
  // short of real-time on CPU — an hour-long file can take many minutes.
  experimental: {
    proxyTimeout: 1_200_000,
    // Next's dev rewrite proxy also caps the request body it'll forward —
    // 10MB by default, which silently truncates the body then aborts the
    // upstream request (Express sees "Request aborted" mid-multer-parse,
    // which surfaces to the browser as a plain socket hang up). A single
    // drilled/graded speech recording is well under that, but Recording
    // Insight's full-round mode uploads much longer audio — keep this in
    // sync with Express's own MAX_UPLOAD_BYTES (scripts/server.mjs).
    proxyClientMaxBodySize: "100mb",
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
