import { defineConfig } from 'vitest/config';
import { cloudflarePool, cloudflareTest } from '@cloudflare/vitest-plugin';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './test/worker/wrangler.jsonc' },
    }),
  ],
  test: {
    globals: true,
    pool: cloudflarePool({
      wrangler: { configPath: './test/worker/wrangler.jsonc' },
    }),
    include: ['test/worker/**/*.test.ts'],
    testTimeout: 30000,
  },
});
