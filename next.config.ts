import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No image optimizer is bound on Cloudflare; images in /public are pre-compressed, so serve them directly as static assets.
  images: { unoptimized: true },
};

export default nextConfig;
