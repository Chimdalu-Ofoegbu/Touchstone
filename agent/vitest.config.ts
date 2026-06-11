import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/**/*.live.test.ts", "node_modules", "dist"],
    setupFiles: ["tests/setup-env.ts"],
    testTimeout: 15_000,
  },
});
