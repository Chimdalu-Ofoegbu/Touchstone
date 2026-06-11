import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to web/ (the repo has multiple lockfiles: foundry/agent).
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
