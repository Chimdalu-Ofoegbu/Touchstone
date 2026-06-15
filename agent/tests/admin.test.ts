// agent/tests/admin.test.ts
// Covers the determinism seam in resolveUpgradeAuthority (admin.ts): a contract
// REVERT/empty is a legitimate "absent" signal (-> null / fallthrough), but a
// TRANSPORT error must RE-THROW rather than silently degrade governance to
// "EOA"/"absent" and shift the hashed rationale at a fixed block (D-04).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContractFunctionZeroDataError } from "viem";

const { mockGetCode, mockGetStorageAt, mockReadContract } = vi.hoisted(() => ({
  mockGetCode: vi.fn(),
  mockGetStorageAt: vi.fn(),
  mockReadContract: vi.fn(),
}));

vi.mock("../src/rpc.js", () => ({
  publicClient: {
    getCode: mockGetCode,
    getStorageAt: mockGetStorageAt,
    readContract: mockReadContract,
  },
  // Passthrough — the production redactor just scrubs the URL; identity is fine here.
  redactRpcError: (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
}));

import { resolveUpgradeAuthority } from "../src/admin.js";

const BLOCK = 75_000_000n;
const SAFE = "0xC8A7870fFe41054612F7f3433E173D8b5bFcA8E3" as const;
const OWNER = "0x71a1f9186C381265c736544b70A24E23deCa5037" as const;

beforeEach(() => {
  mockGetCode.mockReset();
  mockGetStorageAt.mockReset();
  mockReadContract.mockReset();
});

describe("resolveUpgradeAuthority — classification + determinism seam", () => {
  it("classifies an owner() that is a Gnosis Safe as an M-of-N multisig", async () => {
    mockGetCode.mockResolvedValue("0x6080"); // has code -> contract
    mockReadContract.mockImplementation((args: { functionName: string }) => {
      if (args.functionName === "getOwners")
        return Promise.resolve([OWNER, OWNER, OWNER, OWNER, OWNER, OWNER]); // 6 owners
      if (args.functionName === "getThreshold") return Promise.resolve(4n);
      return Promise.reject(new Error("unexpected " + args.functionName));
    });
    const a = await resolveUpgradeAuthority(SAFE, SAFE, BLOCK);
    expect(a.kind).toBe("safe");
    expect(a.threshold).toBe(4);
    expect(a.ownerCount).toBe(6);
    expect(a.label).toContain("4-of-6 multisig");
  });

  it("RE-THROWS on a transport error (getCode) — never silently degrades", async () => {
    mockGetCode.mockRejectedValue(new Error("HTTP request failed: ECONNRESET"));
    await expect(resolveUpgradeAuthority(SAFE, SAFE, BLOCK)).rejects.toThrow();
  });

  it("RE-THROWS on a transport error during a Safe read (getThreshold)", async () => {
    mockGetCode.mockResolvedValue("0x6080");
    mockReadContract.mockImplementation((args: { functionName: string }) => {
      if (args.functionName === "getOwners")
        return Promise.resolve([OWNER, OWNER]);
      // getThreshold flakes at the transport layer -> must throw, not become null.
      return Promise.reject(new Error("HTTP request timed out"));
    });
    await expect(resolveUpgradeAuthority(SAFE, SAFE, BLOCK)).rejects.toThrow();
  });

  it("treats a contract-read revert/empty as a legitimate negative (not a Safe)", async () => {
    mockGetCode.mockResolvedValue("0x6080"); // a contract, but not a Safe
    mockReadContract.mockImplementation((args: { functionName: string }) =>
      Promise.reject(new ContractFunctionZeroDataError({ functionName: args.functionName })),
    );
    const a = await resolveUpgradeAuthority(SAFE, SAFE, BLOCK);
    expect(a.kind).toBe("contract");
    expect(a.address).toBeTruthy();
  });

  it("classifies an owner with no code as an EOA", async () => {
    mockGetCode.mockResolvedValue("0x"); // no code
    const a = await resolveUpgradeAuthority(OWNER, OWNER, BLOCK);
    expect(a.kind).toBe("eoa");
  });
});
