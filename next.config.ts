import type { NextConfig } from "next";
import pkg from "./package.json";

// The version in "Help and feedback" emails: package version plus the commit Railway built.
const sha = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_APP_VERSION: sha ? `${pkg.version} (${sha})` : pkg.version },
};

export default nextConfig;
