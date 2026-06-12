"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/lib/wallet";
import { shortHash } from "@/lib/touchstone";

function WalletIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3.5" width="12" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10.5 8h2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Masthead wallet control: a prominent connect CTA, or a connected chip with a
 *  dropdown that exposes the address, network, and an explicit Disconnect. */
export function ConnectWallet() {
  const { address, connecting, hasWallet, isMantle, connect, disconnect, ensureMantle } = useWallet();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!address) {
    return (
      <button
        type="button"
        onClick={() => connect()}
        disabled={connecting || !hasWallet}
        title={hasWallet ? "Connect an EVM wallet" : "No EVM wallet detected"}
        className="inline-flex min-h-8 items-center gap-2 border border-accent bg-accent px-4 py-1.5 font-mono text-2xs uppercase tracking-label text-bg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-hi disabled:opacity-50"
      >
        <WalletIcon />
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex min-h-8 items-center gap-2 border rule px-3 py-1.5 font-mono text-2xs uppercase tracking-label text-ink transition-colors hover:bg-surface focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: isMantle ? "rgb(var(--ts-prime))" : "rgb(var(--ts-watch))" }}
          aria-hidden="true"
        />
        {shortHash(address)}
        <Chevron open={open} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[12rem] border rule-strong bg-surface-2"
        >
          <div className="border-b rule px-3 py-2.5">
            <div className="label">Connected</div>
            <div className="mt-1 font-mono text-2xs text-ink">{shortHash(address, 10, 8)}</div>
            <div
              className="mt-1 font-mono text-2xs uppercase tracking-label"
              style={{ color: isMantle ? "rgb(var(--ts-prime))" : "rgb(var(--ts-watch))" }}
            >
              {isMantle ? "Mantle Mainnet" : "Wrong network"}
            </div>
          </div>
          {!isMantle && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                ensureMantle();
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left font-mono text-2xs uppercase tracking-label text-watch transition-colors hover:bg-surface"
            >
              Switch to Mantle
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
            className="block w-full px-3 py-2 text-left font-mono text-2xs uppercase tracking-label text-distress transition-colors hover:bg-surface"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
