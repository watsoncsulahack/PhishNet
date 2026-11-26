# PhishNet — Staged Implementation Plan

**Authority:** [requirements.md](requirements.md) provides only user/system requirements; [dfd-level-0.mmd](dfd-level-0.mmd) defines the context boundary; [normalization.md](normalization.md) explains 1NF→2NF→3NF; [erd-3nf.mmd](erd-3nf.mmd) is the **initial database migration target**, subject to constraint review. Existing baseline: \`main\` at \`ab57d519\`.

## Visualization-related design inputs

Read [uploaded-source-notes.md](uploaded-source-notes.md), [visualization-design-strategy.md](visualization-design-strategy.md), and [visualization-projects.md](visualization-projects.md) before implementing Stage 2. The updated strategy favors **mobile transaction review first, a source-linked timeline second, and a desktop evidence graph third**. Start with React Flow + shadcn/ui + TanStack Table; add aggregate charts only when measurements exist. Reuse only licenses compatible with the intended distribution. All UI metrics require real tests, not canned scores.

## Required context and verification

Read [research-context.md](research-context.md), [research-references.md](research-references.md), and [testing.md](testing.md) before editing. The simpler ERDs are visual presentation views; use [schema-implementation-checklist.md](schema-implementation-checklist.md) to construct and prove an actual normalized physical schema.

## Product boundary

Build an evidence/provenance investigator and deterministic payment-authorization **simulator** first. Do not misrepresent fake transaction hashes as verified Arc settlement, client approval booleans as independent human approval, rule matching as Gemini inference, or a mock 402 flow as full AP2/x402 compliance. Real signing/testnet integration requires a separate later gate. Preserve existing useful application code where appropriate; refactor incrementally.

| Stage | Work package | Acceptance criterion |
|---|---|---|
| **0 — Truthful, safe demo** | Loopback-only server, simulation-only receipts, no fabricated explorer links, safe event rendering, input validation, truthful capability matrix. Refactor tests to invoke production code. | No false settlement/approval/model claims; reproducible tests exercise real modules. |
| **1 — Canonical model and persistence** | Validate 3NF-oriented ERD and implement durable SQLite migrations, atomic simulated accounting, replay identifiers, fixture import, event and evidence API. | Foreign keys and uniqueness work; state survives restart; cycle/duplicate protection tested. |
| **2 — Investigation UX** | Mobile-first payment comparison and source-linked vertical timeline; desktop read-only React Flow evidence graph; cross-highlighting; visible observed/inferred/verified/unknown states; user-facing source context. Use the visualization strategy and catalog. | VC-01–VC-10 pass tested desktop/mobile flows, including a signed legitimate-update counterexample, exact address visibility and uncertainty labels. |
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

## 2026-11-26 investigation increment

The user's transaction/timeline/provenance priority is implemented as a read-only vertical slice alongside the existing simulation API. See [architecture and component selection](interface-architecture.md) and [actual results](investigation-results.md). This is an intentional scoped advance into Stage 2, not a claim that Stage 1 persistence or Stage 4 production authorization passed. Native controls and an original fixed graph avoid introducing React for six events; the canonical model permits a later React Flow renderer. Stage 2 remains partial: signed synthetic counterexample passes, real trusted identity/signing and human study VC-10 are open.

## Direct wallet application update

The owner subsequently requested actual testnet initiation. [testnet-payments.md](testnet-payments.md) defines the added manual wallet path and its tested controls. A human reviews and signs each native USDC transfer in an external browser wallet; the backend only reads public chain data and checks receipts. This changes the application default to Payments, Activity and Visualizations. It does **not** complete autonomous signing, institutional authorization, durable mandate accounting or the broader Stage 4/5 gates. The legacy Arc adapter stays disabled, and synthetic agent scenarios stay simulated. Real funded-wallet end-to-end verification requires the user's approval.

## Owner's notebook and separate-device direction

The new [decision notebook and consent profile](notebook-and-consent.md) supersede the initial simple fixed-graph renderer for Visualizations. Cytoscape provides an Obsidian-like map while the canonical case model retains original events and typed uncertainty. The counter-sign 0.2 raw-keyed profile is implemented behind operator-pinned human public enrollment; its file route never places the human key in the app. This is not completion of production credential governance, org-root enrollment, durable approval storage or physical-card attestation. Physical approval should remain a separate device boundary, with a tested receipt adapter and enrollment/recovery controls before enabling autonomous financial execution.
