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
const HEARTBEAT_MS = 15_000;
// Per-subject re-rate cooldown (seconds). The watcher skips a RatingRequested for a
// subject it already scored within this window — the real, un-bypassable rate limit
// (a direct contract call can still emit the event, but we won't re-score/publish).
// Demo default 60s; set RERATE_COOLDOWN_S=21600 (6h) for production. 0 disables it.
const RERATE_COOLDOWN_S = Number(process.env.RERATE_COOLDOWN_S ?? 60);

export type WatchDeps = {
  publishRatingFor: (subject: SubjectId) => Promise<unknown>;
  /** Subjects with a publish in flight — the double-fire dedupe guard (D-03). */
  inFlight: Set<SubjectId>;
  /** Injectable loggers (tests silence them; production uses console). */
  log?: (msg: string) => void;
  error?: (msg: string) => void;
  /** Re-rate cooldown in seconds; 0 (or omitted) disables the debounce. */
  cooldownS?: number;
  /**
   * Reads the on-chain timestamp (unix seconds) of a subject's latest rating,
   * 0 if none. Injected by the live daemon; omitted in tests (debounce off).
   */
  latestRatingTs?: (subject: `0x${string}`) => Promise<number>;
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
    scoreSubject(id, address, deps)
      .catch((e) => error("\n>>> FAILED " + id + " -> " + redactRpcError(e).message + "\n"))
      .finally(() => inFlight.delete(id));
  }
}

/**
 * Cooldown debounce + publish for one caught request. If a latestRatingTs reader
 * is wired and the subject was rated within cooldownS, skip the re-rate (the real
 * rate limit — protects Claude/IPFS/gas even against direct contract calls).
 */
async function scoreSubject(id: SubjectId, address: `0x${string}`, deps: WatchDeps): Promise<void> {
  const log = deps.log ?? ((m) => console.log(m));
  const cooldownS = deps.cooldownS ?? 0;
  if (cooldownS > 0 && deps.latestRatingTs) {
    const ts = await deps.latestRatingTs(address);
    const ageS = Math.floor(Date.now() / 1000) - ts;
    if (ts > 0 && ageS < cooldownS) {
      log("\n>>> COOLDOWN " + id + " — rated " + ageS + "s ago (< " + cooldownS + "s), skipping re-rate\n");
      return;
    }
  }
  const r = (await deps.publishRatingFor(id)) as {
    txHash?: string;
    cid?: string;
    reasoningHash?: string;
  };
  log(
    "\n>>> PUBLISHED " + id +
      "\n      tx:            " + r.txHash +
      "\n      cid:           " + r.cid +
      "\n      reasoningHash: " + r.reasoningHash + "\n",
  );
}

/**
 * Subscribe to RatingRequested by POLLING eth_getLogs over a moving block range
 * (publicClient.getContractEvents), NOT eth_newFilter/eth_getFilterChanges.
 *
 * Mantle's load-balanced public RPC does not retain server-side filters across
 * nodes (eth_getFilterChanges -> "filter not found"), which makes viem's
 * filter-based watchContractEvent churn dead filters and silently miss events.
 * Stateless getLogs polling is the reliable subscription (what indexers use).
 *
 * Resilience (Pitfall 3): a transient RPC error is reported via onError and
 * polling CONTINUES from the same lastBlock — a hiccup never freezes the daemon
 * or skips a block range. Returns a stop handle.
 */
function startWatch(deps: WatchDeps): () => void {
  const onError = (e: unknown) =>
    (deps.error ?? ((m) => console.error(m)))(redactRpcError(e).message);

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastBlock: bigint | undefined; // highest block already scanned

  const tick = async () => {
    if (stopped) return;
    try {
      const head = await publicClient.getBlockNumber();
      const fromBlock = lastBlock === undefined ? head : lastBlock + 1n;
      if (fromBlock <= head) {
        const logs = await publicClient.getContractEvents({
          address: REGISTRY,
          abi: ratingRegistryAbi,
          eventName: "RatingRequested",
          fromBlock,
          toBlock: head,
        });
        lastBlock = head; // advance only after a successful scan (no gaps/overlap)
        if (logs.length > 0)
          handleLogs(logs as readonly RatingRequestedLog[], deps);
      } else {
        lastBlock = head;
      }
    } catch (e) {
      onError(e); // keep polling — a transient RPC hiccup must not kill the daemon
    } finally {
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    }
  };

  void tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

async function main() {
  if (!REGISTRY) {
    process.stderr.write("ERROR: RATING_REGISTRY_ADDRESS is not set in .env\n");
    process.exit(1);
  }
  const deps: WatchDeps = {
    publishRatingFor,
    inFlight: new Set<SubjectId>(),
    cooldownS: RERATE_COOLDOWN_S,
    // Real, on-chain-anchored rate limit: skip re-scoring a subject rated within the window.
    latestRatingTs: async (subject) => {
      const r = await publicClient.readContract({
        address: REGISTRY,
        abi: ratingRegistryAbi,
        functionName: "latestRating",
        args: [subject],
      });
      return Number((r as { timestamp: bigint }).timestamp);
    },
  };
  startWatch(deps);
  console.log("\n=== Touchstone agent watcher LIVE ===");
  console.log("Listening for RatingRequested on " + REGISTRY + " (Mantle Mainnet, chain 5000)");
  console.log("Re-rate cooldown: " + RERATE_COOLDOWN_S + "s (per subject)");
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
