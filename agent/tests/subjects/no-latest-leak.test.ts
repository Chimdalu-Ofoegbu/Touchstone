// agent/tests/subjects/no-latest-leak.test.ts
// Task 2-02-03 — block-pinning thread-through tripwire per RESEARCH §10
// threat-model row "Replay-at-block reads inconsistent if `latest` snuck in"
// and PATTERNS "Block-pinning thread-through".
//
// Reads each adapter source file as text and:
//   1. Asserts that every multiread( call site has `blockNumber` within a
//      4-line window (handles arg-list wrapping).
//   2. Asserts NO direct raw viem client batched/single read calls — the
//      adapters MUST go through the multiread helper.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ADAPTER_FILES = ["usdy.ts", "cmeth.ts", "fbtc.ts"];

describe("[2-02-03 no-latest-leak] block-pinning thread-through", () => {
  for (const f of ADAPTER_FILES) {
    it(`${f} threads blockNumber to every multiread call`, () => {
      const text = readFileSync(
        resolve(__dirname, "../../src/subjects/", f),
        "utf8",
      );
      // Strip line-comments to avoid false positives from prose explaining
      // the rule.
      const code = text
        .split("\n")
        .filter((l) => !l.trim().startsWith("//"))
        .join("\n");
      const lines = code.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("multiread(")) {
          // Look at this line + next 3 for a *blockNumber reference.
          // Case-insensitive so the CR-02 resolved-block identifier
          // (`resolvedBlockNumber`) still satisfies the pin — the intent is
          // that SOME concrete block is threaded to multiread, never `latest`.
          const window = lines
            .slice(i, Math.min(i + 4, lines.length))
            .join("\n");
          expect(window).toMatch(/blockNumber/i);
        }
      }
    });

    it(`${f} does not call viem publicClient batched/single reads directly`, () => {
      const text = readFileSync(
        resolve(__dirname, "../../src/subjects/", f),
        "utf8",
      );
      // Adapters MUST go through the multiread helper, which always passes
      // blockNumber. Strip line-comments first so the tripwire doesn't fire
      // on prose that names the forbidden methods.
      const code = text
        .split("\n")
        .filter((l) => !l.trim().startsWith("//"))
        .join("\n");
      expect(code).not.toMatch(/publicClient\.multicall/);
      expect(code).not.toMatch(/publicClient\.readContract/);
    });
  }
});
