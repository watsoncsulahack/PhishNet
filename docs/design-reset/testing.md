# PhishNet: Testing and Verification Plan

**Safety boundary:** a passing documentation check does NOT establish that money is safe or an AI agent is secure. The existing test harness contains copied policy logic and self-confirming expected labels.

## Test tiers

| Tier | What to execute | Release implication |
|---|---|---|
| T0 Documentation | Verify 26 UR and 50 SR identifiers; ERD 14 entities/20 crow's-foot relationships consistent across 3 views; DFD; research and test files | Required on every docs commit |
| T1 Runtime unit | Import ACTUAL policy, graph, hashing and schema modules (not copies in tests) | Required before calling a feature implemented |
| T2 HTTP integration | Start actual API; test unauthorized and valid requests and inspect state changes | Required for Stage 0 |
| T3 Database integrity | Restart, FK constraints, nonce replay, concurrency and budget atomicity | Required before P1 |
| T4 UI/mobile | 390px viewport, click to inspect sources, injection-safe message rendering, visible simulated labels | Required for MVP usability |
| T5 Agent threat model | Source prompts cannot authorize payments; tool permissions cannot bypass signer | Required before signing integration |
| T6 Cryptographic/testnet | Signed transaction-bound approvals; real network receipt confirmed with correct fields | Required before saying CONFIRMED |
| T7 Research efficacy | Family-disjoint cases, real measured false blocks, evidence accuracy and reviewer comparisons | Required before making efficacy claims |

## Minimum controlled cases

| ID | Expected result |
|---|---|
| TC01 | Normal authorized simulated micropayment ALLOW |
| TC02 | Wrong recipient DENY |
| TC03 | Valid updated recipient with NEW independently signed mandate ALLOW |
| TC04 | Required human signature missing HOLD |
| TC05 | Zero, negative and malformed amounts reject without mutation |
| TC06 | Amount above permitted cap DENY |
| TC07 | Wrong chain/asset DENY |
| TC08 | Expired or revoked mandate DENY |
| TC09 | Reused nonce DENY, including after restart |
| TC10 | Concurrent charges cannot exhaust budget beyond cap |
| TC11 | Prompt saying 'ignore the mandate' cannot affect policy |
| TC12 | Repeated claim from common origin is not independent evidence |
| TC13 | Genuine separate authenticated corroboration recognized distinctly |
| TC14 | Benign urgent message is not marked 'fraud confirmed' |
| TC15 | Tampered event fails independently witnessed audit-root verification |
| TC16 | HTML from untrusted messages is displayed as text, not executed |
| TC17 | Simulated payment never claims actual settlement/explorer proof |
| TC18 | Client-provided humanApproved=true does not satisfy signed approval |

## Honest baseline before refactoring

- Run node tests/run-all.js. Record actual results, but DO NOT treat the output as security validation: its policy function is duplicated and 16 regression cases set actual outcome directly from expected.
- Run the app on localhost, query /v1/health and /v1/scenarios, and test /v1/analyze and /v1/preflight with controlled fixtures.
- Label each test PASS, FAIL, NOT_IMPLEMENTED or NOT_RUN and record git SHA, command, input and observed result.
- When tests require persistent DB, signer, live settlement or external trusted checkpoint, mark NOT_IMPLEMENTED until actually built.
- Metrics MUST be computed from executed, independently labeled tests; report denominators, uncertainty and false blocks. Do not hard-code perfect scores.

## Required CI and reporting

The workflow .github/workflows/design-verification.yml runs node scripts/verify-design-docs.mjs for documentation structure and node scripts/smoke-api.mjs against a locally spawned actual Node HTTP server. These are baseline checks and do NOT verify signer isolation, durable spend, genuine AP2/x402, provenance accuracy or confirmed on-chain settlement. Build additional unit, API, database, mobile and signer test jobs as implementation progresses. A docs green check verifies only docs structure.

Before each stage is declared complete, produce a requirements-to-tests matrix with command, actual output, pass/fail, code commit, and remaining blockers. No mainnet or uncontrolled third-party testing.

## Visualization and mobile usability acceptance tests

The ten requirements in [visualization-design-strategy.md](visualization-design-strategy.md) are tracked as **VC-01 through VC-10** (mobile first-screen decision, inspect source in two actions, cross-highlight, single-source convergence, benign counterexample, exact-address disclosure, simulated-vs-confirmed status, edge uncertainty labels, accessible input, measured user decisions).

**Implementation stages:**
1. At Stage 2, add deterministic Playwright or equivalent E2E cases for 390px and narrow 320px, touch/keyboard navigation and untrusted-text escaping. These are **future tests**, not currently passing tests.
2. Record whether each reviewer identifies the originating evidence and the true payee difference correctly; compare timeline-only and timeline+graph in a controlled study with both harmful and legitimate scenarios.
3. Confirm reduced motion/high contrast and text labels for status/edges; use live source detail instead of hover-only hints.
4. For each open-source component, check LICENSE and any enterprise/subdirectory exception before copying source; include dependency scan and pinned version in pull requests.
5. Test offline only with explicitly authorized redacted read-only case data. Never sign or imply confirmed payment while offline.

**Metrics to report from actual tests:** task completion numerator/denominator, decision correctness, source-identification correctness, incorrect confidence, time-to-answer and tap/keyboard errors. All source-based numbers and graphs must disclose fixture or real-data provenance.
