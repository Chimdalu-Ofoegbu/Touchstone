// agent/tests/env-safety.test.ts
// [2-05-02 env-safety] T-2-01 mitigation proof — no API keys / secrets
// in committed files.
//
// Uses `git grep` so only tracked files are searched — .env / node_modules /
// out / .test-out are excluded automatically by git's own ignore rules.
//
// IMPORTANT — pattern design (Rule 1 fix during execution):
// Anthropic API keys are `sk-ant-api03-` followed by a long alphanumeric
// suffix. The PLAN.md and this test file itself legitimately MENTION
// the prefix as a literal string (as a documentation/test fixture). To
// avoid the test failing on its own documentation, the grep patterns are
// scoped to actual-key shapes (prefix + minimum-length alphanumeric suffix)
// rather than the bare prefix. Real keys are ALWAYS the full shape; doc
// references are ALWAYS the bare prefix. This is the same approach used
// by `gitleaks` and similar secret scanners.
//
// Additionally asserts the engine never reads PRIVATE_KEY from process.env
// (Phase 2 engine never signs — that's Phase 3 publisher's job).

import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

function gitTrackedSearch(pattern: string, ...pathspecs: string[]): string {
  // Search only git-tracked files so .env / node_modules / out are excluded automatically.
  const repoRoot = resolve(__dirname, "../..");
  // -E = ERE so we can use shape-based regexes (Anthropic key prefix + suffix).
  // pathspecs can include negative globs to exclude documentation files that
  // legitimately mention secret-pattern prefixes as literals.
  const parts = ["git", "grep", "-nIE", "--", JSON.stringify(pattern)];
  for (const ps of pathspecs) parts.push(JSON.stringify(ps));
  try {
    return execSync(parts.join(" "), {
      cwd: repoRoot,
      encoding: "utf8",
    });
  } catch (e) {
    // git grep exits 1 when no match — that's the success case.
    const err = e as { status?: number };
    if (err.status === 1) return "";
    throw e;
  }
}

describe("[2-05-02 env-safety] T-2-01 — no API keys in committed files", () => {
  it("no real Anthropic API key shapes in tracked files (sk-ant-api03-<long>)", () => {
    // Real Anthropic keys: sk-ant-api03- followed by ~95 alphanumeric+_- chars.
    // Use a conservative 20-char minimum suffix so doc references (bare prefix)
    // don't trip the assertion but a planted real key (full shape) would.
    const matches = gitTrackedSearch("sk-ant-api[0-9]+-[A-Za-z0-9_-]{20,}");
    expect(matches).toBe("");
  });
  it("no ANTHROPIC_API_KEY assignment to a real key value in tracked files", () => {
    // Match ANTHROPIC_API_KEY=<value> where value is a real key shape.
    // Bare `ANTHROPIC_API_KEY=sk-` in docs (no real suffix) is OK; this
    // catches actual leaked values.
    const matches = gitTrackedSearch(
      "ANTHROPIC_API_KEY=sk-ant-api[0-9]+-[A-Za-z0-9_-]{20,}",
    );
    expect(matches).toBe("");
  });
  it("no agent-local .env files exist (root .env is the single source)", () => {
    const repoRoot = resolve(__dirname, "../..");
    // T-2-01 mitigation by absence — root .env is loaded via tsx --env-file=../.env (Plan 01).
    expect(existsSync(resolve(repoRoot, "agent/.env"))).toBe(false);
    expect(existsSync(resolve(repoRoot, "agent/.env.example"))).toBe(false);
  });
  it("agent/src never reads PRIVATE_KEY from process.env (T-2-01: engine never signs)", () => {
    const matches = gitTrackedSearch("process\\.env\\.PRIVATE_KEY");
    const lines = matches.split("\n").filter((l) => l.startsWith("agent/src/"));
    expect(lines).toEqual([]);
  });
});
