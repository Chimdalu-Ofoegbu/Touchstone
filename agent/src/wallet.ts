// agent/src/wallet.ts
// viem WalletClient bound to Mantle Mainnet (chain 5000) — the WRITE-side twin
// of the read-only publicClient in rpc.ts (D-01, RESEARCH §1 Pattern 1).
//
// PRIVATE_KEY and MANTLE_RPC_URL are read from the root .env via
// `tsx --env-file-if-exists=../.env` (see agent/package.json scripts) or
// process.env at import time. The same key mints the ERC-8004 identity,
// redeploys RatingRegistry, and signs publishRating (CONTEXT prereqs).
// The RPC fallback mirrors rpc.ts exactly — one chain + transport contract
// across read and write.
//
// T-03-06 / T-03-07 mitigation: the write path may surface the (possibly
// keyed) RPC URL in transport errors. EVERY catch around a walletClient
// call MUST funnel through redactRpcError (re-exported here from rpc.ts —
// do NOT duplicate the redact logic). PRIVATE_KEY itself never appears in
// viem error messages, but the secret-scrub discipline is identical to the
// read path (see rate.ts catch idiom).

import { createWalletClient, http, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mantle } from "viem/chains";

// Re-export the single redaction contract so write-path call sites
// (publish.ts, mint-identity.ts) import it from wallet.ts OR rpc.ts
// interchangeably — there is exactly ONE implementation (rpc.ts).
export { redactRpcError, redactRpcUrl } from "./rpc.js";

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const MANTLE_RPC_URL = process.env.MANTLE_RPC_URL ?? "https://rpc.mantle.xyz";

/**
 * The agent account derived from the root-.env PRIVATE_KEY. Holds the minted
 * ERC-8004 Identity NFT and is the sole signing authority for publishRating
 * (the on-chain ownerOf gate enforces this — D-01). Hoisted onto walletClient
 * below so call sites need not pass `account` per write.
 */
export const account = privateKeyToAccount(PRIVATE_KEY);

/**
 * Mantle Mainnet (chain 5000) write client. Mirrors rpc.ts's publicClient
 * transport config (retryCount 2, 15s timeout) and the same MANTLE_RPC_URL
 * fallback, so read and write share one endpoint contract.
 */
export const walletClient: WalletClient = createWalletClient({
  account,
  chain: mantle,
  transport: http(MANTLE_RPC_URL, {
    retryCount: 2,
    timeout: 15_000,
  }),
});
