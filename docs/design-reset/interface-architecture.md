# Investigation interface decision — 2026-11-26

Read the complete design-reset directory, including source notes, catalog, strategy, research, requirements, diagrams, schema checklist, testing, prior results and traceability. The uploaded readings are used through their original summaries; no restricted PDFs/slides or extracts were copied.

## Implemented slice

The default Node UI is now payment review → chronology → claim lineage → source inspector. Desktop uses three coordinated panels; phones stack them. Exact transaction values are text, with full address disclosure and explicit recipient change. There is no live payment action. Previous wallet/demo APIs remain simulation only and are not exposed as execution controls in the new UI.

`packages/core/src/investigations.js` constructs two read-only canonical cases. Every timeline/graph selection uses the same event ID, original content, actor, timestamp, claim and trust state. The common claim is one source with two agent repetitions. Relationship controls name observed references, inferred influence (dashed, low-confidence hypothesis), unverified relations, unknown provenance and separately verified fixture independence. Chronology is not interpreted as causality. A fixed graph avoids randomized layout and supports normal keyboard buttons; all untrusted strings are assigned through textContent.

The legitimate update is a controlled synthetic counterexample: separate Ed25519 fixture verifier key, new owner-signed mandate and owner signature over the exact proposal. A changed proposal or wrong verifier cannot meet the internal verification gate. This gate is not exposed as a client-provided approval field. Fixture identities/keys are ephemeral and do not implement trusted credential enrollment, revocation, expiry/challenge checks or production independence. Fixture verification cannot authorize legacy API execution. Stage 4 remains open.

The existing server evaluator was extracted to `simulation-policy.js`; API callers cannot supply the verifier's internal option. The stale TypeScript policy is not used by the Node runtime. Stage 1 database integrity remains open; this UI slice does not claim to implement the physical ERD.

## Component / license selection

Catalog shortlist reviewed against upstream license files on 2026-11-26:

| Component | Checked source | License | Decision |
|---|---|---|---|
| React Flow | https://raw.githubusercontent.com/xyflow/xyflow/main/LICENSE | MIT | Preferred next renderer when graph complexity warrants React; free core only |
| shadcn/ui | https://raw.githubusercontent.com/shadcn-ui/ui/main/LICENSE.md | MIT | Reference for progressive controls; no source copied |
| TanStack Table | https://raw.githubusercontent.com/TanStack/table/main/LICENSE | MIT | Defer searchable inbox until more than two cases justify a table |
| Native buttons, select, details; original graph | Repository-owned implementation | Apache-2.0 | Selected for six events in existing vanilla app; no runtime dependencies or third-party copied code |
| @playwright/test 1.65.1 | Installed package LICENSE; package-lock.json integrity | Apache-2.0 | Pinned development-only browser runner; no application code copied |

This intentionally adapts the strategy's suggested React stack: introducing React/build tooling for two cases adds complexity without additional investigative capability. The graph renderer is isolated from canonical case data, preserving a later React Flow migration. No enterprise/Pro examples, GPL/AGPL applications, Blockscout or unlicensed projects were copied. Since no catalog source was imported, no copied-source commit pin is applicable; re-check and pin exact commits/file exceptions before future reuse. npm's install audit reported zero vulnerabilities for the four-package development tree; that scan is not a security audit of the app.

## Acceptance and expansion

VC-01–09 have executable browser checks; see investigation-results.md for actual outcomes. VC-10 has local measurement/export infrastructure, but requires real reviewers. Never declare Stage 2 or efficacy complete from form automation. Study condition can hide the graph for timeline-only comparison; collect both scenarios and counterbalance order. Reviewers should report decision, claim origin, confidence and observed input errors; missing observations remain missing.

Stages 0/1/3/4/5 still require comprehensive validation, persistence, full policy scope, identity controls, isolated signing and real verified settlement. No financial actions should leave simulation while those gates are open.
