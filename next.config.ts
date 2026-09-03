import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.245.157", "localhost", "127.0.0.1"],
  outputFileTracingIncludes: {
    "/api/chat": ["./content/public/**/*"],
  },
};

export default nextConfig;
