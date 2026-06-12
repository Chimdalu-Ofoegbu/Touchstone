"use client";

import { useState } from "react";
import { createWalletClient, custom, getAddress } from "viem";
import { mantle } from "viem/chains";
import { ratingRegistryAbi } from "@/lib/registry-abi";
import { RATING_REGISTRY, EXPLORER } from "@/lib/touchstone";
import { useWallet } from "@/lib/wallet";
import { usePending } from "@/lib/pending";

type Eip1193 = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };

function getEthereum(): Eip1193 | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: Eip1193 }).ethereum;
}

/**
 * Lets anyone trigger an on-chain RatingRequested for an unrated subject, using
 * the shared wallet. The request is tracked in `usePending` (persisted), so the
 * "scoring" state survives refresh and clears automatically once the agent
 * publishes. We only build/submit the tx — the visitor signs.
 */
export function TriggerRating({
  subjectId,
  subjectAddress,
  rerate = false,
  className,
}: {
  subjectId: string;
  subjectAddress: string;
  rerate?: boolean;
  className?: string;
}) {
  const { address, connect, ensureMantle } = useWallet();
  const { isPending, pending, markPending } = usePending();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pending (agent scoring) — shown until the published rating replaces this row.
  if (isPending(subjectId)) {
    const tx = pending[subjectId]?.txHash;
    const inner = (
      <>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />
        Agent scoring…{tx ? " ↗" : ""}
      </>
    );
    const cls =
      "inline-flex min-h-6 items-center gap-1.5 font-mono text-2xs uppercase tracking-label text-accent";
    return tx ? (
      <a href={`${EXPLORER}/tx/${tx}`} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    ) : (
      <span className={cls}>{inner}</span>
    );
  }

  async function onTrigger() {
    setError(null);
    const eth = getEthereum();
    if (!eth) {
      setError("No wallet detected");
      return;
    }
    try {
      setBusy(true);
      const acct = address ?? (await connect());
      if (!acct) {
        setBusy(false);
        return; // user dismissed the connect prompt
      }
      await ensureMantle();
      const wallet = createWalletClient({ account: getAddress(acct), chain: mantle, transport: custom(eth) });
      const hash = await wallet.writeContract({
        address: RATING_REGISTRY,
        abi: ratingRegistryAbi,
        functionName: "requestRating",
        args: [getAddress(subjectAddress)],
      });
      markPending(subjectId, subjectAddress, hash); // swaps this control to "Agent scoring…"
    } catch (e) {
      const msg =
        (e as { shortMessage?: string; message?: string })?.shortMessage ??
        (e as { message?: string })?.message ??
        "Request failed";
      setError(/user rejected|denied/i.test(msg) ? "Rejected in wallet" : msg.slice(0, 64));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      {error && (
        <span className="font-mono text-2xs uppercase tracking-label text-distress" role="alert">
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={onTrigger}
        disabled={busy}
        className={
          className ??
          "inline-flex min-h-6 items-center gap-1 font-mono text-2xs uppercase tracking-label text-accent transition-colors hover:text-accent-hi focus:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-60"
        }
      >
        {busy ? "Confirm in wallet…" : rerate ? "Re-rate ↻" : "Trigger a rating →"}
      </button>
    </span>
  );
}
