// agent/tests/subjects/usdy.test.ts
// Task 2-02-02 — USDY adapter contract per the PLAN behaviors (tests 1-6).
// Uses vi.mock to inject fixture multicall results so we do NOT touch
// a live RPC at unit-test time.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  usdyMulticallSuccess,
  usdyMulticallAllFail,
} from "../fixtures/usdy.fixture.js";

vi.mock("../../src/multicall.js", () => ({
  multiread: vi.fn(),
}));

import { multiread } from "../../src/multicall.js";
import { fetchUsdy } from "../../src/subjects/usdy.js";

describe("[2-02-02 USDY] adapter", () => {
  beforeEach(() => {
    vi.mocked(multiread).mockReset();
  });

  it("returns SubjectFacts with subject.chainId == 5000 and locked address", async () => {
    vi.mocked(multiread).mockResolvedValue(usdyMulticallSuccess);
    const facts = await fetchUsdy(75_000_000n);
    expect(facts.subject.chainId).toBe(5000);
    expect(facts.subject.address).toBe(
      "0x5be26527e817998A7206475496fDE1E68957c5A6",
    );
    expect(facts.subject.ticker).toBe("USDY");
    expect(facts.subject.name.length).toBeGreaterThan(0);
  });

  it("threads blockNumber through every onchain Fact source", async () => {
    vi.mocked(multiread).mockResolvedValue(usdyMulticallSuccess);
    const facts = await fetchUsdy(75_000_000n);
    const allOnchain = [
      ...facts.collateral,
      ...facts.contract,
      ...facts.oracle,
      ...facts.liquidity,
    ].filter((f) => f.source.kind === "onchain");
    expect(allOnchain.length).toBeGreaterThan(0);
    for (const f of allOnchain) {
      // type-narrowed by the filter above
      const src = f.source as Extract<typeof f.source, { kind: "onchain" }>;
      expect(src.blockNumber).toBe(75_000_000);
    }
  });

  it("emits null value (missing fact) when multicall returns all failures", async () => {
    vi.mocked(multiread).mockResolvedValue(usdyMulticallAllFail);
    const facts = await fetchUsdy(75_000_000n);
    const allOnchain = [
      ...facts.collateral,
      ...facts.contract,
      ...facts.oracle,
      ...facts.liquidity,
    ].filter((f) => f.source.kind === "onchain");
    expect(allOnchain.length).toBeGreaterThan(0);
    for (const f of allOnchain) {
      expect(f.value).toBeNull();
    }
  });

  it("populates static facts in collateral and oracle buckets with version '1.0.0'", async () => {
    vi.mocked(multiread).mockResolvedValue(usdyMulticallSuccess);
    const facts = await fetchUsdy(75_000_000n);
    const staticCollateral = facts.collateral.filter(
      (f) => f.source.kind === "static",
    );
    const staticOracle = facts.oracle.filter(
      (f) => f.source.kind === "static",
    );
    expect(staticCollateral.length).toBeGreaterThanOrEqual(2);
    expect(staticOracle.length).toBeGreaterThanOrEqual(1);
    for (const f of [...staticCollateral, ...staticOracle]) {
      const src = f.source as Extract<typeof f.source, { kind: "static" }>;
      expect(src.version).toBe("1.0.0");
    }
  });

  it("at least 2 facts in each of collateral/contract/oracle/liquidity on success path", async () => {
    vi.mocked(multiread).mockResolvedValue(usdyMulticallSuccess);
    const facts = await fetchUsdy(75_000_000n);
    expect(facts.collateral.length).toBeGreaterThanOrEqual(2);
    expect(facts.contract.length).toBeGreaterThanOrEqual(2);
    expect(facts.oracle.length).toBeGreaterThanOrEqual(2);
    expect(facts.liquidity.length).toBeGreaterThanOrEqual(2);
  });

  it("multiread is called with the supplied blockNumber", async () => {
    vi.mocked(multiread).mockResolvedValue(usdyMulticallSuccess);
    await fetchUsdy(75_000_000n);
    const callArgs = vi.mocked(multiread).mock.calls[0];
    expect(callArgs[1]).toBe(75_000_000n);
  });

  it("ingestBlock is 0 when blockNumber is omitted", async () => {
    vi.mocked(multiread).mockResolvedValue(usdyMulticallSuccess);
    const facts = await fetchUsdy();
    expect(facts.ingestBlock).toBe(0);
  });
});
