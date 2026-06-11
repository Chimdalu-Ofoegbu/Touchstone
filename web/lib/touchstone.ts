// web/lib/touchstone.ts
// On-chain data layer for the Touchstone terminal. Reads run server-side (viem
// over the Mantle public RPC — no browser CORS), so the board/detail render with
// real on-chain data on first paint. The IPFS re-hash verify (lib/verify.ts) runs
// client-side.

import { createPublicClient, http, getAddress, type Address, type Hex } from "viem";
import { mantle } from "viem/chains";
import { ratingRegistryAbi } from "./registry-abi";

export const MANTLE_RPC =
  process.env.NEXT_PUBLIC_MANTLE_RPC_URL ?? "https://rpc.mantle.xyz";

// Deployed Mantle Mainnet artifacts (Phase 3). Public addresses.
export const RATING_REGISTRY = getAddress(
  process.env.NEXT_PUBLIC_RATING_REGISTRY ?? "0xF16d03965E1870Fc3235198468C56dEC65E5606D",
);
export const IDENTITY_REGISTRY = getAddress("0x8004A169FB4a3325136EB29fA0ceB6D2e539a432");
export const AGENT_ADDRESS = getAddress("0xb27c7fa15D25E880Ba4a9a508e166538e106F51e");
export const AGENT_TOKEN_ID = 114n;
export const EXPLORER = "https://mantlescan.xyz";

export type SubjectId = "USDY" | "cmETH" | "FBTC";

export type Subject = {
  id: SubjectId;
  name: string;
  blurb: string;
  address: Address;
};

// Canonical EIP-55 subject addresses (DEC-subject-set-locked).
export const SUBJECTS: Subject[] = [
  {
    id: "USDY",
    name: "Ondo U.S. Dollar Yield",
    blurb: "Tokenized short-term US Treasuries + bank deposits",
    address: getAddress("0x5bE26527e817998A7206475496fDE1E68957c5A6"),
  },
  {
    id: "cmETH",
    name: "Mantle Restaked ETH",
    blurb: "mETH receipt restaked across EigenLayer, Symbiotic, Karak",
    address: getAddress("0xE6829d9a7eE3040e1276Fa75293Bde931859e8fA"),
  },
  {
    id: "FBTC",
    name: "FunctionBTC",
    blurb: "BTC under an institutional custodian network",
    address: getAddress("0xC96dE26018A54D51c097160568752c4E3BD6C364"),
  },
];

export function subjectByAddress(addr: string): Subject | undefined {
  const a = addr.toLowerCase();
  return SUBJECTS.find((s) => s.address.toLowerCase() === a);
}
export function subjectById(id: string): Subject | undefined {
  return SUBJECTS.find((s) => s.id === id);
}

export const publicClient = createPublicClient({
  chain: mantle,
  transport: http(MANTLE_RPC, { timeout: 12_000 }),
  batch: { multicall: true }, // batch the board's per-subject reads
});

export type Rating = {
  subject: Address;
  grade: number;
  reasoningHash: Hex;
  confidence: number;
  timestamp: number; // unix seconds
  agentIdentity: Address;
  cid: string;
};

const ZERO = "0x0000000000000000000000000000000000000000";

function normalize(r: {
  subject: Address;
  grade: number;
  reasoningHash: Hex;
  confidence: number;
  timestamp: bigint;
  agentIdentity: Address;
  cid: string;
}): Rating {
  return { ...r, timestamp: Number(r.timestamp) };
}

/** Latest rating for a subject, or null if none published (timestamp == 0). */
export async function getLatestRating(subject: Address): Promise<Rating | null> {
  const r = await publicClient.readContract({
    address: RATING_REGISTRY,
    abi: ratingRegistryAbi,
    functionName: "latestRating",
    args: [subject],
  });
  if (r.timestamp === 0n || r.agentIdentity === ZERO) return null;
  return normalize(r);
}

/** Full append-only rating history for a subject (oldest → newest). */
export async function getRatingHistory(subject: Address): Promise<Rating[]> {
  const rows = await publicClient.readContract({
    address: RATING_REGISTRY,
    abi: ratingRegistryAbi,
    functionName: "ratingHistory",
    args: [subject],
  });
  return rows.map(normalize);
}

/** Latest rating for every subject (null where unrated), in board order. */
export async function getBoard(): Promise<{ subject: Subject; rating: Rating | null }[]> {
  return Promise.all(
    SUBJECTS.map(async (subject) => ({
      subject,
      rating: await getLatestRating(subject.address).catch(() => null),
    })),
  );
}

// ---- formatting helpers ----
export function shortHash(h: string, lead = 6, tail = 4): string {
  if (!h || h.length < lead + tail + 2) return h;
  return `${h.slice(0, lead)}…${h.slice(-tail)}`;
}

export function relativeTime(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
