// agent/src/hash.ts
// RFC 8785 JSON Canonicalization Scheme (JCS) + viem.keccak256 chain.
// This file IS the cross-phase verifiability contract
// (DEC-onchain-hash-offchain-reasoning):
//   Phase 3 publisher imports computeReasoningHash unchanged.
//   Phase 4 verifier imports computeReasoningHash unchanged.
//
// Determinism guarantees (T-2-06):
//   - JCS sorts object keys lexicographically at every level.
//   - JCS emits the shortest IEEE 754 form for numbers (no trailing zeros).
//   - JCS uses UTF-8 with no insignificant whitespace.
//   - The hash is computed from the in-memory canonical STRING, never from
//     on-disk bytes (trailing newlines from file writes do NOT affect it).
//   - BigInt is NOT JSON-serializable; the canonicalize lib throws on BigInt
//     so the schema (zod number().int()) is the gatekeeper, not this layer.
//
// RESEARCH §5 (hash chain) + §8 (landmines).

import canonicalize from "canonicalize";
import { keccak256, toBytes, type Hex } from "viem";
import type { ReasoningDocument } from "./schema.js";

/**
 * RFC 8785 JCS canonicalization via the `canonicalize` npm package
 * (cyberphone reference impl). Output: UTF-8 string with lex key sort at
 * every level, no insignificant whitespace, shortest IEEE 754 numbers.
 *
 * Phase 3 publisher and Phase 4 verifier MUST import this function
 * unmodified. The hash is computed from the in-memory canonical STRING.
 */
export function canonicalizeDoc(doc: ReasoningDocument): string {
  const out = canonicalize(doc);
  if (typeof out !== "string") {
    throw new Error(
      "canonicalize returned non-string — input contained an un-canonicalizable value (BigInt? Date object? undefined?)",
    );
  }
  return out;
}

/**
 * reasoningHash = keccak256(utf8Bytes(canonicalize(doc)))
 * Returned as `0x${string}` suitable for direct use as a Solidity bytes32.
 *
 * `toBytes(string)` in viem encodes UTF-8, matching the RFC 8785 output
 * encoding requirement.
 */
export function computeReasoningHash(doc: ReasoningDocument): Hex {
  return keccak256(toBytes(canonicalizeDoc(doc)));
}
