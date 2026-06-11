#!/usr/bin/env node
// agent/src/mint-identity.ts
// One-shot: mint the agent's ERC-8004 Identity NFT from the canonical Mantle
// Mainnet registry via register(agentURI), capturing the returned agentId.
// REQ-03. D-01: this is the FIRST ordering step of Phase 3 — the agentId it
// produces is the redeploy's constructor arg.
//
// Flow:
//   1. Build the EIP-8004 registration-v1 agent-card JSON (registrations OMITTED
//      at mint — agentId is only known after the tx; Open Question 3).
//   2. pin() the card → cardCid;  agentURI = "ipfs://" + cardCid.
//   3. register(agentURI) from the agent EOA (walletClient).
//   4. waitForTransactionReceipt → parseEventLogs(Registered, fallback Transfer)
//      → agentId. Log agentId + txHash + cardCid to stdout.
//
// --dry-run: does steps 1-2 (real pin) then SIMULATES step 3 via
// publicClient.simulateContract (eth_call, NO broadcast) and prints the agentId
// the mint WOULD assign. Proves the path before the single live mint.
//
// T-03-13: every catch funnels through redactRpcError; PRIVATE_KEY/PINATA_JWT
// never logged.

import canonicalize from "canonicalize";
import { parseEventLogs, type Hex } from "viem";
import { mantle } from "viem/chains";
import { walletClient, account, redactRpcError } from "./wallet.js";
import { publicClient } from "./rpc.js";
import { pin } from "./ipfs.js";
import { identityRegistryAbi } from "./identity-abi.js";

// Canonical ERC-8004 Identity Registry — Mantle Mainnet ONLY (chain 5000).
// Verified deployed (CONTEXT pre-flight). Do NOT point this at Sepolia.
const IDENTITY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;
const ZERO = "0x0000000000000000000000000000000000000000";

/** EIP-8004 registration-v1 agent card (registrations omitted at mint). */
function buildAgentCard(): string {
  const card = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "Touchstone",
    description:
      "Credit-ratings agent for on-chain RWA assets on Mantle. Ingests risk data, scores four deterministic dimensions, and uses Claude to synthesize a letter grade (AAA-D) with cited rationale, published on-chain with a verifiable reasoning hash.",
    image: "ipfs://",
    services: [
      {
        name: "rating-registry",
        description:
          "Publishes RWA credit ratings on-chain; reasoningHash == keccak256(canonical reasoning JSON).",
      },
    ],
  };
  const out = canonicalize(card);
  if (typeof out !== "string") {
    throw new Error("agent card failed to canonicalize");
  }
  return out;
}

/** Extract the minted agentId from the receipt (Registered, fallback Transfer). */
function agentIdFromLogs(logs: readonly unknown[]): bigint | undefined {
  const reg = parseEventLogs({
    abi: identityRegistryAbi,
    logs: logs as never,
    eventName: "Registered",
  });
  if (reg.length > 0) return (reg[0] as { args: { agentId: bigint } }).args.agentId;
  const xfer = parseEventLogs({
    abi: identityRegistryAbi,
    logs: logs as never,
    eventName: "Transfer",
  });
  const mint = xfer.find(
    (l) => (l as { args: { from: string } }).args.from.toLowerCase() === ZERO,
  );
  return mint ? (mint as { args: { tokenId: bigint } }).args.tokenId : undefined;
}

async function main() {
  const dryRun = process.argv.slice(2).includes("--dry-run");

  // Steps 1-2: build + pin the agent card (real pin in both modes).
  const cardCanonical = buildAgentCard();
  const cardCid = await pin(cardCanonical);
  const agentURI = "ipfs://" + cardCid;
  process.stdout.write("agent-card CID: " + cardCid + "\n");
  process.stdout.write("agentURI:       " + agentURI + "\n");

  if (dryRun) {
    // Step 3 (simulate only — eth_call, NO broadcast).
    const { result } = await publicClient.simulateContract({
      address: IDENTITY,
      abi: identityRegistryAbi,
      functionName: "register",
      args: [agentURI],
      account: account.address,
    });
    process.stdout.write(
      "DRY-RUN ok — register() simulated; would mint agentId=" +
        String(result) +
        " to " +
        account.address +
        " (NOT broadcast)\n",
    );
    return;
  }

  // Step 3 (LIVE): broadcast register(agentURI).
  process.stdout.write("Broadcasting register(agentURI) from " + account.address + " ...\n");
  const hash: Hex = await walletClient.writeContract({
    address: IDENTITY,
    abi: identityRegistryAbi,
    functionName: "register",
    args: [agentURI],
    account,
    chain: mantle,
  });
  process.stdout.write("mint tx: " + hash + "\n");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const agentId = agentIdFromLogs(receipt.logs);
  if (agentId === undefined) {
    throw new Error(
      "mint receipt parsed but no Registered/Transfer(0x0) log found — inspect tx " + hash,
    );
  }
  process.stdout.write("status:  " + receipt.status + "\n");
  process.stdout.write("agentId: " + String(agentId) + "\n");
  process.stdout.write(
    "\nNext: set AGENT_TOKEN_ID=" +
      String(agentId) +
      " in root .env, then redeploy RatingRegistry.\n",
  );
}

main().catch((e) => {
  // T-03-13: scrub the (possibly keyed) RPC URL from any error before stderr.
  const err = redactRpcError(e);
  process.stderr.write("ERROR: " + err.message + "\n");
  process.exit(1);
});
