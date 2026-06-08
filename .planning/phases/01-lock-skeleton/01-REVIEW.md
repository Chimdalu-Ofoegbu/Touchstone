---
phase: 01-lock-skeleton
reviewed: 2026-06-08T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/RatingRegistry.sol
  - src/constants/GradeEnum.sol
  - script/Deploy.s.sol
  - test/RatingRegistry.t.sol
  - foundry.toml
  - remappings.txt
  - .gitignore
  - .env.example
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 1 ships a small, well-scoped `RatingRegistry` skeleton plus a Foundry harness and a Mantle Sepolia broadcast script. The code is clean, the public surface matches the declared contracts (`CON-publishRating-signature`, `CON-requestRating-signature`, `CON-rating-schema`, `CON-grade-encoding`), and the five named verification cases from `01-VALIDATION.md` (`1-02-02-a` through `1-02-02-e`) are each present in `test/RatingRegistry.t.sol`. There are no critical security defects — there are no external calls (no reentrancy surface), 0.8.24 checked arithmetic neutralises overflow concerns on the `uint8` and `uint256` paths, and the `onlyAgent` modifier correctly reverts on mismatch with a custom error.

The defects found are all in the "Phase 1 stub permissiveness vs. defence-in-depth" category and one minor test-assertion brittleness. Most notable:

- `confidence` is accepted without a `<= 100` range check, so a buggy agent can write nonsense values that off-chain consumers will trust.
- `agent` is mutable storage with no setter, but is never reassigned — declaring it `immutable` would save gas, match the documented "set once" intent, and prevent a future careless edit from introducing an unauthorised rotation path.
- `latestRating` documents "zero-valued Rating if none" but does not specify the sentinel field; the test asserts `subject == address(0)`, which is not robust if a future caller publishes about `address(0)`.
- `.gitignore` does not glob `.env.*`, so `.env.production` / `.env.mantle` could be accidentally committed.

None of these block deployment of the Phase 1 skeleton, but `WR-01` (confidence range) and `WR-02` (immutable agent) are worth fixing before Phase 2 builds on this surface.

## Warnings

### WR-01: `confidence` is never range-checked, contradicting the implied 0-100 schema

**File:** `src/RatingRegistry.sol:70-87`
**Issue:** `publishRating` validates `grade <= GradeEnum.MAX` but performs no validation on `confidence`. The schema treats `confidence` as a percentage (all tests use values in `[50, 100]` and the natspec on `Rating` is silent on the upper bound), but `uint8` accepts 0-255. A buggy or malicious agent can publish `confidence = 200`, which downstream consumers (frontend, scoring math in later phases) will silently consume as a "200% confidence" rating. This is exactly the kind of permissive Phase-1 stub that becomes a Phase-3 vulnerability after `onlyAgent` is broadened to "any ERC-8004 NFT holder".
**Fix:**
```solidity
error InvalidConfidence();
// ...
if (grade > GradeEnum.MAX) revert InvalidGrade();
if (confidence > 100) revert InvalidConfidence();
```
Add a matching boundary test (`confidence = 100` allowed, `confidence = 101` reverts) to `test/RatingRegistry.t.sol`.

### WR-02: `agent` should be `immutable` — current storage slot allows silent ABI-compatible mutation

**File:** `src/RatingRegistry.sol:26`
**Issue:** `address public agent;` is a storage variable set exactly once in the constructor and never reassigned. The natspec on the contract explicitly states that Phase 3 will "swap the modifier implementation ... WITHOUT changing the contract ABI", which is a redeploy, not an in-place rotation. Leaving `agent` as mutable storage:
1. Wastes a `SLOAD` on every `publishRating` call vs. an `immutable` constant inlined into bytecode.
2. Reserves storage slot 0 for a value that never changes — making future storage-layout reasoning noisier.
3. Most importantly, leaves a footgun: a future patch can add `function setAgent(address) external { agent = ... }` without any compile-time signal that this contradicts the documented "set once" design.
**Fix:**
```solidity
address public immutable agent;

constructor(address initialAgent) {
    agent = initialAgent;
}
```
The public auto-getter still works. No test changes required (the existing tests do not exercise mutation).

### WR-03: `latestRating` sentinel is undocumented; test uses fragile `subject == address(0)` assertion

**File:** `src/RatingRegistry.sol:89-96`, `test/RatingRegistry.t.sol:62-67`
**Issue:** `latestRating` returns `Rating(address(0), 0, bytes32(0), 0, 0, address(0))` when no ratings exist, but the natspec says only "a zero-valued Rating if none" without naming the canonical sentinel field. The test asserts `assertEq(empty.subject, address(0))` — but if a future caller (legitimately or by accident) calls `publishRating(address(0), ...)`, that test assertion still passes when the function is actually returning a real rating, masking a regression. The robust sentinel is `timestamp == 0`, since `block.timestamp` is never 0 on any live chain or Foundry default (Foundry starts at `block.timestamp = 1`).
**Fix:** Document the sentinel in natspec and tighten the test assertion:
```solidity
/// @notice Returns the most recent Rating for `subject`. If no rating has been
///         published, returns a zero-valued Rating where `timestamp == 0` is the
///         canonical "no rating" sentinel (block.timestamp is never 0 on a live chain).
function latestRating(address subject) external view returns (Rating memory) { ... }
```
And in the test, lead the empty-case assertion with `assertEq(empty.timestamp, uint256(0));` as the sentinel check (the other assertions remain as additional integrity checks).

### WR-04: `.gitignore` does not cover `.env.*` family — `.env.production` etc. can be committed

**File:** `.gitignore:7-9`
**Issue:** The Secrets section ignores `.env` and `.env.local` but not the broader `.env.*` family. If a future phase introduces `.env.mantle`, `.env.production`, or `.env.staging` (a common pattern when juggling Sepolia + Mainnet deployer keys), they will be tracked by default. Given that the deployer key in this repo controls a deployed Mantle Sepolia contract (and Phase 5 will use a mainnet key), a single accidental `git add .env.mantle` exfiltrates a live deployer wallet.
**Fix:**
```gitignore
# Secrets
.env
.env.*
!.env.example
*.pem
*.key
```
The `!.env.example` re-include is required so the template stays tracked.

## Info

### IN-01: `RatingPublished` event omits `agentIdentity` — off-chain consumers must re-read state

**File:** `src/RatingRegistry.sol:32-38, 86`
**Issue:** The `Rating` struct stores `agentIdentity` (Phase 3 will diverge from `msg.sender`), but the `RatingPublished` event does not include it. Off-chain indexers tracking "which agent published this rating" must call `ratingHistory(subject)` and walk the array — defeating the purpose of indexed logs. This is a minor design concern today (Phase 1 `agentIdentity == msg.sender == agent`) but becomes a real cost in Phase 3 when multiple ERC-8004 identities publish.
**Fix:** Add `agentIdentity` to the event and emit it from `publishRating`:
```solidity
event RatingPublished(
    address indexed subject,
    address indexed agentIdentity,
    uint8 grade,
    bytes32 reasoningHash,
    uint8 confidence,
    uint256 timestamp
);
```
The test event re-declaration in `RatingRegistryTest` must be updated to match.

### IN-02: `GradeEnum.MAX` duplicates `GradeEnum.D` — single source of truth would be clearer

**File:** `src/constants/GradeEnum.sol:17, 20`
**Issue:** `D = 9` and `MAX = 9` are two constants with the same value. If a future grade tier (e.g., `DD`, default) is added, the author must remember to bump `MAX` in lockstep. A safer pattern is to derive `MAX`:
```solidity
uint8 internal constant MAX = D;
```
This makes the relationship explicit and impossible to skew.
**Fix:** Replace `uint8 internal constant MAX = 9;` with `uint8 internal constant MAX = D;`.

### IN-03: `publishRating` and `requestRating` accept `subject == address(0)`

**File:** `src/RatingRegistry.sol:63-65, 70-87`
**Issue:** Neither function rejects `subject == address(0)`. While the contract is permissive by design and an `address(0)` rating is harmless on-chain, it pollutes the history mapping and can confuse off-chain consumers that special-case the zero address. Since the only writer is the trusted agent today, this is informational.
**Fix:** Add a single-line guard if Phase 2 wants to harden the surface:
```solidity
error InvalidSubject();
if (subject == address(0)) revert InvalidSubject();
```

### IN-04: `test_publishRating_gradeRange` does not assert the lower boundary (`grade == 0`)

**File:** `test/RatingRegistry.t.sol:42-51`
**Issue:** The test covers `grade == 9` (upper boundary accepted) and `grade == 10` (just above MAX reverts). It does not assert that `grade == 0` (AAA) is accepted, which is the symmetric lower-boundary case. Other tests (`test_latestRating_returnsLast`, `test_ratingHistory_returnsAll`) do publish `grade == 0` indirectly, so this is coverage tidiness, not a true gap.
**Fix:** Add one line before the upper-boundary assertion:
```solidity
registry.publishRating(subject, GradeEnum.AAA, bytes32(uint256(1)), 50);
```

### IN-05: `requestRating` has no spam guard and is callable by anyone for any subject

**File:** `src/RatingRegistry.sol:63-65`
**Issue:** Per the documented design (`DEC-onchain-trigger-requestRating`), anyone can emit `RatingRequested` for any subject. The off-chain agent is expected to decide whether to honour the request. This is correct per the design contract but worth noting as the documented attack surface: an attacker can flood `RatingRequested` events to grief the agent's listener (gas to scan + queue pressure). Not a contract-level bug — recording for the Phase 2 listener design.
**Fix:** No contract change. When implementing the off-chain listener in Phase 2, include a per-requester debounce or a "subjects already rated in last N blocks" filter.

### IN-06: `foundry.toml` etherscan block uses `${MANTLE_EXPLORER_KEY}` with no default — empty interpolation may break `forge verify`

**File:** `foundry.toml:17-18`
**Issue:** `.env.example` notes that Blockscout does not require a key. If `MANTLE_EXPLORER_KEY` is unset (the documented happy path), the interpolation resolves to an empty string. Some `forge verify-contract` versions tolerate this; others emit a config-parse warning. Worth confirming on the actual deploy run.
**Fix:** Either (a) confirm during Phase 1.03 verification that empty `key = ""` works against Blockscout's Mantle Sepolia API, or (b) drop the `key = ` field entirely from the `mantle_sepolia` etherscan stanza since Blockscout ignores it:
```toml
mantle_sepolia = { url = "https://explorer.sepolia.mantle.xyz/api/", chain = 5003 }
```

---

_Reviewed: 2026-06-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
