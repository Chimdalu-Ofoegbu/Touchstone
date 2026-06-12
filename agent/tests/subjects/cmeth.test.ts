// agent/tests/subjects/cmeth.test.ts
// Task 2-02-03 — cmETH adapter contract per the PLAN behaviors (tests 1-6).

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  cmethMulticallSuccess,
  cmethMulticallAllFail,
} from "../fixtures/cmeth.fixture.js";

vi.mock("../../src/multicall.js", () => ({
  multiread: vi.fn(),
}));

// CR-02: hermetic head resolution — no live RPC when blockNumber is omitted.
vi.mock("../../src/rpc.js", () => ({
  resolveBlockNumber: vi.fn(async (b?: bigint) => b ?? 88_000_000n),
}));

import { multiread } from "../../src/multicall.js";
import { fetchCmeth } from "../../src/subjects/cmeth.js";

describe("[2-02-03 cmETH] adapter", () => {
  beforeEach(() => {
    vi.mocked(multiread).mockReset();
  });

  it("returns SubjectFacts with subject.chainId == 5000 and locked address", async () => {
    vi.mocked(multiread).mockResolvedValue(cmethMulticallSuccess);
    const facts = await fetchCmeth(75_000_000n);
    expect(facts.subject.chainId).toBe(5000);
    expect(facts.subject.address).toBe(
      "0xE6829d9a7eE3040e1276Fa75293Bde931859e8fA",
    );
    expect(facts.subject.ticker).toBe("cmETH");
  });

  it("threads blockNumber through every onchain Fact source", async () => {
    vi.mocked(multiread).mockResolvedValue(cmethMulticallSuccess);
    const facts = await fetchCmeth(75_000_000n);
    const allOnchain = [
      ...facts.collateral,
      ...facts.contract,
      ...facts.oracle,
      ...facts.liquidity,
    ].filter((f) => f.source.kind === "onchain");
    expect(allOnchain.length).toBeGreaterThan(0);
    for (const f of allOnchain) {
      const src = f.source as Extract<typeof f.source, { kind: "onchain" }>;
      expect(src.blockNumber).toBe(75_000_000);
    }
  });

  it("emits null value (missing fact) when multicall returns all failures", async () => {
    vi.mocked(multiread).mockResolvedValue(cmethMulticallAllFail);
    const facts = await fetchCmeth(75_000_000n);
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
    vi.mocked(multiread).mockResolvedValue(cmethMulticallSuccess);
    const facts = await fetchCmeth(75_000_000n);
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

  it("at least 2 facts in each bucket on success path", async () => {
    vi.mocked(multiread).mockResolvedValue(cmethMulticallSuccess);
    const facts = await fetchCmeth(75_000_000n);
    expect(facts.collateral.length).toBeGreaterThanOrEqual(2);
    expect(facts.contract.length).toBeGreaterThanOrEqual(2);
    expect(facts.oracle.length).toBeGreaterThanOrEqual(2);
    expect(facts.liquidity.length).toBeGreaterThanOrEqual(2);
  });

  it("multiread is called with the supplied blockNumber", async () => {
    vi.mocked(multiread).mockResolvedValue(cmethMulticallSuccess);
    await fetchCmeth(75_000_000n);
    const callArgs = vi.mocked(multiread).mock.calls[0];
    expect(callArgs[1]).toBe(75_000_000n);
  });

  it("resolves chain head and stamps THAT block (never 0) when blockNumber is omitted (CR-02)", async () => {
    vi.mocked(multiread).mockResolvedValue(cmethMulticallSuccess);
    const facts = await fetchCmeth();
    expect(facts.ingestBlock).toBe(88_000_000);
    const callArgs = vi.mocked(multiread).mock.calls[0];
    expect(callArgs[1]).toBe(88_000_000n);
    const onchain = [
      ...facts.collateral,
      ...facts.contract,
      ...facts.oracle,
      ...facts.liquidity,
    ].filter((f) => f.source.kind === "onchain");
    for (const f of onchain) {
      const src = f.source as Extract<typeof f.source, { kind: "onchain" }>;
      expect(src.blockNumber).toBe(88_000_000);
    }
  });
});
