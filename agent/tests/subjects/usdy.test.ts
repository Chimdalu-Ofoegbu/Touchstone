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

// CR-02: the adapter resolves chain head via resolveBlockNumber when no block
// is supplied. Mock it to a fixed fake head so the no-block path is hermetic
// (no live RPC) and asserts the resolved block is stamped — never 0.
vi.mock("../../src/rpc.js", () => ({
  resolveBlockNumber: vi.fn(async (b?: bigint) => b ?? 88_000_000n),
}));

// admin.ts does live on-chain reads to resolve/classify the upgrade authority.
// Mock ONLY resolveUpgradeAuthority (the I/O); keep authorityToOwnerFact real
// (partial mock via importOriginal) so the adapter builds the fact for real.
const { mockResolveAuthority } = vi.hoisted(() => ({ mockResolveAuthority: vi.fn() }));
vi.mock("../../src/admin.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/admin.js")>()),
  resolveUpgradeAuthority: mockResolveAuthority,
}));
const SAFE = {
  address: "0xC8A7870fFe41054612F7f3433E173D8b5bFcA8E3",
  kind: "safe" as const,
  threshold: 4,
  ownerCount: 7,
  label: "Gnosis Safe 4-of-7 multisig",
  via: "EIP-1967 admin slot → ProxyAdmin.owner()",
};
const NONE = {
  address: null,
  kind: "none" as const,
  threshold: null,
  ownerCount: null,
  label: "unresolved",
  via: "owner() / EIP-1967 admin slot",
};

import { multiread } from "../../src/multicall.js";
import { fetchUsdy } from "../../src/subjects/usdy.js";

describe("[2-02-02 USDY] adapter", () => {
  beforeEach(() => {
    vi.mocked(multiread).mockReset();
    mockResolveAuthority.mockReset();
    mockResolveAuthority.mockResolvedValue(SAFE);
  });

  it("returns SubjectFacts with subject.chainId == 5000 and locked address", async () => {
    vi.mocked(multiread).mockResolvedValue(usdyMulticallSuccess);
    const facts = await fetchUsdy(75_000_000n);
    expect(facts.subject.chainId).toBe(5000);
    expect(facts.subject.address).toBe(
      "0x5bE26527e817998A7206475496fDE1E68957c5A6",
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
    // owner() reverted and the admin slot did not resolve → unresolved authority.
    mockResolveAuthority.mockResolvedValue(NONE);
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

  it("resolves chain head and stamps THAT block (never 0) when blockNumber is omitted (CR-02)", async () => {
    vi.mocked(multiread).mockResolvedValue(usdyMulticallSuccess);
    // No --block: resolveBlockNumber (mocked to 88_000_000n) supplies a
    // concrete head; the adapter must stamp it, not 0 (the D-04 latest leak).
    const facts = await fetchUsdy();
    expect(facts.ingestBlock).toBe(88_000_000);
    // multiread received the resolved concrete block, not undefined/latest.
    const callArgs = vi.mocked(multiread).mock.calls[0];
    expect(callArgs[1]).toBe(88_000_000n);
    // every onchain Fact carries the same resolved block.
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
