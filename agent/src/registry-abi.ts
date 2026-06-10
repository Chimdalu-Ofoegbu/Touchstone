// agent/src/registry-abi.ts
// RatingRegistry ABI const for viem write + parseEventLogs + watchContractEvent.
// Typed `as const` so viem infers exact arg/return types for publishRating,
// the RatingPublished/RatingRequested events, and the read functions.
//
// SOURCE OF TRUTH (D-02 ABI freeze):
//   Generated from the POST-REDEPLOY artifact out/RatingRegistry.sol/RatingRegistry.json.
//   Plan 03 (Task 3) REGENERATES this byte-for-byte from that artifact after the
//   once-only Mantle Mainnet redeploy; Phase 4 frontend types derive from this SAME
//   frozen ABI. Do NOT edit it ad hoc post-redeploy — re-export from the artifact.
//
// WAVE-1 PARALLEL NOTE (Plan 01 un-merged): this fragment is hand-authored from the
// Plan 01 contract shape — `string cid` added to the Rating struct + the
// RatingPublished event, and `string calldata cid` appended to publishRating — while
// Plan 01's contract change is being made in PARALLEL in the same wave. Until Plan 01
// lands, a transient typecheck mismatch against an un-merged contract is EXPECTED;
// it is reconciled byte-for-byte in Plan 03 against the deployed artifact. This file
// type-checks standalone (it is plain data), so Plans 04/06 can consume it now.
//
// Gate (D-01): the deployed contract enforces ownerOf(agentTokenId) == msg.sender via
// the canonical ERC-8004 Identity Registry; the NotAgent error below is what a
// non-agent publishRating reverts with.

export const ratingRegistryAbi = [
  // --- constructor (registry address + minted agent tokenId, D-01) ---
  {
    type: "constructor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "registry_", type: "address", internalType: "address" },
      { name: "agentTokenId_", type: "uint256", internalType: "uint256" },
    ],
  },

  // --- writes ---
  {
    type: "function",
    name: "publishRating",
    stateMutability: "nonpayable",
    inputs: [
      { name: "subject", type: "address", internalType: "address" },
      { name: "grade", type: "uint8", internalType: "uint8" },
      { name: "reasoningHash", type: "bytes32", internalType: "bytes32" },
      { name: "confidence", type: "uint8", internalType: "uint8" },
      // D-02: cid written ATOMICALLY with the hash in the SAME tx (never a
      // separate write). Bare CID string (no gateway URL) — Pinata raw-file CID.
      { name: "cid", type: "string", internalType: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "requestRating",
    stateMutability: "nonpayable",
    inputs: [{ name: "subject", type: "address", internalType: "address" }],
    outputs: [],
  },

  // --- reads (return the full Rating struct incl. cid, D-02) ---
  {
    type: "function",
    name: "latestRating",
    stateMutability: "view",
    inputs: [{ name: "subject", type: "address", internalType: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct RatingRegistry.Rating",
        components: [
          { name: "subject", type: "address", internalType: "address" },
          { name: "grade", type: "uint8", internalType: "uint8" },
          { name: "reasoningHash", type: "bytes32", internalType: "bytes32" },
          { name: "confidence", type: "uint8", internalType: "uint8" },
          { name: "timestamp", type: "uint256", internalType: "uint256" },
          { name: "agentIdentity", type: "address", internalType: "address" },
          { name: "cid", type: "string", internalType: "string" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "ratingHistory",
    stateMutability: "view",
    inputs: [{ name: "subject", type: "address", internalType: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        internalType: "struct RatingRegistry.Rating[]",
        components: [
          { name: "subject", type: "address", internalType: "address" },
          { name: "grade", type: "uint8", internalType: "uint8" },
          { name: "reasoningHash", type: "bytes32", internalType: "bytes32" },
          { name: "confidence", type: "uint8", internalType: "uint8" },
          { name: "timestamp", type: "uint256", internalType: "uint256" },
          { name: "agentIdentity", type: "address", internalType: "address" },
          { name: "cid", type: "string", internalType: "string" },
        ],
      },
    ],
  },

  // --- immutables exposed as public getters (D-01 single source of reference) ---
  {
    type: "function",
    name: "registry",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract IIdentityRegistry" }],
  },
  {
    type: "function",
    name: "agentTokenId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
  },

  // --- events ---
  {
    type: "event",
    name: "RatingPublished",
    anonymous: false,
    inputs: [
      { name: "subject", type: "address", indexed: true, internalType: "address" },
      { name: "grade", type: "uint8", indexed: false, internalType: "uint8" },
      { name: "reasoningHash", type: "bytes32", indexed: false, internalType: "bytes32" },
      { name: "confidence", type: "uint8", indexed: false, internalType: "uint8" },
      { name: "timestamp", type: "uint256", indexed: false, internalType: "uint256" },
      // D-02: cid emitted in the event too (cheap frontend/indexer fast-path).
      { name: "cid", type: "string", indexed: false, internalType: "string" },
    ],
  },
  {
    type: "event",
    name: "RatingRequested",
    anonymous: false,
    inputs: [
      { name: "subject", type: "address", indexed: true, internalType: "address" },
      { name: "requester", type: "address", indexed: true, internalType: "address" },
      { name: "timestamp", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },

  // --- errors ---
  { type: "error", name: "NotAgent", inputs: [] },
  { type: "error", name: "InvalidGrade", inputs: [] },
  { type: "error", name: "InvalidConfidence", inputs: [] },
] as const;
