import type { NextConfig } from "next";

// PREVIEW_EXPORT=1 builds a static, relative-path export for previewing as a single page.
const preview = process.env.PREVIEW_EXPORT === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(preview ? { output: "export", assetPrefix: "./", images: { unoptimized: true } } : {}),
};

export default nextConfig;
