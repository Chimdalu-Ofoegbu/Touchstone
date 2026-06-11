// agent/src/subjects/address-map.ts
// Frozen address -> SubjectId reverse lookup from STATIC (Pitfall 6).
//
// A RatingRequested(subject) event carries the subject ADDRESS, but the engine
// keys on SubjectId — so the watcher must map address -> id before rating.
// Unknown addresses return null (the watcher logs+skips); a stray requestRating
// for a random address must NEVER crash the daemon or reach rate()/Claude
// (allow-list discipline, T-03-21).

import { STATIC } from "./static.js";
import type { SubjectId } from "./types.js";

/** address (lowercased) -> SubjectId. Frozen — not mutable at runtime. */
export const ADDRESS_TO_SUBJECT: Readonly<Record<string, SubjectId>> =
  Object.freeze(
    Object.fromEntries(
      (Object.keys(STATIC) as SubjectId[]).map((id) => [
        STATIC[id].address.toLowerCase(),
        id,
      ]),
    ),
  );

/** Map a RatingRequested subject address to its SubjectId, or null if unknown. */
export function subjectIdFromAddress(address: string): SubjectId | null {
  return ADDRESS_TO_SUBJECT[address.toLowerCase()] ?? null;
}
