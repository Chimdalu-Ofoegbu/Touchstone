// agent/src/subjects/cmeth.ts
// cmETH adapter per D-01 / D-04 / D-07. Mirrors USDY shape.
//
// cmETH semantics:
//   - 18 decimals (ETH-native)
//   - Liquidity fact uses priceAtBlock(ingestBlock).ETH_USD for parent-USD
//     framing (deterministic; no live price API).
//
// Adapter goes through multiread() ONLY — no direct viem batched/single read.

import { erc20Abi, parseAbi, type Address } from "viem";
import type { SubjectFacts, Fact } from "./types.js";
import { multiread, type Read } from "../multicall.js";
import { STATIC, staticFact } from "./static.js";
import { priceAtBlock } from "../constants/prices.js";

const ADDR: Address = STATIC.cmETH.address;

const CMETH_EXTRA_ABI = parseAbi([
  "function paused() view returns (bool)",
  "function owner() view returns (address)",
]);

export async function fetchCmeth(blockNumber?: bigint): Promise<SubjectFacts> {
  const round1: Read[] = [
    {
      address: ADDR,
      abi: erc20Abi,
      functionName: "totalSupply",
      label: "cmETH totalSupply",
    },
    {
      address: ADDR,
      abi: erc20Abi,
      functionName: "decimals",
      label: "cmETH decimals",
    },
    {
      address: ADDR,
      abi: erc20Abi,
      functionName: "symbol",
      label: "cmETH symbol",
    },
    {
      address: ADDR,
      abi: CMETH_EXTRA_ABI,
      functionName: "paused",
      label: "cmETH paused()",
    },
    {
      address: ADDR,
      abi: CMETH_EXTRA_ABI,
      functionName: "owner",
      label: "cmETH owner()",
    },
  ];
  const r1 = await multiread(round1, blockNumber);

  const ingestBlock = blockNumber !== undefined ? Number(blockNumber) : 0;
  const ethPrice = priceAtBlock(ingestBlock).ETH_USD;

  const onchainFact = (
    label: string,
    value: string | null,
    fn: string,
    evidence: string,
  ): Fact => ({
    label,
    value,
    evidence,
    source: {
      kind: "onchain",
      address: ADDR,
      function: fn,
      blockNumber: ingestBlock,
    },
  });

  const collateral: Fact[] = [
    staticFact({
      label: "collateral composition",
      value: STATIC.cmETH.collateral,
      evidence:
        "cmETH is a Mantle-native restaked receipt; backing mETH is restaked across EigenLayer, Symbiotic, and Karak.",
    }),
    staticFact({
      label: "reserve attestation",
      value: STATIC.cmETH.reserveAttestation,
      evidence:
        "Restaked balance is proven off-chain with on-chain settlement.",
    }),
    staticFact({
      label: "audits",
      value: STATIC.cmETH.audit.join(", "),
      evidence: "Recent audits include " + STATIC.cmETH.audit.join(", ") + ".",
    }),
  ];

  const contract: Fact[] = [
    onchainFact(
      "totalSupply (raw)",
      r1[0].ok ? String(r1[0].value) : null,
      "totalSupply()",
      "ERC-20 totalSupply observed on Mantle (18 decimals).",
    ),
    onchainFact(
      "decimals",
      r1[1].ok ? String(r1[1].value) : null,
      "decimals()",
      "ERC-20 decimals reported by the contract.",
    ),
    onchainFact(
      "paused",
      r1[3].ok ? String(r1[3].value) : null,
      "paused()",
      "Contract pause flag (true if paused).",
    ),
    onchainFact(
      "owner",
      r1[4].ok ? String(r1[4].value) : null,
      "owner()",
      "Contract owner / admin address.",
    ),
    staticFact({
      label: "source verified",
      value: STATIC.cmETH.sourceVerified ? "yes" : "no",
      evidence:
        "Verified on Mantlescan; implementation " +
        String(STATIC.cmETH.implementation) +
        ".",
    }),
    staticFact({
      label: "proxy pattern",
      value: STATIC.cmETH.proxyPattern,
      evidence: "Upgrade pattern declared in static config.",
    }),
  ];

  const oracle: Fact[] = [
    staticFact({
      label: "oracle architecture",
      value: STATIC.cmETH.oracleArchitecture,
      evidence:
        "cmETH uses a restaked-balance proof system with on-chain settlement; redemption pricing rides the off-chain prover.",
    }),
    staticFact({
      label: "staleness tolerance",
      value: STATIC.cmETH.stalenessTolerance,
      evidence: "Staleness tolerance per static config.",
    }),
    onchainFact(
      "symbol",
      r1[2].ok ? String(r1[2].value) : null,
      "symbol()",
      "ERC-20 symbol observed at the pinned block.",
    ),
  ];

  const liquidity: Fact[] = [
    staticFact({
      label: "mantle TVL (USD)",
      value: String(STATIC.cmETH.mantleTVL_USD),
      evidence: "Approximate Mantle-side TVL recorded in static config.",
    }),
    staticFact({
      label: "parent TVL (USD)",
      value: String(STATIC.cmETH.parentTVL_USD),
      evidence:
        "Parent supply per static config; cmETH is Mantle-native so parent equals Mantle TVL.",
    }),
    staticFact({
      label: "ETH/USD reference price",
      value: String(ethPrice),
      evidence:
        "Reference ETH/USD price from agent/src/constants/prices.ts for the ingest block; deterministic by design (no live feed).",
    }),
    onchainFact(
      "cmETH totalSupply (raw)",
      r1[0].ok && r1[1].ok
        ? String(r1[0].value) +
            " (raw, decimals=" +
            String(r1[1].value) +
            ")"
        : null,
      "totalSupply()",
      "On-chain raw totalSupply observed at the pinned block.",
    ),
  ];

  return {
    subject: {
      name: STATIC.cmETH.name,
      ticker: "cmETH",
      address: ADDR,
      chainId: 5000,
    },
    ingestBlock,
    collateral,
    contract,
    oracle,
    liquidity,
  };
}
