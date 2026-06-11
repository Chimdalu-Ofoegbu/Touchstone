// web/lib/registry-abi.ts
// RatingRegistry ABI (read + event surface) for the frontend, matching the
// deployed Mantle Mainnet contract 0xF16d03965E1870Fc3235198468C56dEC65E5606D
// (D-02 frozen ABI; mirrors agent/src/registry-abi.ts).

export const ratingRegistryAbi = [
  {
    type: "function",
    name: "latestRating",
    stateMutability: "view",
    inputs: [{ name: "subject", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "subject", type: "address" },
          { name: "grade", type: "uint8" },
          { name: "reasoningHash", type: "bytes32" },
          { name: "confidence", type: "uint8" },
          { name: "timestamp", type: "uint256" },
          { name: "agentIdentity", type: "address" },
          { name: "cid", type: "string" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "ratingHistory",
    stateMutability: "view",
    inputs: [{ name: "subject", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "subject", type: "address" },
          { name: "grade", type: "uint8" },
          { name: "reasoningHash", type: "bytes32" },
          { name: "confidence", type: "uint8" },
          { name: "timestamp", type: "uint256" },
          { name: "agentIdentity", type: "address" },
          { name: "cid", type: "string" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "requestRating",
    stateMutability: "nonpayable",
    inputs: [{ name: "subject", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "agentTokenId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "registry",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "event",
    name: "RatingPublished",
    anonymous: false,
    inputs: [
      { name: "subject", type: "address", indexed: true },
      { name: "grade", type: "uint8", indexed: false },
      { name: "reasoningHash", type: "bytes32", indexed: false },
      { name: "confidence", type: "uint8", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
      { name: "cid", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RatingRequested",
    anonymous: false,
    inputs: [
      { name: "subject", type: "address", indexed: true },
      { name: "requester", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  { type: "error", name: "NotAgent", inputs: [] },
  { type: "error", name: "InvalidGrade", inputs: [] },
  { type: "error", name: "InvalidConfidence", inputs: [] },
] as const;
