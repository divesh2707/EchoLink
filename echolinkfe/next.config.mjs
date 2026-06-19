/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.1.7', 'aaa-bytes-nail-mount.trycloudflare.com'],
   async rewrites() {
    return {
      fallback: [
        {
          source: '/api/:path*',
          destination: 'http://localhost:8080/:path*',
        },
      ],
    };
  },
};

export default nextConfig;
