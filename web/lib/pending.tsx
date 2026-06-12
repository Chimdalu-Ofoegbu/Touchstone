"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Address } from "viem";
import { getLatestRating } from "./touchstone";

export type PendingEntry = { address: string; txHash: string; since: number };
type PendingMap = Record<string, PendingEntry>; // keyed by subjectId

type PendingState = {
  pending: PendingMap;
  isPending: (subjectId: string) => boolean;
  markPending: (subjectId: string, address: string, txHash: string) => void;
  clearPending: (subjectId: string) => void;
};

const PendingCtx = createContext<PendingState | null>(null);
const STORE_KEY = "ts-pending";
const POLL_MS = 12_000;
const GIVE_UP_S = 900; // stop polling a request after 15 min

function load(): PendingMap {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as PendingMap) : {};
  } catch {
    return {};
  }
}

export function PendingProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingMap>({});
  const router = useRouter();

  // hydrate after mount (localStorage is client-only → avoids SSR mismatch)
  useEffect(() => {
    setPending(load());
  }, []);

  const persist = useCallback((next: PendingMap) => {
    setPending(next);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const markPending = useCallback(
    (subjectId: string, address: string, txHash: string) => {
      persist({ ...load(), [subjectId]: { address, txHash, since: Math.floor(Date.now() / 1000) } });
    },
    [persist],
  );

  const clearPending = useCallback(
    (subjectId: string) => {
      const next = load();
      delete next[subjectId];
      persist(next);
    },
    [persist],
  );

  // Poll the chain for each pending subject; when a fresh rating lands, clear it
  // and refresh the server-rendered data so the grade appears without a manual reload.
  useEffect(() => {
    if (Object.keys(pending).length === 0) return;
    let stopped = false;
    const tick = async () => {
      const current = load();
      for (const [id, entry] of Object.entries(current)) {
        if (stopped) return;
        try {
          const r = await getLatestRating(entry.address as Address);
          if (r && r.timestamp >= entry.since - 5) {
            clearPending(id);
            router.refresh();
          } else if (Math.floor(Date.now() / 1000) - entry.since > GIVE_UP_S) {
            clearPending(id);
          }
        } catch {}
      }
    };
    const iv = setInterval(tick, POLL_MS);
    tick();
    return () => {
      stopped = true;
      clearInterval(iv);
    };
  }, [pending, clearPending, router]);

  const value: PendingState = {
    pending,
    isPending: (id) => !!pending[id],
    markPending,
    clearPending,
  };

  return <PendingCtx.Provider value={value}>{children}</PendingCtx.Provider>;
}

export function usePending(): PendingState {
  const ctx = useContext(PendingCtx);
  if (!ctx) throw new Error("usePending must be used within PendingProvider");
  return ctx;
}
