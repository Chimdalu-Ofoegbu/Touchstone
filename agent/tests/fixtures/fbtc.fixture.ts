// agent/tests/fixtures/fbtc.fixture.ts
// Recorded-style multicall fixtures for FBTC. Shapes mirror multiread()
// ReadResult[] for vi.mock injection. FBTC uses 8 decimals (BTC-native).
//
// Order matches the read order in agent/src/subjects/fbtc.ts:
//   0 totalSupply, 1 decimals, 2 symbol, 3 paused, 4 owner.

import type { ReadResult } from "../../src/multicall.js";

export const fbtcMulticallSuccess: ReadResult[] = [
  // 1_000 BTC at 8 decimals -> ~$95M @ $95k/BTC
  { ok: true, value: 1_000_00000000n, label: "FBTC totalSupply" },
  { ok: true, value: 8, label: "FBTC decimals" },
  { ok: true, value: "FBTC", label: "FBTC symbol" },
  { ok: true, value: false, label: "FBTC paused()" },
  {
    ok: true,
    value: "0x0000000000000000000000000000000000000000",
    label: "FBTC owner()",
  },
];

export const fbtcMulticallAllFail: ReadResult[] = [
  { ok: false, error: "exec reverted", label: "FBTC totalSupply" },
  { ok: false, error: "exec reverted", label: "FBTC decimals" },
  { ok: false, error: "exec reverted", label: "FBTC symbol" },
  { ok: false, error: "exec reverted", label: "FBTC paused()" },
  { ok: false, error: "exec reverted", label: "FBTC owner()" },
];
