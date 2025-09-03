/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Remove deprecated appDir option
  },
  // Set dashboard to run on port 3001 to avoid conflicts
  env: {
    PORT: '3001'
  }
}

module.exports = nextConfig
