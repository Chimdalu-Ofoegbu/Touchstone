// agent/src/subjects/types.ts
// SubjectFacts contract — locked by D-01 and D-12. Dimensions consume from
// these typed buckets only; they never touch the raw RPC client. This file
// is the deterministic-vs-LLM separation seam (CON-deterministic-vs-llm-separation).

export type SubjectId = "USDY" | "cmETH" | "FBTC";

export type Fact = {
  /** Human-readable label, used in citations[].label and missing_facts[]. */
  label: string;
  /** Observed value, stringified for the prompt. `null` indicates a read failure. */
  value: string | null;
  /** Evidence sentence for citation construction. */
  evidence: string;
  /** Provenance — either an on-chain read or a versioned static-config reference. */
  source:
    | { kind: "onchain"; address: `0x${string}`; function: string; blockNumber: number }
    | { kind: "static"; file: string; version: string };
};

export type SubjectFacts = {
  subject: {
    name: string;
    ticker: SubjectId;
    address: `0x${string}`;
    chainId: 5000;
  };
  ingestBlock: number;
  /**
   * Facts grouped by dimension consumer. Dimensions read from these buckets —
   * NEVER the raw RPC client. Keeps the deterministic-vs-LLM separation
   * seam inspectable.
   */
  collateral: Fact[];
  contract: Fact[];
  oracle: Fact[];
  liquidity: Fact[];
};
