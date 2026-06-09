// agent/tests/subjects/registry.test.ts
// Task 2-02-03 — dispatch registry contract per the PLAN behaviors
// (tests 8-9). T-2-07 mitigation: getAdapter() throws on unknown id.

import { describe, it, expect } from "vitest";
import { ADAPTERS, getAdapter } from "../../src/subjects/registry.js";
import { fetchUsdy } from "../../src/subjects/usdy.js";
import { fetchCmeth } from "../../src/subjects/cmeth.js";
import { fetchFbtc } from "../../src/subjects/fbtc.js";

describe("[2-02-03 registry] SubjectId -> adapter dispatch", () => {
  it("ADAPTERS.USDY === fetchUsdy", () => {
    expect(ADAPTERS.USDY).toBe(fetchUsdy);
  });

  it("ADAPTERS.cmETH === fetchCmeth", () => {
    expect(ADAPTERS.cmETH).toBe(fetchCmeth);
  });

  it("ADAPTERS.FBTC === fetchFbtc", () => {
    expect(ADAPTERS.FBTC).toBe(fetchFbtc);
  });

  it("getAdapter('USDY') returns fetchUsdy", () => {
    expect(getAdapter("USDY")).toBe(fetchUsdy);
  });

  it("getAdapter throws on unknown SubjectId (T-2-07 mitigation)", () => {
    // Cast to bypass the literal-union compile-time check so we can
    // exercise the runtime guard.
    expect(() =>
      getAdapter("BOGUS" as unknown as "USDY"),
    ).toThrow(/Unknown subject id/);
  });
});
