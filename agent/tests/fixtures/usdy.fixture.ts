// agent/tests/fixtures/usdy.fixture.ts
// Recorded-style multicall fixtures for USDY. The shapes mirror the
// ReadResult[] returned by multiread() so unit tests can vi.mock the
// helper without standing up a live RPC.
//
// Order MUST match the read order in agent/src/subjects/usdy.ts:
//   0 totalSupply, 1 decimals, 2 symbol, 3 paused, 4 owner.

import type { ReadResult } from "../../src/multicall.js";

export const usdyMulticallSuccess: ReadResult[] = [
  { ok: true, value: 680_000_000_000000n, label: "USDY totalSupply" }, // 6 decimals -> $680M
  { ok: true, value: 6, label: "USDY decimals" },
  { ok: true, value: "USDY", label: "USDY symbol" },
  { ok: true, value: false, label: "USDY paused()" },
  {
    ok: true,
    value: "0x3b355A7A25E75A320f631F9736afB3Dcc9F3Ef66",
    label: "USDY owner()",
  },
];

export const usdyMulticallAllFail: ReadResult[] = [
  { ok: false, error: "exec reverted", label: "USDY totalSupply" },
  { ok: false, error: "exec reverted", label: "USDY decimals" },
  { ok: false, error: "exec reverted", label: "USDY symbol" },
  { ok: false, error: "exec reverted", label: "USDY paused()" },
  { ok: false, error: "exec reverted", label: "USDY owner()" },
];
