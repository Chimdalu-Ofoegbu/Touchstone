// agent/src/rpc.ts
// viem PublicClient bound to Mantle Mainnet (chain 5000) per D-02 and D-05.
// MANTLE_RPC_URL is read from root .env via `tsx --env-file=../.env` (see
// agent/package.json `rate` script) or process.env at import time. The
// default fallback is the public Mantle endpoint.
//
// T-2-03 mitigation: redactRpcUrl() scrubs the URL (which may carry an
// Alchemy/Infura API key) from any error message before it is logged or
// serialized into JSON output. Adapters that catch RPC errors MUST run
// them through redactRpcUrl before re-throwing or logging.

import { createPublicClient, http, type PublicClient } from "viem";
import { mantle } from "viem/chains";

const MANTLE_RPC_URL = process.env.MANTLE_RPC_URL ?? "https://rpc.mantle.xyz";

export const publicClient: PublicClient = createPublicClient({
  chain: mantle,
  transport: http(MANTLE_RPC_URL, {
    retryCount: 2,
    timeout: 15_000,
  }),
  batch: { multicall: true },
});

/**
 * Resolve a concrete block number to pin an ingest against. CR-02 / D-04:
 * when the caller omits a block, chain head MUST be read ONCE to a concrete
 * number, and that same number used for BOTH the multicall reads and the
 * provenance stamp. Otherwise the reads run at `latest` while provenance
 * records block 0 — a non-replayable rating Phase 4 can never reproduce.
 *
 * When a block IS supplied it is returned unchanged (no RPC round-trip), so
 * historical replay and unit tests that pass an explicit block never touch
 * the network here.
 */
export async function resolveBlockNumber(
  blockNumber?: bigint,
): Promise<bigint> {
  if (blockNumber !== undefined) return blockNumber;
  try {
    return await publicClient.getBlockNumber();
  } catch (e) {
    throw redactRpcError(e);
  }
}

/**
 * Redact MANTLE_RPC_URL (which may contain an Alchemy/Infura API key)
 * from any error message. T-2-03 mitigation per RESEARCH §10.
 */
export function redactRpcUrl(message: string): string {
  if (!message || !MANTLE_RPC_URL) return message;
  return message.split(MANTLE_RPC_URL).join("[redacted]");
}

/**
 * CR-03 / T-2-03: wrap an unknown thrown value as an Error whose message has
 * the (possibly keyed) RPC URL scrubbed. viem transport failures embed the
 * endpoint URL in their message, so EVERY production RPC call site must funnel
 * its catch through this before the error reaches a log, stderr, or JSON
 * output. redactRpcUrl alone is inert — this is its wiring.
 */
export function redactRpcError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  return new Error(redactRpcUrl(msg));
}

/** Test-only export — for redaction tests; not part of public API. */
export const __test = { MANTLE_RPC_URL };
