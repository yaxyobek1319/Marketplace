import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // TypeScript 5 provides the compiler API; avoids detached CLI output issues in sandboxes.
  experimental: { useTypeScriptCli: false, cpus: 2 },
};
export default config;
