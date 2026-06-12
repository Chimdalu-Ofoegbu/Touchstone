// agent/src/publish.ts
// D-03: the ONE shared publish pipeline. Both the RatingRequested watcher
// (Plan 06) and the manual `pnpm publish-rating` CLI call publishRatingFor —
// publish logic is written exactly ONCE.
//
// Pipeline (REQ-02 real publish + REQ-04 hash/cid binding):
//   rate(subject)                  Phase 2 engine, ONCE -> { doc, reasoningHash }
//   canonicalizeDoc(doc)           the EXACT bytes that were hashed (Pitfall 1)
//   pin(canonical)                 bare Pinata raw-file CID — never a re-serialized doc
//   publishRating(... cid)         cid + reasoningHash in ONE tx (atomic, D-02)
//   waitForTransactionReceipt
//   parseEventLogs(RatingPublished) -> assert on-chain hash+cid === sent (or "diverged")
//
// Discipline:
//   - T-03-15/16: the reasoningHash sent is the engine's computeReasoningHash(doc),
//     the pinned bytes are the SAME canonical string, both land atomically, and the
//     parsed-event guard rejects any divergence.
//   - T-03-18: the write catch funnels through redactRpcError (keyed RPC URL scrub).
//   - CR-04: NO second chain-head / engine read here — rate() already pinned the
//     block; grade/confidence come straight from its doc.

import { parseEventLogs, getAddress, type Hex } from "viem";
import { mantle } from "viem/chains";
import { rate as defaultRate } from "./rate.js";
import { canonicalizeDoc } from "./hash.js";
import { pin as defaultPin } from "./ipfs.js";
import {
  walletClient as defaultWalletClient,
  account,
  redactRpcError,
} from "./wallet.js";
import { publicClient as defaultPublicClient } from "./rpc.js";
import { ratingRegistryAbi } from "./registry-abi.js";
import type { SubjectId } from "./subjects/types.js";

// The once-only Mainnet RatingRegistry (Plan 03), read from the root .env.
const REGISTRY = process.env.RATING_REGISTRY_ADDRESS as `0x${string}`;

export type PublishResult = { cid: string; reasoningHash: Hex; txHash: Hex };

// Injectable seams default to the real imports, so the pipeline is provable
// against a mock walletClient / publicClient / pin / rate with zero network/gas.
export type PublishDeps = {
  rate?: typeof defaultRate;
  pin?: typeof defaultPin;
  walletClient?: Pick<typeof defaultWalletClient, "writeContract">;
  publicClient?: Pick<typeof defaultPublicClient, "waitForTransactionReceipt">;
  registry?: `0x${string}`;
};

export async function publishRatingFor(
  subject: SubjectId,
  deps: PublishDeps = {},
): Promise<PublishResult> {
  const {
    rate = defaultRate,
    pin = defaultPin,
    walletClient = defaultWalletClient,
    publicClient = defaultPublicClient,
    registry = REGISTRY,
  } = deps;

  const { doc, reasoningHash } = await rate(subject); // Phase 2 engine, ONCE
  const canonical = canonicalizeDoc(doc); // EXACT hashed bytes — the SAME string the hash used
  const cid = await pin(canonical); // bare Pinata raw-file CID — never a re-serialized doc

  let txHash: Hex;
  try {
    txHash = await walletClient.writeContract({
      address: registry,
      abi: ratingRegistryAbi,
      functionName: "publishRating",
      // cid is the BARE CID (D-02); grade/confidence come straight from the rate() doc.
      // getAddress normalizes the subject to canonical EIP-55 (defense-in-depth):
      // the engine does NOT override doc.subject.address (it's echoed from Claude),
      // so any non-canonical checksum that reached the doc would be rejected by
      // viem's strict-validating write path. The on-chain subject is a 20-byte
      // value, so normalizing the write arg does NOT change the pinned doc or the
      // reasoningHash — verifiability is unaffected. (STATIC is now canonical too.)
      args: [
        getAddress(doc.subject.address),
        doc.grade.uint8,
        reasoningHash,
        doc.confidence,
        cid,
      ],
      account,
      chain: mantle,
    });
  } catch (e) {
    throw redactRpcError(e); // T-03-18: scrub the keyed RPC URL on the write path
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const [evt] = parseEventLogs({
    abi: ratingRegistryAbi,
    eventName: "RatingPublished",
    logs: receipt.logs,
  });
  // D-02 silent-failure guard: the rating actually on-chain must equal what we sent.
  if (!evt || evt.args.reasoningHash !== reasoningHash || evt.args.cid !== cid) {
    throw new Error(
      "on-chain RatingPublished diverged from the intended hash/cid (subject=" +
        subject +
        ")",
    );
  }
  return { cid, reasoningHash, txHash };
}
