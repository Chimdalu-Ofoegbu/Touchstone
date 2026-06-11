// agent/tests/setup-fork-env.ts
// setupFile for vitest.live.config.ts ONLY. The RUN_LIVE anvil-fork test needs
// the REAL agent PRIVATE_KEY + RATING_REGISTRY_ADDRESS. vitest does not auto-load
// .env, so load the root .env (cwd is agent/ when run via `pnpm test:fork`)
// BEFORE the test file imports publish.ts -> wallet.ts (which reads PRIVATE_KEY
// at module load). If .env is absent the test fails loudly — that is correct for
// a live run.
import { existsSync } from "node:fs";

if (existsSync("../.env")) {
  process.loadEnvFile("../.env");
}
