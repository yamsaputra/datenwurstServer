/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    // The widget fetches its data same-origin; proxy the public API to the
    // api service so direct access to port 3000 keeps working.
    return [
      {
        source: '/api/v1/public/:path*',
        destination: `${process.env.INTERNAL_API_URL || 'http://api:3001'}/api/v1/public/:path*`,
      },
    ];
  },
};

export default nextConfig;
