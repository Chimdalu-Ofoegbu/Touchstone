#!/usr/bin/env node
// agent/src/watch.ts
// RatingRequested watcher daemon (NET-NEW — RESEARCH §2). The PRIMARY trigger
// path (D-03): listens on the Mainnet RatingRegistry, maps each requested
// subject ADDRESS -> SubjectId, and invokes the shared publishRatingFor(subject)
// pipeline once per event. Drives the REQ-10 demo moment ("trigger from the UI,
// watch it react").
//
// Invariants:
//   - dedupe double-fire via an inFlight Set — safe alongside the manual CLI (T-03-20)
//   - reject unknown subject addresses without crashing (subjectIdFromAddress -> null; T-03-21)
//   - reconnect on a dropped subscription with backoff (onError -> unwatch + restart; T-03-22)
//   - heartbeat log ~every 15s so liveness is visible during the demo (REQ-10)
//   - every caught error funnels through redactRpcError; PRIVATE_KEY/PINATA_JWT never logged (T-03-23)

import { publishRatingFor } from "./publish.js";
import { publicClient, redactRpcError } from "./rpc.js";
import { ratingRegistryAbi } from "./registry-abi.js";
import { subjectIdFromAddress } from "./subjects/address-map.js";
import type { SubjectId } from "./subjects/types.js";

const REGISTRY = process.env.RATING_REGISTRY_ADDRESS as `0x${string}`;
const POLL_MS = 4_000;
const RECONNECT_MS = 2_000;
const HEARTBEAT_MS = 15_000;

export type WatchDeps = {
  publishRatingFor: (subject: SubjectId) => Promise<unknown>;
  /** Subjects with a publish in flight — the double-fire dedupe guard (D-03). */
  inFlight: Set<SubjectId>;
  /** Injectable loggers (tests silence them; production uses console). */
  log?: (msg: string) => void;
  error?: (msg: string) => void;
};

/** Minimal shape of a decoded RatingRequested log (only the subject is used). */
type RatingRequestedLog = { args: { subject?: `0x${string}` } };

/**
 * Pure, testable event handler. For each RatingRequested log: map the subject
 * address -> SubjectId (skip+log unknowns), dedupe in-flight subjects, and fire
 * publishRatingFor exactly once per (non-in-flight) subject. Fire-and-forget so
 * a slow publish never blocks the poller; inFlight is cleared in finally.
 */
export function handleLogs(
  logs: readonly RatingRequestedLog[],
  deps: WatchDeps,
): void {
  const { publishRatingFor, inFlight } = deps;
  const log = deps.log ?? ((m) => console.log(m));
  const error = deps.error ?? ((m) => console.error(m));
  for (const l of logs) {
    const address = l.args.subject;
    if (!address) continue;
    const id = subjectIdFromAddress(address);
    if (id === null) {
      log("[skip] RatingRequested for unknown subject " + address);
      continue;
    }
    if (inFlight.has(id)) {
      log("[dedupe] " + id + " already in flight — skipping double-fire");
      continue;
    }
    inFlight.add(id);
    // Demo-clear "agent reacting" beat (REQ-10) — reads on camera.
    log("\n>>> RatingRequested CAUGHT -> " + id + " (" + address + ") — running the rating pipeline now...\n");
    publishRatingFor(id)
      .then((r) => {
        const res = r as { txHash?: string; cid?: string; reasoningHash?: string };
        log(
          "\n>>> PUBLISHED " + id +
            "\n      tx:            " + res.txHash +
            "\n      cid:           " + res.cid +
            "\n      reasoningHash: " + res.reasoningHash + "\n",
        );
      })
      .catch((e) => error("\n>>> FAILED " + id + " -> " + redactRpcError(e).message + "\n"))
      .finally(() => inFlight.delete(id));
  }
}

/**
 * Open the RatingRequested subscription; on error, unwatch and reconnect with
 * backoff (Pitfall 3 — a silently dropped subscription would freeze the demo).
 * Returns an unwatch handle.
 */
function startWatch(deps: WatchDeps): () => void {
  let unwatch: () => void = () => {};
  const begin = () => {
    unwatch = publicClient.watchContractEvent({
      address: REGISTRY,
      abi: ratingRegistryAbi,
      eventName: "RatingRequested",
      pollingInterval: POLL_MS,
      onLogs: (logs) => handleLogs(logs as readonly RatingRequestedLog[], deps),
      onError: (err) => {
        (deps.error ?? ((m) => console.error(m)))(redactRpcError(err).message);
        unwatch();
        setTimeout(begin, RECONNECT_MS); // reconnect with backoff
      },
    });
  };
  begin();
  return () => unwatch();
}

async function main() {
  if (!REGISTRY) {
    process.stderr.write("ERROR: RATING_REGISTRY_ADDRESS is not set in .env\n");
    process.exit(1);
  }
  const deps: WatchDeps = {
    publishRatingFor,
    inFlight: new Set<SubjectId>(),
  };
  startWatch(deps);
  console.log("\n=== Touchstone agent watcher LIVE ===");
  console.log("Listening for RatingRequested on " + REGISTRY + " (Mantle Mainnet, chain 5000)");
  console.log("Trigger with: requestRating(<subject address>)  |  subjects: USDY, cmETH, FBTC\n");
  setInterval(() => {
    console.log(
      "[heartbeat] watching " + REGISTRY + " @ " + new Date().toISOString(),
    );
  }, HEARTBEAT_MS);
}

// Auto-start only as the entrypoint. Tests import handleLogs without launching a
// live subscription (vitest sets process.env.VITEST).
if (!process.env.VITEST) {
  main();
}
