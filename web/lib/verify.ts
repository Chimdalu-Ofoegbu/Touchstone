// web/lib/verify.ts
// Client-side reasoning-hash verification: fetch the pinned reasoning JSON by its
// bare CID, keccak256 the EXACT bytes, and compare to the on-chain reasoningHash.
// This is the "verified on Mantle" control — it reproduces the agent's binding
// (reasoningHash == keccak256(canonical reasoning JSON)) in the browser.

import { keccak256, toBytes, type Hex } from "viem";

const GATEWAYS = [
  process.env.NEXT_PUBLIC_IPFS_GATEWAY,
  "https://ipfs.io",
  "https://gateway.pinata.cloud",
  "https://dweb.link",
].filter(Boolean) as string[];

export type VerifyResult =
  | {
      status: "match";
      computedHash: Hex;
      onChainHash: Hex;
      gateway: string;
      doc: unknown;
      bytes: number;
    }
  | {
      status: "mismatch";
      computedHash: Hex;
      onChainHash: Hex;
      gateway: string;
      bytes: number;
    }
  | { status: "error"; message: string };

/** Fetch `cid` from the first responsive gateway and re-hash its exact bytes. */
export async function verifyReasoning(
  cid: string,
  onChainHash: Hex,
): Promise<VerifyResult> {
  const host = (g: string) => g.replace(/\/$/, "");
  let lastErr = "";
  for (const g of GATEWAYS) {
    const url = `${host(g)}/ipfs/${cid}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        lastErr = `${g} → HTTP ${res.status}`;
        continue;
      }
      const text = await res.text();
      const computedHash = keccak256(toBytes(text));
      const match = computedHash.toLowerCase() === onChainHash.toLowerCase();
      if (match) {
        let doc: unknown = null;
        try {
          doc = JSON.parse(text);
        } catch {}
        return {
          status: "match",
          computedHash,
          onChainHash,
          gateway: g,
          doc,
          bytes: text.length,
        };
      }
      return {
        status: "mismatch",
        computedHash,
        onChainHash,
        gateway: g,
        bytes: text.length,
      };
    } catch (e) {
      lastErr = `${g} → ${(e as Error).message}`;
    }
  }
  return { status: "error", message: lastErr || "all gateways failed" };
}

/** Fetch and parse the reasoning JSON (for the detail drill-down). */
export async function fetchReasoning(cid: string): Promise<unknown | null> {
  for (const g of GATEWAYS) {
    try {
      const res = await fetch(`${g.replace(/\/$/, "")}/ipfs/${cid}`, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {}
  }
  return null;
}
