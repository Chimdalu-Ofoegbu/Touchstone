// agent/src/identity-abi.ts
// Minimal ABI for the canonical ERC-8004 Identity Registry on Mantle Mainnet
// (0x8004A169...432). Only the surface mint-identity.ts needs:
//   - register(string agentURI) returns (uint256 agentId)   [the permissionless mint]
//   - Registered(uint256 indexed agentId, string agentURI, address indexed owner)
//   - ERC-721 Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
//   - ownerOf(uint256 tokenId) returns (address)            [gate-precondition check]
//
// Source: CONTEXT pre-flight verification (deployed-bytecode probe — register
// selector 0xf2c298be, ERC-721 supportsInterface(0x80ac58cd)=true) + EIP-8004.
// agentId is captured from `Registered` if present, else the mint `Transfer`
// (from == 0x0) — Assumption A1.

export const identityRegistryAbi = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "owner", type: "address" }],
  },
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
    anonymous: false,
  },
] as const;
