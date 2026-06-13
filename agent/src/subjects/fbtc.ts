// agent/src/subjects/fbtc.ts
// FBTC adapter per D-01 / D-04 / D-07. Mirrors USDY shape.
//
// FBTC semantics:
//   - 8 decimals (BTC-native; satoshis-ish unit)
//   - Liquidity fact uses priceAtBlock(ingestBlock).BTC_USD for parent-USD
//     framing (deterministic; no live price API).
//   - UUPS proxy, off-chain reserve attestation + Chainlink PoR where
//     available. No on-chain implementation getter is universally exposed,
//     so the implementation field falls back to static (RESEARCH §3.3).
//
// Adapter goes through multiread() ONLY — no direct viem batched/single read.

import { erc20Abi, parseAbi, type Address } from "viem";
import type { SubjectFacts, Fact } from "./types.js";
import { multiread, type Read } from "../multicall.js";
import { resolveBlockNumber } from "../rpc.js";
import { STATIC, staticFact } from "./static.js";
import { priceAtBlock } from "../constants/prices.js";

const ADDR: Address = STATIC.FBTC.address;

const FBTC_EXTRA_ABI = parseAbi([
  "function paused() view returns (bool)",
  "function owner() view returns (address)",
]);

export async function fetchFbtc(blockNumber?: bigint): Promise<SubjectFacts> {
  const round1: Read[] = [
    {
      address: ADDR,
      abi: erc20Abi,
      functionName: "totalSupply",
      label: "FBTC totalSupply",
    },
    {
      address: ADDR,
      abi: erc20Abi,
      functionName: "decimals",
      label: "FBTC decimals",
    },
    {
      address: ADDR,
      abi: erc20Abi,
      functionName: "symbol",
      label: "FBTC symbol",
    },
    {
      address: ADDR,
      abi: FBTC_EXTRA_ABI,
      functionName: "paused",
      label: "FBTC paused()",
    },
    {
      address: ADDR,
      abi: FBTC_EXTRA_ABI,
      functionName: "owner",
      label: "FBTC owner()",
    },
  ];
  // CR-02 / D-04: resolve a concrete block ONCE so the reads below, the
  // ingestBlock provenance stamp, and priceAtBlock() all pin to the same
  // snapshot. (priceAtBlock(0) would otherwise read a genesis-era price.)
  const resolvedBlockNumber = await resolveBlockNumber(blockNumber);
  const r1 = await multiread(round1, resolvedBlockNumber);

  const ingestBlock = Number(resolvedBlockNumber);
  const btcPrice = priceAtBlock(ingestBlock).BTC_USD;

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
      value: STATIC.FBTC.collateral,
      evidence:
        "FBTC is backed by BTC held in an institutional custodian network (Galaxy Digital, Antalpha, Coresky among the backers).",
    }),
    staticFact({
      label: "reserve attestation",
      value: STATIC.FBTC.reserveAttestation,
      evidence:
        "Monthly proof-of-reserves; on-chain PoR oracle published where available.",
    }),
    staticFact({
      label: "custodian",
      value: STATIC.FBTC.custodian,
      evidence: "Custody is held by the FBTC custodian network.",
    }),
    staticFact({
      label: "audits",
      value: STATIC.FBTC.audit.join(", "),
      evidence: "Recent audits include " + STATIC.FBTC.audit.join(", ") + ".",
    }),
  ];

  const contract: Fact[] = [
    onchainFact(
      "totalSupply (raw)",
      r1[0].ok ? String(r1[0].value) : null,
      "totalSupply()",
      "ERC-20 totalSupply observed on Mantle (8 decimals).",
    ),
    onchainFact(
      "decimals",
      r1[1].ok ? String(r1[1].value) : null,
      "decimals()",
      "ERC-20 decimals reported by the contract (FBTC: 8).",
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
      value: STATIC.FBTC.sourceVerified ? "yes" : "no",
      evidence:
        "Verified on Mantlescan; UUPS proxy with off-chain implementation reference.",
    }),
    staticFact({
      label: "proxy pattern",
      value: STATIC.FBTC.proxyPattern,
      evidence: "Upgrade pattern declared in static config (UUPS).",
    }),
    // contract-risk inputs the scorer grades on (D-06 recipe). Sourced from
    // static governance config — the on-chain `paused()` flag above is the
    // runtime state; these describe the standing capabilities/controls.
    staticFact({
      label: "audits",
      value: STATIC.FBTC.audit.length ? STATIC.FBTC.audit.join(", ") : null,
      evidence: STATIC.FBTC.audit.length
        ? "Security audits on record: " + STATIC.FBTC.audit.join(", ") + " (static config)."
        : "No security audits on record (static config).",
    }),
    staticFact({
      label: "pausable",
      value: String(STATIC.FBTC.pausable),
      evidence:
        "Pause capability per static config (true = a privileged role can halt transfers).",
    }),
    staticFact({
      label: "timelock",
      value: STATIC.FBTC.timelock,
      evidence: STATIC.FBTC.timelock
        ? "Privileged admin actions gated by timelock: " + STATIC.FBTC.timelock + " (static config)."
        : "No admin timelock on record — privileged actions (incl. pause) take effect without delay (static config).",
    }),
  ];

  const oracle: Fact[] = [
    staticFact({
      label: "oracle architecture",
      value: STATIC.FBTC.oracleArchitecture,
      evidence:
        "FBTC is collateral-backed; reserve attestation is off-chain with Chainlink Proof-of-Reserves where available.",
    }),
    staticFact({
      label: "staleness tolerance",
      value: STATIC.FBTC.stalenessTolerance,
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
      value: String(STATIC.FBTC.mantleTVL_USD),
      evidence: "Approximate Mantle-side TVL recorded in static config.",
    }),
    staticFact({
      label: "parent TVL (USD)",
      value: String(STATIC.FBTC.parentTVL_USD),
      evidence: "Parent supply across all chains per static config.",
    }),
    staticFact({
      label: "BTC/USD reference price",
      value: String(btcPrice),
      evidence:
        "Reference BTC/USD price from agent/src/constants/prices.ts for the ingest block; deterministic by design (no live feed).",
    }),
    onchainFact(
      "FBTC totalSupply (raw)",
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
      name: STATIC.FBTC.name,
      ticker: "FBTC",
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
