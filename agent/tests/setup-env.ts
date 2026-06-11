// agent/tests/setup-env.ts
// vitest setupFile (runs before each test file's imports).
//
// The hermetic suite does NOT load the root .env — only the `tsx
// --env-file-if-exists=../.env` CLI scripts do. But publish.ts statically
// imports wallet.ts, which calls `privateKeyToAccount(process.env.PRIVATE_KEY)`
// at module-evaluation time; an undefined key throws on import. Seed THROWAWAY
// values ONLY when unset so the default suite can import the write-path modules
// (publish.ts / wallet.ts) without real credentials. Real runs (RUN_LIVE forks,
// the tsx scripts) already have the real values and are left untouched.
process.env.PRIVATE_KEY ??= "0x" + "1".repeat(64);
process.env.RATING_REGISTRY_ADDRESS ??=
  "0x0000000000000000000000000000000000000000";
