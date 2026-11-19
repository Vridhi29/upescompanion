/** @type {import('next').NextConfig} */
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const nextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@upes/core", "@upes/schemas", "@upes/connectors"],
  outputFileTracingRoot: projectRoot,
};
export default nextConfig;
