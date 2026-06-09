// agent/src/multicall.ts
// Multicall3 wrapper per D-03. The canonical Multicall3 contract is
// pre-wired in viem's `mantle` chain definition (canonical address per
// the Multicall3 deployment policy); we do NOT hand-hardcode the
// address here. Delegating to viem keeps the contract address out of
// our source so the acceptance criterion (no raw hex Multicall3 ref in
// this file) holds.
//
// D-04 contract: blockNumber MUST be threaded from the adapter argument
// so historical replay (Phase 3 Elixir deUSD reconstruction) returns
// consistent reads pinned to the target block.
//
// D-07 contract: the allow-failure code path means failed reads become
// ReadResult{ ok: false } entries. Adapters transform those into
// missing_facts on the SubjectFacts (the dimension scorer then applies
// the default-to-50 + confidence-drop policy in Wave 2).

import type { Abi, Address } from "viem";
import { publicClient } from "./rpc.js";

export type Read = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  /** Human-readable label — drives missing_facts and citations. */
  label: string;
};

export type ReadResult<T = unknown> =
  | { ok: true; value: T; label: string }
  | { ok: false; error: string; label: string };

/**
 * Batched read via viem's `client.multicall` action.
 *
 * Empty input short-circuits without an RPC round-trip (test asserted).
 *
 * D-03: caller batches reads into ≤ 3 multiread calls per subject.
 * D-04: blockNumber MUST be supplied by the calling adapter when pinning.
 * D-07: allow-failure path => per-read status is "success" | "failure";
 *       this function maps failures to { ok: false, error, label } so the
 *       caller never sees a thrown error for a single failed read.
 */
export async function multiread(
  reads: Read[],
  blockNumber?: bigint,
): Promise<ReadResult[]> {
  if (reads.length === 0) return [];
  const results = await publicClient.multicall({
    contracts: reads.map(({ label: _label, ...c }) => c),
    blockNumber,
    allowFailure: true,
  });
  return results.map((r, i) => {
    const label = reads[i].label;
    if (r.status === "success") {
      return { ok: true, value: r.result, label } as ReadResult;
    }
    const errAny = (r as { error?: { shortMessage?: string } }).error;
    const err = errAny?.shortMessage ?? String(errAny ?? "unknown");
    return { ok: false, error: String(err), label };
  });
}
