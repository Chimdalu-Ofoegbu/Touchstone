// agent/src/subjects/usdy.ts
// USDY adapter per D-01 (per-subject layout), D-04 (block-pinning thread-through),
// D-07 (missing reads => Fact.value === null at the adapter boundary; the
// dimension scorer applies the default-to-50 + confidence-drop policy in Wave 2).
//
// Round-trip budget per D-03: this adapter uses exactly ONE multiread call
// (ERC-20 surface + paused + owner), well under the ≤3 cap.
//
// Adapter goes through the multiread helper ONLY. It MUST NOT call the
// raw viem publicClient batched-read or single-read methods directly
// (see the no-latest-leak tripwire test which greps this file).

import { erc20Abi, parseAbi, type Address } from "viem";
import type { SubjectFacts, Fact } from "./types.js";
import { multiread, type Read } from "../multicall.js";
import { STATIC, staticFact } from "./static.js";

const ADDR: Address = STATIC.USDY.address;

// Extra surface for USDY. If a function does not exist on the proxy, the
// allow-failure path drops the read into ReadResult{ ok: false } so the
// adapter surfaces value === null on that Fact.
const USDY_EXTRA_ABI = parseAbi([
  "function paused() view returns (bool)",
  "function owner() view returns (address)",
]);

export async function fetchUsdy(blockNumber?: bigint): Promise<SubjectFacts> {
  // Round 1: ERC-20 base surface + pause flag + owner.
  const round1: Read[] = [
    {
      address: ADDR,
      abi: erc20Abi,
      functionName: "totalSupply",
      label: "USDY totalSupply",
    },
    {
      address: ADDR,
      abi: erc20Abi,
      functionName: "decimals",
      label: "USDY decimals",
    },
    {
      address: ADDR,
      abi: erc20Abi,
      functionName: "symbol",
      label: "USDY symbol",
    },
    {
      address: ADDR,
      abi: USDY_EXTRA_ABI,
      functionName: "paused",
      label: "USDY paused()",
    },
    {
      address: ADDR,
      abi: USDY_EXTRA_ABI,
      functionName: "owner",
      label: "USDY owner()",
    },
  ];
  const r1 = await multiread(round1, blockNumber);

  const ingestBlock = blockNumber !== undefined ? Number(blockNumber) : 0;

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
      label: "issuer + collateral",
      value: STATIC.USDY.collateral,
      evidence:
        "USDY is issued by Ondo Finance against short-term US Treasuries and bank deposits.",
    }),
    staticFact({
      label: "reserve attestation",
      value: STATIC.USDY.reserveAttestation,
      evidence: "Reserves are attested monthly by the custodian.",
    }),
    staticFact({
      label: "custodian",
      value: STATIC.USDY.custodian,
      evidence: "Custody is held by Ankura Trust.",
    }),
    staticFact({
      label: "audits",
      value: STATIC.USDY.audit.join(", "),
      evidence: "Recent audits include " + STATIC.USDY.audit.join(", ") + ".",
    }),
  ];

  const contract: Fact[] = [
    onchainFact(
      "totalSupply (raw)",
      r1[0].ok ? String(r1[0].value) : null,
      "totalSupply()",
      "ERC-20 totalSupply observed on Mantle.",
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
      value: STATIC.USDY.sourceVerified ? "yes" : "no",
      evidence:
        "Verified on Mantlescan; implementation " +
        String(STATIC.USDY.implementation) +
        ".",
    }),
    staticFact({
      label: "proxy pattern",
      value: STATIC.USDY.proxyPattern,
      evidence: "Upgrade pattern declared in static config.",
    }),
  ];

  const oracle: Fact[] = [
    staticFact({
      label: "oracle architecture",
      value: STATIC.USDY.oracleArchitecture,
      evidence:
        "USDY uses internal accrual; no external price feed on Mantle.",
    }),
    staticFact({
      label: "staleness tolerance",
      value: STATIC.USDY.stalenessTolerance,
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
      value: String(STATIC.USDY.mantleTVL_USD),
      evidence: "Approximate Mantle-side TVL recorded in static config.",
    }),
    staticFact({
      label: "parent TVL (USD)",
      value: String(STATIC.USDY.parentTVL_USD),
      evidence: "Parent supply across all chains per static config.",
    }),
    onchainFact(
      "USDY totalSupply * accrued",
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
      name: STATIC.USDY.name,
      ticker: "USDY",
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
