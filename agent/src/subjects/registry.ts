// agent/src/subjects/registry.ts
// SubjectId -> adapter dispatch. Consumed by Wave 4 CLI (`pnpm rate USDY`)
// and by the dimension orchestrator. T-2-07 mitigation: getAdapter()
// throws on unknown SubjectId so an invalid ticker can never silently
// reach Claude.

import type { SubjectId, SubjectFacts } from "./types.js";
import { fetchUsdy } from "./usdy.js";
import { fetchCmeth } from "./cmeth.js";
import { fetchFbtc } from "./fbtc.js";

export const ADAPTERS: Record<
  SubjectId,
  (block?: bigint) => Promise<SubjectFacts>
> = {
  USDY: fetchUsdy,
  cmETH: fetchCmeth,
  FBTC: fetchFbtc,
};

export function getAdapter(
  id: SubjectId,
): (block?: bigint) => Promise<SubjectFacts> {
  const a = ADAPTERS[id];
  if (!a) throw new Error("Unknown subject id: " + String(id));
  return a;
}
