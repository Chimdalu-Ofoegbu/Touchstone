// agent/tests/cli.test.ts
// [2-05-02] CLI smoke tests for `pnpm rate <SUBJECT>` in --mock mode.
//
// Asserts (REQ-05 + T-2-07):
//   - all 3 locked subjects (USDY/cmETH/FBTC) succeed in --mock mode
//   - unknown subjects (T-2-07) exit non-zero with "Unknown subject"
//   - --out - writes canonical JSON to stdout (no file) followed by reasoningHash line
//
// The CLI is invoked via `npx tsx src/cli.ts ...` in a child process so we
// exercise the actual binary entrypoint, not the in-process rate() function.

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { existsSync, rmSync } from "node:fs";

const CLI = resolve(__dirname, "../src/cli.ts");
const AGENT_ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(AGENT_ROOT, "out");

// Cross-platform: invoke tsx via its plain-Node ESM entrypoint (no shell)
// so paths containing spaces are passed through argv unmangled. Using
// `node node_modules/tsx/dist/cli.mjs <CLI>` avoids the Windows .CMD
// wrapper which spawnSync cannot execute without shell:true (and shell:true
// breaks on paths containing spaces). spawnSync with shell:false treats
// every array element as a single argv entry — no quoting hazard.
const TSX_ESM = resolve(
  AGENT_ROOT,
  "node_modules",
  "tsx",
  "dist",
  "cli.mjs",
);

function run(args: string[]) {
  return spawnSync(process.execPath, [TSX_ESM, CLI, ...args], {
    encoding: "utf8",
    cwd: AGENT_ROOT,
  });
}

describe("[2-05-02] CLI smoke — all 3 subjects in --mock mode", () => {
  it.each(["USDY", "cmETH", "FBTC"])(
    "pnpm rate %s --mock exits 0 and prints reasoningHash",
    (subject) => {
      if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
      const r = run([subject, "--mock", "--block", "75000000"]);
      expect(r.status).toBe(0);
      expect(r.stdout).toMatch(/reasoningHash=0x[0-9a-f]{64}/);
    },
  );

  it("pnpm rate UNKNOWN --mock exits non-zero (T-2-07)", () => {
    const r = run(["NotASubject", "--mock"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/Unknown subject/);
  });

  it("pnpm rate USDY --mock --out - writes canonical JSON to stdout (no file)", () => {
    if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
    const r = run(["USDY", "--mock", "--out", "-", "--block", "75000000"]);
    expect(r.status).toBe(0);
    // Output: canonical JSON on the first line(s), then "reasoningHash=0x..." line.
    // W1 fix: split on the reasoningHash boundary and verify each part independently.
    const [jsonPart, hashLine] = r.stdout.split(/\n(?=reasoningHash=)/);
    expect(() => JSON.parse(jsonPart)).not.toThrow();
    expect(hashLine).toMatch(/^reasoningHash=0x[0-9a-f]{64}/);
  });
});
