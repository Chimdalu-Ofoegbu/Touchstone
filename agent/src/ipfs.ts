// agent/src/ipfs.ts
// Headless IPFS pin via Pinata — THE single locked provider (DEC-ipfs-provider
// amended to Pinata 2026-06-10; raw-file CID, no directory wrap). One public
// function: pin(canonical) -> bare CID. Mirrors rpc.ts's "module-level singleton
// built from an env secret + a single exported async fn" shape.
//
// CRITICAL CONSTRAINTS (D-02 silent-failure guard):
//   - (Pitfall 1 / T-03-05) The input MUST be the EXACT canonicalizeDoc(doc)
//     string that hash.ts hashed — NEVER JSON.stringify(doc) or a re-parsed
//     object. We upload `new Blob([canonical])` so the pinned bytes are byte-
//     identical to the hashed bytes; otherwise the Phase 4 re-hash fails and
//     "verified on Mantle" never lights up.
//   - (Pitfall 2 / T-03-25 / directory-wrap gotcha) We use upload.public.file,
//     which returns a RAW-file CID that resolves DIRECTLY to the JSON. The bare
//     CID must `{gateway}/ipfs/{cid}` back to the exact bytes (NOT a directory
//     listing). Do NOT use any directory-wrapping upload path.
//
// T-03-06 mitigation: PINATA_JWT is read from the root .env only (never logged).
// Any thrown upload error is funneled through redactPinError so the JWT can never
// leak into a log/stderr/JSON output.
//
// Single provider: NO Storacha branch, NO PIN_PROVIDER switch — Pinata only.

import { PinataSDK } from "pinata";

// Lazily construct the SDK so a missing PINATA_JWT does not crash at import
// time (the hermetic test injects a fake uploader and never touches Pinata;
// only the real pin path requires the JWT). Mirrors rpc.ts's env-secret-at-use
// discipline without forcing the secret to exist for unit tests.
let _pinata: PinataSDK | undefined;
function getPinata(): PinataSDK {
  if (!_pinata) {
    _pinata = new PinataSDK({
      pinataJwt: process.env.PINATA_JWT,
      pinataGateway: process.env.PINATA_GATEWAY,
    });
  }
  return _pinata;
}

/**
 * The uploader seam: takes the RAW Blob and returns the Pinata raw-file CID.
 * Production default calls `pinata.upload.public.file(blob)` (no directory
 * wrap). Tests inject a fake via __setUploaderForTest to capture the exact
 * bytes without a network call.
 */
type Uploader = (blob: Blob) => Promise<{ cid: string }>;

const defaultUploader: Uploader = async (blob) => {
  // Pinata's upload.public.file is typed to accept a File. A File is a Blob
  // subclass carrying the IDENTICAL bytes plus a name — wrapping the canonical
  // Blob here keeps the pinned bytes byte-exact (the raw-file CID is content-
  // addressed over the bytes, NOT the filename). The byte payload is the
  // `new Blob([canonical])` built in pin(); this only adds the typed wrapper.
  const file = new File([blob], "reasoning.json", { type: "application/json" });
  const { cid } = await getPinata().upload.public.file(file); // raw-file CID
  return { cid };
};

let uploader: Uploader = defaultUploader;

/**
 * Redact the Pinata JWT from any error message before it surfaces (T-03-06).
 * The JWT should never appear in viem/Pinata errors, but we scrub defensively
 * exactly as rpc.ts scrubs the keyed RPC URL.
 */
function redactPinError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  const jwt = process.env.PINATA_JWT;
  const scrubbed = jwt ? msg.split(jwt).join("[redacted]") : msg;
  return new Error(scrubbed);
}

/**
 * Pin the EXACT canonical reasoning bytes to IPFS via Pinata and return the
 * bare raw-file CID (D-02). `canonical` MUST be the canonicalizeDoc(doc) string
 * (Pitfall 1) — this function does NOT serialize; the input is already canonical.
 * The returned CID resolves DIRECTLY to the JSON at `{gateway}/ipfs/{cid}`
 * (no directory wrap — Pitfall 2 / T-03-25).
 */
export async function pin(canonical: string): Promise<string> {
  const blob = new Blob([canonical], { type: "application/json" }); // EXACT hashed bytes — no JSON.stringify
  try {
    const { cid } = await uploader(blob); // raw-file CID (Pinata upload.public.file)
    return cid; // bare CID (D-02)
  } catch (e) {
    throw redactPinError(e);
  }
}

/** Test-only: inject a fake uploader (captures the Blob, no network). */
export function __setUploaderForTest(fn: Uploader): void {
  uploader = fn;
}

/** Test-only: restore the real Pinata uploader. */
export function __resetUploaderForTest(): void {
  uploader = defaultUploader;
}
