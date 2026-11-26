# MVP implementation audit and milestone log

Authoritative scope: [mvp-scope.md](mvp-scope.md). Synchronized baseline: `ae7b9f6` (fast-forward from `6f0a80b`). Read the MVP scope, concept UI/provenance notes, notebook/consent, testnet payments, requirements, traceability, testing, agent handoff, research context and visualization strategy before code changes.

## Initial audit (M0)

| Acceptance | Baseline finding | Required delta |
|---|---|---|
| MVP-01 | No local-agent connector | Wallet-scoped, revocable capabilities; typed reads and unsigned proposal tools only |
| MVP-02 | Manual exact terms/fee review exists | One review path for immutable gateway proposals and transaction-bound CounterSign |
| MVP-03 | Official keyed verification exists; state in a Map | Durable pending/approved/rejected/expired/consumed records and restart replay tests |
| MVP-04 | Wallet rejection visible, not durably recorded | Journal rejection/cancellation before returning UI status |
| MVP-05 | Actual Arc RPC receipt comparison exists | Retain it; append verifier-owned results to shared journal |
| MVP-06 | Real activity only in browser storage; map defaults to demos | Durable shared real event projection, no synthesized agent events for manual payments |
| MVP-07 | One graph view, no independent layers | Transaction Flow / Decision History independent controls (four states) |
| MVP-08 | Source inspector only for synthetic fixtures | Generic real-event inspector with source, scope, verification/privacy and proof metadata |
| MVP-09 | No server private-journal ownership boundary | Wallet proof/session scope; connector tokens restricted to one wallet and selected traces |
| MVP-10 | No externally verifiable checkpoint | Signed checkpoint, minimal Arc commitment and separate verifier with pinned trust/head |
| MVP-11 | No actual on-chain audit publishing | Hash/sequence-only calldata; encrypted local private content; privacy tests |
| MVP-12 | No manifest/service worker, Receive/Chat/Settings absent | Sketch-led PWA shell and honest offline agent/microphone behavior |
| MVP-13 | Existing actual-code suites present | Record baselines; execute each new milestone's tests and maintain regression suite |

Observed baseline: `npm test` reports 15/15 actual-server smoke checks passed. Prior 63-case browser report is historical until rerun. Node v22.23.0 exposes SQLite 3.51.3 via experimental `node:sqlite`; no external database service is needed. The public Arc configuration remains chain 5042002, native USDC 18 decimals, official fixed RPC. JSON Schema dependencies use pinned versions; installed licenses must be reviewed before reuse.

The recorder is a local-service trust boundary. A compromised OS/recorder can rewrite unanchored records or suppress observations; neither the PWA nor an internal hash chain alone proves complete history. M6 funded payment and real audit publication require explicit human wallet approval; automation cannot declare those gates passed.

## M0 contract

Added a strict versioned EventTraceV1 JSON Schema with per-event payloads, canonical serialization, scope, typed relations, recorder-assigned verification and explicit unsigned-local event authentication. No raw chat field is accepted in journal payloads; private evidence uses protected references. The existing wallet path is unchanged at this milestone.

M0 verification: `node tests/event-contract.test.js` passed 4/4 (strict payloads, authority injection, canonical values and schema parity). `npm test` baseline passed 15/15. AJV and ajv-formats installed LICENSE files are MIT. This is schema verification, not a completed journal or independent authorization gate.

## M1a durable journal core

Added SQLite/WAL/FULL-synchronous migrations, immutable event/relationship tables, ordered digests, scoped encrypted content references and persistence tables for proposals/consent/sessions/connectors/checkpoints. Recorder identity, verification state and sequence are assigned by component rules; callers cannot inject them. Parents must already exist in the same wallet and trace, preventing cycles and foreign references. Runtime keys/content encryption material live in owner-only files separate from event rows. This is single-host protection, not a defense against that host's administrator or a trusted external witness.

`node tests/journal.test.js`: 5/5 passed (restart/key stability, privacy/scope, provenance injection, atomicity/append-only triggers and naive offline-tamper detection). Wallet route integration and untrusted browser-history migration follow next; M1's complete exit gate is not declared yet.

## M1b / M2 gateway and durable consent

Wallet ownership uses a one-time origin-bound signed challenge and an HttpOnly/SameSite session; every private request must also name that same selected wallet. Revocable hashed agent capabilities expose only four typed tools (`wallet.balance`, `chat.read`, `plan.report`, `payment.propose`). Chat and purposes are encrypted off-chain; proposals are immutable, scoped and unsigned. Actual CounterSign keyed verification now persists intent/resolution/consumption across restart. Authorization is consumed atomically before the external-wallet request, and submitted hashes remain wallet-reported until the existing exact RPC verifier checks them. Legacy imports create only untrusted observations. No agent tool or HTTP endpoint can financially sign.

Actual results: gateway integration 5/5; actual HTTP integration 1/1 (real wallet-ownership and CounterSign signatures, controlled RPC reader); existing CounterSign HTTP 6/6; existing API smoke 15/15. These demonstrate application boundaries/restart behavior with controlled test credentials, not independently held production credentials or funded settlement. Canonical UI integration remains the next gate. Node SQLite remains experimental; back up the database and separate key directory together under owner-only access.

## M3 — canonical wallet/PWA UI

Implemented the sketch-led balance, equal Send/Receive actions, plain Chat and Wallet/Activity/Graph/Settings bottom navigation. Manual and agent proposals use the same gateway-backed exact review. Ownership sign-in gates private history, source retrieval, Chat and connector management; switching accounts clears the prior wallet's private UI. Receive discloses incomplete incoming coverage. Explicit browser-history migration creates only untrusted imports. Wallet functionality has no model dependency. Voice input is disabled/labeled. Manifest, raster/SVG icons and a public-shell-only service worker support HTTPS/localhost installation; APIs are never cached.

Actual automated evidence: 14 canonical payment/chat/receive browser scenarios × 3 viewports, plus a PWA manifest/icon/offline-shell test × 3. The final full-suite outcome is recorded below and in `evaluation/mvp-results.json`. Headless browser checks are not physical-device installation or real-wallet settlement. Mobile/desktop screenshots are generated in `test-results/` and mobile Wallet/Graph renders were visually inspected.

## M4 — real journal graph

Activity, timeline and Cytoscape graph project the same EventTraceV1 records. Transaction Flow and Decision History switches independently support either/both/neither; the proposal shares one event ID across layers. Wallet, UTC date, trace and text filters do not mutate the underlying data. Selection survives visibility changes. Nodes/edges expose originals, privacy/verification/confidence, protected source references and observed-reference semantics. Private model cognition is never inferred. Manual sends get no agent notes; imported hashes get no invented approval. Synthetic vendor substitution and its signed legitimate counterexample remain isolated behind Demo.

Actual evidence: projection 3/3, chat→real protocol receipt→external-wallet-double→graph interactions at all three viewports; existing VC-01–VC-10 infrastructure and notebook cases preserved behind Demo. VC-10 human efficacy observations remain NOT_RUN. The first full 72-case run found a manual wallet-rejection retry gap (70 passed, 2 failed); fixed with a permanent authorization marker, UI disabling and restart/expiry regression. The subsequent 75-case run found mobile graph address overflow (73 passed, 2 failed); wrapping was fixed, then a complete rerun passed 75/75. Visual review further compacted mobile filters, made raw JSON progressive, preserved pan/zoom during journal polling and kept initial graph labels readable. Final verification follows below.

## M5 — checkpoint software and independent verifier

Implemented separately keyed Ed25519 checkpoints, prefix Merkle inclusion proofs, wallet-scoped exports, hash/sequence-only 84-byte Arc commitment data, separate external audit-publisher flow and actual canonical/finalized public-RPC comparison. Checkpoint publication is always explicitly approved outside the service. UNANCHORED, BROADCAST, UNVERIFIED and locally RPC-verified ANCHORED are distinct. Verification errors/retries are durable observations. The standalone CLI reads an export and independently pinned identities/head, then talks directly to Arc without PhishNet APIs. It fails on changed data, omitted selected-wallet leaves, reordered/duplicate sequences, invalid proof/signature/foreign publisher and rollback against an externally pinned newer head.

`node tests/audit.test.js`: 5/5 passed, including a separate CLI subprocess rejecting unanchored history and controlled RPC success/failure/finality checks. The first sandboxed subprocess run could not execute the verifier and failed 1/5; rerunning that same suite with process permission passed 5/5. Checkpoint browser UI/export/failure status passes at all three viewports. No controlled test is a real Arc publication. The **live M5 anchor gate remains pending with the funded M6 run**. An external head/witness is required for freshness/rollback guarantees; the local host and public RPC remain trust dependencies. See [format, verification and limits](audit-checkpoints.md).

## M6 — validation boundary

The owner explicitly selected **“Implement and test; leave the funded check pending.”** No human seed, funded signing account or fabricated receipt has been substituted. A live read-only Arc check succeeded: chain 5042002, observed block 74261173; 0.000001 native USDC estimate returned gas `0x6270`, maximum fee budget `1260000000000000` base units. This sent no payment or anchor. Actual funded CounterSign→wallet→receipt→checkpoint proof is **NOT_RUN / owner-deferred**, as are independent credential-custody validation, a security audit, physical-device installation and human efficacy testing.

A remaining recovery limit is explicit: after a recorded authorization but before a wallet-returned hash is available, PhishNet cannot infer whether the external wallet broadcast. It preserves AUTHORIZATION_REQUESTED and refuses replay; the human must reconcile wallet/explorer history. Browser recovery retries only journal recording of a returned hash, never a transaction. Private-source availability requires encrypted-content/key backups. The local recorder cannot prove observations it never received.

## Final automated verification (implementation `f4d72b4`)

The release browser run used the final navigation and graph source: **75 passed, 0 failed, 0 skipped, 0 flaky**, 76.425 seconds, started 2026-11-26T20:22:48.051Z. It includes 15 payment/agent/audit cases, 6 synthetic investigation cases, 3 notebook cases and 1 PWA case at each of 320×740 touch, 390×844 touch and 1440×1000 desktop. Separate navigation verification also passed 3/3 after ensuring tab changes return to the top.

| Command | Actual result | Scope / remaining boundary |
|---|---|---|
| `npm run test:mvp` | 6 suites; **25/25** tests pass | Contract 4, journal 5, gateway 7, graph 3, audit 5, actual HTTP workflow 1; controlled credentials/readers |
| `npm run test:browser` | **75/75** pass | Actual journal/gateway and real test signatures; wallet/RPC doubles; no live settlement |
| `npm test` | **15/15** pass | Existing simulation API regressions |
| `npm run test:unit` | **4/4** pass | Synthetic source/authorization fixtures |
| `npm run test:payments` | **7/7** pass | Production amount/address/reader logic with controlled RPC |
| `npm run test:chain` | **4/4** safety checks pass | Legacy autonomous signer remains disabled |
| `npm run test:notebook` | **3/3** pass | Synthetic notebook model/filter regressions |
| `npm run test:consent` | **6/6** pass | Actual official CounterSign library; controlled keys |
| `npm run test:consent-api` | **6/6** actual HTTP checks pass | Human test signing key outside the spawned service |
| `npm run test:testnet-api` | **9/9** actual HTTP checks pass | Origin/Host/body/chain and no-signing boundary |
| `node scripts/verify-design-docs.mjs` | PASS | Structure, not financial security; rerun after this log update |
| `npm run build` | PASS (also run by browser web server) | Local bundle and retained license notices |
| `npm audit --omit=dev --json` | **0** known reported vulnerabilities | Advisory lookup, not independent security verification |
| `node scripts/check-arc-network.mjs` | PASS live **read-only** | Block/chain/native fee estimate; no signing/broadcast |

Machine-readable [results](../../evaluation/mvp-results.json) contain every browser outcome, all 25 MVP test names, exact denominators, final source SHA-256 hashes and deferred gates. CI is configured but no hosted CI run is claimed. Verified incremental commits: M0 `970e14b`, M1 `13fdb43`, M2 `3793083`, integrated M3–M5 software `f4d72b4`; this results entry is committed separately. Funded M6 and a real externally verified Arc anchor remain explicitly deferred, not passed.

## Chat workspace extension — server contract

Pulled owner README update `181881a` with a clean fast-forward. Added wallet-scoped multi-turn conversations, protected `agent.message.reported` events, typed `chat.respond`, immutable selected-item source references, recorded context and read-only capability status. Existing plan-reporting tokens can submit the structured content form; no signing or consent capability is added. The supplied local testing capability was checked against its active hashed journal record, and stored only in ignored owner-only `.env.local`. Its value is not in tracked sources or the browser bundle.

Actual server verification: **6/6** new chat/provenance tests and **32/32** tests across the seven MVP suites passed, including the new actual HTTP reply/context/isolation case. Existing actual API smoke **15/15**, CounterSign HTTP **6/6** and testnet boundary **9/9** passed. The larger Chat interface is verified in the subsequent UI/results increment; funded payment and real anchor deferrals are unchanged.
