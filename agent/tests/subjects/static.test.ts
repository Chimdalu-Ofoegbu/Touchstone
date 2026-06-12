// agent/tests/subjects/static.test.ts
// Task 2-02-01 — RED then GREEN.
// Asserts the locked behavior of:
//   - agent/src/subjects/static.ts (STATIC_VERSION, STATIC, staticFact)
//   - agent/src/constants/prices.ts (PRICES, priceAtBlock)
//   - agent/src/multicall.ts (multiread empty-list edge)
//   - agent/src/rpc.ts (redactRpcUrl — T-2-03 mitigation)

import { describe, it, expect } from "vitest";
import {
  STATIC,
  STATIC_VERSION,
  staticFact,
} from "../../src/subjects/static.js";
import { priceAtBlock, PRICES } from "../../src/constants/prices.js";
import { multiread } from "../../src/multicall.js";
import { redactRpcUrl, redactRpcError } from "../../src/rpc.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("[2-02-01a] STATIC facts module", () => {
  it("STATIC_VERSION is locked to '1.0.0'", () => {
    expect(STATIC_VERSION).toBe("1.0.0");
  });

  it.each(["USDY", "cmETH", "FBTC"] as const)(
    "STATIC.%s has non-empty collateral, audit, oracleArchitecture",
    (id) => {
      const s = STATIC[id];
      expect(s.collateral.length).toBeGreaterThan(0);
      expect(s.audit.length).toBeGreaterThan(0);
      expect(s.oracleArchitecture.length).toBeGreaterThan(0);
    },
  );

  it("STATIC.USDY address is the locked Mantle Mainnet address", () => {
    expect(STATIC.USDY.address).toBe(
      "0x5bE26527e817998A7206475496fDE1E68957c5A6",
    );
  });

  it("STATIC.cmETH address is the locked Mantle Mainnet address", () => {
    expect(STATIC.cmETH.address).toBe(
      "0xE6829d9a7eE3040e1276Fa75293Bde931859e8fA",
    );
  });

  it("STATIC.FBTC address is the locked Mantle Mainnet address", () => {
    expect(STATIC.FBTC.address).toBe(
      "0xC96dE26018A54D51c097160568752c4E3BD6C364",
    );
  });

  it("staticFact() builds Fact with versioned source", () => {
    const f = staticFact({
      label: "issuer",
      value: "Ondo Finance",
      evidence: "Ondo issues USDY.",
    });
    expect(f.source).toEqual({
      kind: "static",
      file: "agent/src/subjects/static.ts",
      version: "1.0.0",
    });
    expect(f.label).toBe("issuer");
    expect(f.value).toBe("Ondo Finance");
    expect(f.evidence).toBe("Ondo issues USDY.");
  });
});

describe("[2-02-01b] Prices lookup (hash determinism)", () => {
  it("priceAtBlock(0) returns the default entry with positive prices", () => {
    const p = priceAtBlock(0);
    expect(p.BTC_USD).toBeGreaterThan(0);
    expect(p.ETH_USD).toBeGreaterThan(0);
    expect(p.MNT_USD).toBeGreaterThan(0);
  });

  it("priceAtBlock(75_000_000) returns an entry containing BTC/ETH/MNT", () => {
    const p = priceAtBlock(75_000_000);
    expect(p).toHaveProperty("BTC_USD");
    expect(p).toHaveProperty("ETH_USD");
    expect(p).toHaveProperty("MNT_USD");
    expect(p.BTC_USD).toBeGreaterThan(0);
    expect(p.ETH_USD).toBeGreaterThan(0);
    expect(p.MNT_USD).toBeGreaterThan(0);
  });

  it("PRICES is non-empty and ordered by recordedAtBlock ascending", () => {
    expect(PRICES.length).toBeGreaterThan(0);
    for (let i = 1; i < PRICES.length; i++) {
      expect(PRICES[i].recordedAtBlock).toBeGreaterThanOrEqual(
        PRICES[i - 1].recordedAtBlock,
      );
    }
  });
});

describe("[2-02-01c] Multicall + RPC redaction (T-2-03)", () => {
  it("multiread([]) returns empty array without RPC call", async () => {
    const result = await multiread([]);
    expect(result).toEqual([]);
  });

  it("redactRpcUrl scrubs MANTLE_RPC_URL out of error messages", () => {
    // Default MANTLE_RPC_URL is https://rpc.mantle.xyz when env var is absent;
    // ensure that exact URL is replaced by [redacted].
    const msg = "error fetching from https://rpc.mantle.xyz/foo: timeout";
    const redacted = redactRpcUrl(msg);
    expect(redacted.includes("https://rpc.mantle.xyz")).toBe(false);
    expect(redacted.includes("[redacted]")).toBe(true);
  });

  it("redactRpcUrl returns the original message when URL not present", () => {
    const msg = "an unrelated message";
    expect(redactRpcUrl(msg)).toBe(msg);
  });

  it("redactRpcError wraps a thrown value as an Error with the RPC URL scrubbed (CR-03)", () => {
    const err = redactRpcError(
      new Error("HttpRequestError: POST https://rpc.mantle.xyz/foo failed"),
    );
    expect(err).toBeInstanceOf(Error);
    expect(err.message.includes("https://rpc.mantle.xyz")).toBe(false);
    expect(err.message.includes("[redacted]")).toBe(true);
  });

  // CR-03 root cause was "redactRpcUrl defined but never called in production."
  // This tripwire keeps the redactor WIRED at every live RPC site so the leak
  // cannot silently regress to zero call sites again.
  it("every production RPC call site funnels errors through the redactor (CR-03)", () => {
    const srcRoot = resolve(__dirname, "../../src");
    const mustRedact: Array<[string, RegExp]> = [
      ["multicall.ts", /redactRpcError/],
      ["rate.ts", /redactRpcError/],
      ["rpc.ts", /redactRpcError/],
      ["cli.ts", /redactRpcUrl/],
    ];
    for (const [file, pattern] of mustRedact) {
      const text = readFileSync(resolve(srcRoot, file), "utf8");
      // Strip line-comments so prose mentioning the symbol doesn't count.
      const code = text
        .split("\n")
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
        .join("\n");
      expect(code).toMatch(pattern);
    }
  });
});
