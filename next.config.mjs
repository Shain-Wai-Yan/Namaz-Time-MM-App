/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // MUST add this for Capacitor to work
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
