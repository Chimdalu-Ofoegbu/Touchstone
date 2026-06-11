import { defineConfig } from "vitest/config";

// Dedicated config for the RUN_LIVE anvil-fork end-to-end test(s). The default
// vitest.config.ts EXCLUDES tests/**/*.live.test.ts so the standard `pnpm test`
// stays hermetic; this config INCLUDES only those files and loads the root .env
// (real PRIVATE_KEY + RATING_REGISTRY_ADDRESS) so they can run against anvil.
//   anvil --fork-url https://rpc.mantle.xyz --chain-id 5000
//   cd agent && pnpm test:fork
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.live.test.ts"],
    exclude: ["node_modules", "dist"],
    setupFiles: ["tests/setup-fork-env.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
