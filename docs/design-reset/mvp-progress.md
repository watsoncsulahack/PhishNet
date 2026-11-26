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
