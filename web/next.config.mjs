const API_ORIGIN = process.env.API_ORIGIN || "http://localhost:3000"

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
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
