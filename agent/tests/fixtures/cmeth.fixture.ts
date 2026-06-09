// agent/tests/fixtures/cmeth.fixture.ts
// Recorded-style multicall fixtures for cmETH. Shapes mirror multiread()
// ReadResult[] for vi.mock injection.
//
// Order matches the read order in agent/src/subjects/cmeth.ts:
//   0 totalSupply, 1 decimals, 2 symbol, 3 paused, 4 owner.

import type { ReadResult } from "../../src/multicall.js";

export const cmethMulticallSuccess: ReadResult[] = [
  // 200_000 ETH at 18 decimals -> ~$760M @ $3,800/ETH
  {
    ok: true,
    value: 200_000_000000000000000000n,
    label: "cmETH totalSupply",
  },
  { ok: true, value: 18, label: "cmETH decimals" },
  { ok: true, value: "cmETH", label: "cmETH symbol" },
  { ok: true, value: false, label: "cmETH paused()" },
  {
    ok: true,
    value: "0x5A7b3CDe8ac8d780af4797bf1517464ac54ca033",
    label: "cmETH owner()",
  },
];

export const cmethMulticallAllFail: ReadResult[] = [
  { ok: false, error: "exec reverted", label: "cmETH totalSupply" },
  { ok: false, error: "exec reverted", label: "cmETH decimals" },
  { ok: false, error: "exec reverted", label: "cmETH symbol" },
  { ok: false, error: "exec reverted", label: "cmETH paused()" },
  { ok: false, error: "exec reverted", label: "cmETH owner()" },
];
