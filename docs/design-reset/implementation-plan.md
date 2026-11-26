# PhishNet — Staged Implementation Plan

**Authority:** [requirements.md](requirements.md) provides only user/system requirements; [dfd-level-0.mmd](dfd-level-0.mmd) defines the context boundary; [normalization.md](normalization.md) explains 1NF→2NF→3NF; [erd-3nf.mmd](erd-3nf.mmd) is the **initial database migration target**, subject to constraint review. Existing baseline: \`main\` at \`ab57d519\`.

## Required context and verification

Read [research-context.md](research-context.md), [research-references.md](research-references.md), and [testing.md](testing.md) before editing. The simpler ERDs are visual presentation views; use [schema-implementation-checklist.md](schema-implementation-checklist.md) to construct and prove an actual normalized physical schema.

## Product boundary

Build an evidence/provenance investigator and deterministic payment-authorization **simulator** first. Do not misrepresent fake transaction hashes as verified Arc settlement, client approval booleans as independent human approval, rule matching as Gemini inference, or a mock 402 flow as full AP2/x402 compliance. Real signing/testnet integration requires a separate later gate. Preserve existing useful application code where appropriate; refactor incrementally.

| Stage | Work package | Acceptance criterion |
|---|---|---|
| **0 — Truthful, safe demo** | Loopback-only server, simulation-only receipts, no fabricated explorer links, safe event rendering, input validation, truthful capability matrix. Refactor tests to invoke production code. | No false settlement/approval/model claims; reproducible tests exercise real modules. |
| **1 — Canonical model and persistence** | Validate 3NF-oriented ERD and implement durable SQLite migrations, atomic simulated accounting, replay identifiers, fixture import, event and evidence API. | Foreign keys and uniqueness work; state survives restart; cycle/duplicate protection tested. |
| **2 — Investigation UX** | Event timeline, expandable claim graph, observed vs inferred edges, source citation and evidence drilldown, original intent vs proposed payment diff, mobile layout. | Reviewer can contrast fraudulent-looking vendor swap and legitimate independently verified update, without asserting unsupported causality. |
| **3 — Independent deterministic policy** | One shared evaluator, ALLOW/HOLD/DENY reason codes, strict scope/recipient/amount/asset/chain/expiry/nonce validation, test-first evaluation. | Real API and unit tests cover legitimate and denied outcomes, no expected-label self-comparison. |
| **4 — Authenticated human authorization** | Identity/authz, signed mandates, transaction-bound human approvals, signing-service separation, credential revocation, concurrency safeguards. | Agent/client cannot self-authorize or bypass signer boundary; replay and concurrent-spend tests pass. |
| **5 — Verified testnet and audit** | Pick one real testnet payment flow and supported AP2/x402 profile; verify receipt; signed append-only checkpoint, inclusion/consistency checks and redacted audit exports. | Real receipt exists only after network verification; tampering is detected against an independently trusted commitment. |
| **6 — Evaluation and pilots** | Held-out scenario families, human review study, baseline comparisons, latency/cost/false-block metrics, real customer interviews, governance documentation. | Reproducible evidence shows whether provenance improves outcomes beyond a normal allowlist/budget gate. |

## Demonstration scenarios (synthetic, consent-safe)

- Unauthorized vendor wallet substitution repeated by two agents → explain source provenance and deny.
- Legitimate vendor address change supported by independent evidence and a **new signed mandate** → permit simulated transfer.
- Within-budget micropayment; then surcharge/budget-exhausted attempt → permit and deny respectively.
- Repeated nonce after app restart → deny.
- Prompt-injection text claiming priority or approval → no permission increase.
- Altered logged event vs independently signed checkpoint → proof verification fails.

## Required evidence per stage

Create and maintain a requirements traceability matrix. For each stage, include executed tests, observed outcomes, failures, environment, implementation SHA, and outstanding items. Documentation tests alone do not certify the app.

## Engineering protocol for phone agent

1. Read all files in this folder and repository sources before edits; produce a \`UR/SR → module → status → test\` matrix.
2. Implement one stage at a time. Write failing tests that exercise production code, not copied policy functions or expected labels.
3. Use the concise ERDs only as design input. Derive actual normalized physical tables using schema-implementation-checklist.md and requirements.md. Preserve fixture IDs with documented mappings.
4. Use a small commit per coherent change; do not rewrite unrelated files or delete existing history.
5. Keep model output advisory. Never expose signing keys, arbitrary shell access or authority-changing APIs to untrusted agent tools.
6. Run tests, report actual results and remaining gaps; never fabricate security metrics or network receipts.
7. Update the requirements, diagrams and plan when architecture changes, before adding incompatible code.

**Stage 0 is the next task. No production payment service should be deployed from this prototype.**
