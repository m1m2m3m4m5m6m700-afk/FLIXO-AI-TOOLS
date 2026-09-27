import path from "node:path";
import { fileURLToPath } from "node:url";
const appRoot=path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot=path.resolve(appRoot,"../..");
/** @type {import("next").NextConfig} */
const nextConfig={reactStrictMode:true,turbopack:{root:repositoryRoot}};
export default nextConfig;
