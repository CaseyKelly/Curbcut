import type { NextConfig } from 'next';

const config: NextConfig = {
  // Workspace packages ship TypeScript source, so Next compiles them.
  transpilePackages: ['@curbcut/core', '@curbcut/agent', '@curbcut/db'],
};

export default config;
