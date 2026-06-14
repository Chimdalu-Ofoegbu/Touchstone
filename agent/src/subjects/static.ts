// agent/src/subjects/static.ts
// Versioned off-chain facts per subject. STATIC_VERSION drives Fact.source.version
// per the Static-fact citation source convention (PATTERNS §Shared Patterns).
//
// Addresses below are LOCKED to Mantle Mainnet (chain 5000) per
// DEC-subject-set-locked / D-05.

import type { SubjectId, Fact } from "./types.js";

/**
 * Static facts version. Bumped any time the contents change. Cited as
 * Fact.source.version per the static-fact citation source convention.
 */
export const STATIC_VERSION = "1.0.0";

export type StaticSubject = {
  name: string;
  address: `0x${string}`;
  collateral: string;
  audit: string[];
  reserveAttestation: string;
  custodian: string | null;
  oracleArchitecture: string;
  stalenessTolerance: string;
  pausable: boolean;
  timelock: string | null;
  sourceVerified: boolean;
  implementation: `0x${string}` | null;
  proxyPattern: string;
  /**
   * Upgrade/admin authority, verified on-chain. Set ONLY when the proxy's
   * owner() is not directly readable — e.g. a transparent proxy whose
   * implementation uses AccessControl roles (not Ownable), so owner() reverts
   * and the real admin lives in the EIP-1967 admin slot. The contract-risk
   * scorer treats a null owner as a concentration-risk signal; this lets the
   * adapter surface the genuine (multisig) admin instead of a false unknown.
   * null when owner() is directly readable (cmETH, FBTC).
   */
  adminAuthority: string | null;
  mantleTVL_USD: number;
  parentTVL_USD: number;
  /** Holder addresses to probe for concentration. Empty array if none known. */
  holderProbeList: `0x${string}`[];
  /** Optional on-chain BTC/USD oracle for FBTC; ETH/USD for cmETH. */
  priceFeed: `0x${string}` | null;
};

export const STATIC: Record<SubjectId, StaticSubject> = {
  USDY: {
    name: "Ondo U.S. Dollar Yield",
    address: "0x5bE26527e817998A7206475496fDE1E68957c5A6",
    collateral: "short-term US Treasuries + bank deposits",
    audit: ["Code4rena 2023", "Halborn 2024"],
    reserveAttestation: "monthly attestation by Ankura Trust",
    custodian: "Ankura Trust",
    oracleArchitecture:
      "internal-accrual, daily settler, no external feed on Mantle",
    stalenessTolerance: "24h",
    pausable: true,
    timelock: null,
    sourceVerified: true,
    implementation: "0x3b355A7A25E75A320f631F9736afB3Dcc9F3Ef66",
    proxyPattern: "EIP-1967 transparent proxy",
    // owner() reverts on the proxy (impl uses AccessControl roles). EIP-1967
    // admin slot resolves to ProxyAdmin 0x201CDD34…1448, owned by this Gnosis
    // Safe multisig (verified on-chain via getStorageAt + getOwners()).
    adminAuthority: "0xC8A7870fFe41054612F7f3433E173D8b5bFcA8E3",
    mantleTVL_USD: 8_000_000,
    parentTVL_USD: 680_000_000,
    holderProbeList: [],
    priceFeed: null,
  },
  cmETH: {
    name: "Mantle Restaked ETH",
    address: "0xE6829d9a7eE3040e1276Fa75293Bde931859e8fA",
    collateral:
      "mETH receipt restaked across EigenLayer, Symbiotic, Karak",
    audit: ["Sigma Prime", "Hexens"],
    reserveAttestation: "off-chain prover with on-chain settlement",
    custodian: null,
    oracleArchitecture:
      "restaked-balance proof system, off-chain prover with on-chain settlement",
    stalenessTolerance: "24h",
    pausable: true,
    timelock: null,
    sourceVerified: true,
    implementation: "0x5A7b3CDe8ac8d780af4797bf1517464ac54ca033",
    proxyPattern: "EIP-1967 transparent proxy",
    adminAuthority: null, // owner() readable on-chain (Gnosis Safe 0x71a1f918…)
    mantleTVL_USD: 750_000_000,
    parentTVL_USD: 750_000_000,
    holderProbeList: [],
    priceFeed: null,
  },
  FBTC: {
    name: "FunctionBTC",
    address: "0xC96dE26018A54D51c097160568752c4E3BD6C364",
    collateral:
      "BTC held by institutional custodian network (Galaxy Digital, Antalpha, Coresky)",
    audit: ["SlowMist 2024", "BlockSec 2024"],
    reserveAttestation:
      "monthly proof-of-reserves; on-chain PoR where available",
    custodian: "FBTC custodian network",
    oracleArchitecture:
      "off-chain reserve attestation + Chainlink Proof-of-Reserves where available",
    stalenessTolerance: "monthly",
    pausable: true,
    timelock: null,
    sourceVerified: true,
    implementation: null,
    proxyPattern: "UUPS",
    adminAuthority: null, // owner() readable on-chain (Gnosis Safe 0xD90e60EF…)
    mantleTVL_USD: 100_000_000,
    parentTVL_USD: 1_500_000_000,
    holderProbeList: [],
    priceFeed: null,
  },
};

/** Build a static-kind Fact from a STATIC entry field. */
export function staticFact(opts: {
  label: string;
  value: string | null;
  evidence: string;
}): Fact {
  return {
    label: opts.label,
    value: opts.value,
    evidence: opts.evidence,
    source: {
      kind: "static",
      file: "agent/src/subjects/static.ts",
      version: STATIC_VERSION,
    },
  };
}
