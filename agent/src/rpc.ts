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
 * Redact MANTLE_RPC_URL (which may contain an Alchemy/Infura API key)
 * from any error message. T-2-03 mitigation per RESEARCH §10.
 */
export function redactRpcUrl(message: string): string {
  if (!message || !MANTLE_RPC_URL) return message;
  return message.split(MANTLE_RPC_URL).join("[redacted]");
}

/** Test-only export — for redaction tests; not part of public API. */
export const __test = { MANTLE_RPC_URL };
