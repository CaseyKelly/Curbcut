import type { NextConfig } from 'next';

const config: NextConfig = {
  // Workspace packages ship TypeScript source, so Next compiles them.
  transpilePackages: ['@a11y-fixer/core', '@a11y-fixer/agent', '@a11y-fixer/db'],
};

export default config;
