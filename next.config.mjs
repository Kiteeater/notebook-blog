import fs from "node:fs";
import path from "node:path";

const siblingContentDir = path.resolve(process.cwd(), "..", "blog-content");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: fs.existsSync(siblingContentDir)
    ? path.resolve(process.cwd(), "..")
    : process.cwd(),
  async redirects() {
    return [
      // 旧路由永久迁移到 /writing
      { source: "/posts/:slug", destination: "/writing/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
