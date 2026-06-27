"use client";

import { useState } from "react";
import type { Hex } from "viem";
import { verifyReasoning, type VerifyResult } from "@/lib/verify";
import { shortHash } from "@/lib/touchstone";

type State = { status: "idle" } | { status: "checking" } | { status: "done"; result: VerifyResult };

/**
 * Reasoning-hash verify control (REQ): independently re-fetches the pinned JSON
 * by its on-chain cid, keccak256s the exact bytes in the browser, and compares to
 * the on-chain reasoningHash — reproducing the agent's binding so a visitor can
 * trust the rating without trusting Touchstone.
 */
export function VerifyControl({ cid, reasoningHash }: { cid: string; reasoningHash: Hex }) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function run() {
    setState({ status: "checking" });
    const result = await verifyReasoning(cid, reasoningHash);
    setState({ status: "done", result });
  }

  const r = state.status === "done" ? state.result : null;
  const tone =
    r?.status === "match" ? "prime" : r?.status === "mismatch" ? "distress" : r?.status === "error" ? "watch" : null;

  return (
    <div className="border rule-strong p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label mb-1">Reasoning verification</p>
          <p className="max-w-md text-xs text-muted">
            Re-fetch the reasoning JSON from IPFS, hash it in your browser, and check it against the
            hash stored on-chain.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={state.status === "checking"}
          className="inline-flex min-h-6 items-center border border-accent bg-accent px-4 py-2 font-mono text-2xs uppercase tracking-label text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {state.status === "checking" ? "Verifying…" : "Verify against IPFS"}
        </button>
      </div>

      {r && (
        <div className="mt-4 border-t rule pt-4">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" style={{ color: `rgb(var(--ts-${tone}))` }}>
              {r.status === "match" ? "●" : r.status === "mismatch" ? "▲" : "○"}
            </span>
            <span className="text-sm font-medium" style={{ color: `rgb(var(--ts-${tone}))` }}>
              {r.status === "match"
                ? "Verified — IPFS reasoning matches the on-chain hash"
                : r.status === "mismatch"
                  ? "Mismatch — pinned bytes do not reproduce the on-chain hash"
                  : "Could not reach a gateway — try again"}
            </span>
          </div>

          {r.status !== "error" && (
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 font-mono text-2xs text-muted sm:grid-cols-[auto_1fr]">
              <dt className="text-faint">on-chain hash</dt>
              <dd className="break-all text-ink">{shortHash(r.onChainHash, 10, 8)}</dd>
              <dt className="text-faint">re-hashed bytes</dt>
              <dd className="break-all" style={{ color: `rgb(var(--ts-${tone}))` }}>
                {shortHash(r.computedHash, 10, 8)}
              </dd>
              <dt className="text-faint">gateway</dt>
              <dd className="text-ink">
                {r.gateway.replace(/^https?:\/\//, "")} · {r.bytes} bytes
              </dd>
            </dl>
          )}
          {r.status === "mismatch" && (
            <p className="mt-3 text-2xs text-distress">
              This indicates the pinned content differs from what was rated — do not trust this
              rating until reconciled.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
