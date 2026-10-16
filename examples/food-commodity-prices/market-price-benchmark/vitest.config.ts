import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // 'server-only' throws outside Next.js's server build, so tests load its empty version.
  resolve: { alias: { 'server-only': fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url)) } },
  test: { include: ['lib/**/*.test.ts'] },
})
