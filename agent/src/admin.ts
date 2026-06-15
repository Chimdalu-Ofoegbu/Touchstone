// agent/src/admin.ts
// Reusable, on-chain, block-pinned resolution + classification of a subject's
// upgrade/admin authority — the "who can change or halt this token" signal the
// contract_risk dimension grades on. This is the generalized form of the manual
// procedure used to correct USDY: resolve the real controller (owner() or, when
// that reverts on a transparent proxy, the EIP-1967 admin slot → ProxyAdmin),
// then verify whether it is a genuine M-of-N multisig (Gnosis Safe) vs a single
// key. Every adapter calls this so ratings are real and verifiable, and any new
// subject added later inherits the same procedure for free.
//
// Determinism (D-04): EVERY read is pinned to the supplied blockNumber, so a
// replay at the same block reproduces the result byte-for-byte. A read is only
// allowed to resolve to "absent" when the CHAIN says so — a contract revert or
// empty return (owner() not exposed on a transparent proxy, getOwners() on a
// non-Safe). A TRANSPORT/RPC failure is NOT a chain signal: it is re-thrown
// (redacted) so a network flake can never masquerade as "no owner"/"EOA" and
// silently change the classification (and thus the hashed rationale) at a fixed
// block — same block gives the same answer, or the run fails loudly. No raw RPC
// error (which may embed a keyed URL) is ever propagated (T-2-03): callOrNull
// and rawRead funnel transport errors through redactRpcError.

import {
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  getAddress,
  type Address,
  type Hex,
} from "viem";
import { publicClient, redactRpcError } from "./rpc.js";
import type { Fact } from "./subjects/types.js";
import { staticFact } from "./subjects/static.js";

// EIP-1967 admin slot: bytes32(uint256(keccak256("eip1967.proxy.admin")) - 1).
const EIP1967_ADMIN_SLOT: Hex =
  "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

const SAFE_ABI = [
  { type: "function", name: "getOwners", stateMutability: "view", inputs: [], outputs: [{ type: "address[]" }] },
  { type: "function", name: "getThreshold", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
const OWNABLE_ABI = [
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

export type AuthorityKind = "safe" | "eoa" | "contract" | "none";

export type UpgradeAuthority = {
  /** Resolved controlling address (checksummed), or null if unresolved. */
  address: string | null;
  kind: AuthorityKind;
  /** Signer threshold / owner count when kind === "safe". */
  threshold: number | null;
  ownerCount: number | null;
  /** Human label for the rationale, e.g. "Gnosis Safe 4-of-7 multisig". */
  label: string;
  /** How it was resolved — surfaced in the citation evidence. */
  via: string;
};

const UNRESOLVED: UpgradeAuthority = {
  address: null,
  kind: "none",
  threshold: null,
  ownerCount: null,
  label: "unresolved",
  via: "owner() / EIP-1967 admin slot",
};

/**
 * True when an error means the call EXECUTED but produced no usable value — it
 * reverted or returned empty data (owner() absent on a transparent proxy,
 * getOwners() on a non-Safe). A legitimate chain signal, not a transport failure.
 */
function isExecutionEmpty(e: unknown): boolean {
  return (
    e instanceof BaseError &&
    !!e.walk(
      (err) =>
        err instanceof ContractFunctionRevertedError ||
        err instanceof ContractFunctionZeroDataError,
    )
  );
}

/**
 * Contract read that returns null on a legitimate revert/empty result, but
 * RE-THROWS (redacted) on a transport/RPC error. The determinism seam: a flaky
 * endpoint fails the run rather than silently degrading governance to "absent"
 * and shifting the hashed rationale at a fixed block (D-04).
 */
async function callOrNull<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    if (isExecutionEmpty(e)) return null;
    throw redactRpcError(e);
  }
}

/**
 * Raw eth_ read (getCode / getStorageAt) — these don't "revert", so any error
 * is transport and is re-thrown (redacted), never swallowed.
 */
async function rawRead<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw redactRpcError(e);
  }
}

function wordToAddress(word: Hex | null | undefined): Address | null {
  if (!word || /^0x0+$/.test(word)) return null;
  try {
    return getAddress("0x" + word.slice(-40));
  } catch {
    return null;
  }
}

async function isContract(address: Address, blockNumber: bigint): Promise<boolean> {
  const code = await rawRead(() => publicClient.getCode({ address, blockNumber }));
  return !!code && code !== "0x";
}

/** Classify a resolved controller: EOA, Gnosis Safe (M-of-N), or other contract. */
async function classify(
  address: Address,
  blockNumber: bigint,
  via: string,
): Promise<UpgradeAuthority> {
  if (!(await isContract(address, blockNumber))) {
    return { address, kind: "eoa", threshold: null, ownerCount: null, label: "EOA (single key)", via };
  }
  const [owners, threshold] = await Promise.all([
    callOrNull(() => publicClient.readContract({ address, abi: SAFE_ABI, functionName: "getOwners", blockNumber })) as Promise<readonly Address[] | null>,
    callOrNull(() => publicClient.readContract({ address, abi: SAFE_ABI, functionName: "getThreshold", blockNumber })) as Promise<bigint | null>,
  ]);
  if (owners && threshold != null && owners.length > 0) {
    const n = Number(threshold);
    const m = owners.length;
    const multisig = n >= 2 && m >= 2;
    return {
      address,
      kind: "safe",
      threshold: n,
      ownerCount: m,
      label: `Gnosis Safe ${n}-of-${m}${multisig ? " multisig" : " (single signer)"}`,
      via,
    };
  }
  return { address, kind: "contract", threshold: null, ownerCount: null, label: "contract (non-Safe admin)", via };
}

/**
 * Resolve a subject's upgrade authority on-chain at a pinned block.
 *  1. If owner() returned a value, classify it directly.
 *  2. Otherwise read the EIP-1967 admin slot. If it holds a ProxyAdmin (a
 *     contract exposing owner()), classify that owner; else classify the admin.
 *
 * @param proxy         the subject token address (whose admin slot is read)
 * @param ownerFromCall the result of the adapter's owner() read (null if it reverted)
 * @param blockNumber   the pinned ingest block (all reads use it)
 */
export async function resolveUpgradeAuthority(
  proxy: Address,
  ownerFromCall: string | null,
  blockNumber: bigint,
): Promise<UpgradeAuthority> {
  // (1) owner() exposed directly.
  if (ownerFromCall && ownerFromCall.toLowerCase() !== ZERO_ADDR) {
    const owner = wordToAddress(("0x" + ownerFromCall.replace(/^0x/, "").padStart(40, "0").slice(-40)) as Hex);
    if (owner) return classify(owner, blockNumber, "owner()");
  }
  // (2) owner() not exposed (e.g. a transparent proxy) — read the admin slot.
  const adminWord = await rawRead(() =>
    publicClient.getStorageAt({ address: proxy, slot: EIP1967_ADMIN_SLOT, blockNumber }),
  );
  const admin = wordToAddress(adminWord);
  if (!admin) return UNRESOLVED;

  // A ProxyAdmin contract administers the proxy; its owner() is the true authority.
  if (await isContract(admin, blockNumber)) {
    const proxyAdminOwner = (await callOrNull(() =>
      publicClient.readContract({ address: admin, abi: OWNABLE_ABI, functionName: "owner", blockNumber }),
    )) as Address | null;
    if (proxyAdminOwner && proxyAdminOwner.toLowerCase() !== ZERO_ADDR) {
      return classify(getAddress(proxyAdminOwner), blockNumber, "EIP-1967 admin slot → ProxyAdmin.owner()");
    }
  }
  // Admin slot present but not a ProxyAdmin-with-owner — classify the admin itself.
  return classify(admin, blockNumber, "EIP-1967 admin slot");
}

/**
 * Build the contract-bucket "owner" Fact from a resolved authority. Pure (no
 * I/O) so it stays real in unit tests that mock only resolveUpgradeAuthority.
 *
 *  - resolved   → an on-chain Fact whose value embeds the M-of-N characterization
 *                 (so the cited rationale describes the real governance), pinned
 *                 to the ingest block and citing the proxy address.
 *  - unresolved → fall back to a static-config admin (demo/robustness) if one is
 *                 recorded; otherwise a null on-chain owner (the scorer's risk
 *                 signal — the -10 owner-missing heuristic fires honestly).
 */
export function authorityToOwnerFact(
  authority: UpgradeAuthority,
  proxy: Address,
  ingestBlock: number,
  staticFallback: string | null,
): Fact {
  if (authority.address) {
    return {
      label: "owner",
      value: `${authority.address} — ${authority.label}`,
      evidence: `Upgrade authority resolved on-chain (${authority.via}): ${authority.label}.`,
      source: { kind: "onchain", address: proxy, function: authority.via, blockNumber: ingestBlock },
    };
  }
  if (staticFallback) {
    return staticFact({
      label: "owner",
      value: staticFallback,
      evidence:
        "owner() is not exposed on the proxy and the live admin-slot read did not resolve; upgrade admin recorded in static config (verified on-chain).",
    });
  }
  return {
    label: "owner",
    value: null,
    evidence: "Owner / upgrade authority could not be resolved on-chain (owner() reverted and no EIP-1967 admin slot).",
    source: { kind: "onchain", address: proxy, function: "owner() / EIP-1967 admin slot", blockNumber: ingestBlock },
  };
}
