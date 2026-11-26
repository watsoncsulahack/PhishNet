# PhishNet MVP Scope — Wallet, Agent Proposal, Human Authorization and Auditable Graph

> **Later owner instruction:** add a dedicated **Chat** tab, giving Wallet / Activity / Chat / Graph / Settings, plus an expanded conversation and generic item-comparison interface. See [the approved extension and implementation contract](chat-workspace.md). The original four-tab sketch references below remain historical design provenance. Merchant fulfillment, autonomous signing and the other security exclusions remain unchanged.

**Status:** Approved design scope for the next implementation increment; **not** a claim that all features exist.  
**Source:** Product-owner instructions and two hand-drawn PWA wallet concepts (November 26, 2026).  
**Repository baseline inspected:** main commit 6f0a80b7fb0ff49bb0e0be1727f8dc0bc28160bd.  
**Primary goal:** An agent proposes a generic Arc Testnet payment, a human verifies the exact action, the external wallet sends it, and the resulting transaction plus observable decision history can be independently inspected.

## 1. Product boundaries

**PhishNet is an underlying provenance/verification engine and a simple PWA wallet interface.** The chat input is labeled **Chat**, not “Ask PhishNet.” The wallet works without any AI model connected.

**In the MVP**
- Responsive, installable PWA; home shows selected wallet/account, balance, **Send**, **Receive**, a simple generic **Chat** field, and bottom navigation (**Wallet**, **Activity**, **Graph**, **Settings**).
- Existing Arc Testnet (chain 5042002) native USDC direct-wallet transfer, with accurate **18 base-unit decimals** and at most six user-entered fractional digits in the existing flow; keep the app's current testnet-only limit until explicitly changed.
- Read-only wallet data and a **bring-your-own local AI agent** connector. The agent may access typed, permissioned read-only tools and **prepare unsigned payment proposals**, but not call unrestricted signing APIs.
- Existing **CounterSign 0.2 keyed** human-consent flow integrated into agent-prepared payments. A genuine separately controlled human credential verifies the exact payment; the external connected wallet retains final transaction approval. Reject and expiry fail closed.
- Shared, versioned event journal used by Wallet Activity, the graph, and audit export. Real wallet records are displayed in the graph; synthetic demo cases are separately marked and cannot contaminate live wallet activity.
- A **two-layer knowledge graph**: **Transaction Flow** (wallets, transfers, assets, amounts, on-chain receipts) and **Decision History** (instructions, source evidence, tool requests/results, proposals, policy checks, human authorization). Each layer may be displayed alone, **both simultaneously**, or neither. Layer visibility does not change underlying data.
- On-chain **Arc Testnet audit commitments** of minimal event/checkpoint hashes only, plus an independent proof-verification method. Full conversation text, personal data, sensitive notes, credentials and private source documents stay off-chain.
- Explicit receipt status: PROPOSED, PENDING_APPROVAL, REJECTED, EXPIRED, WALLET_REJECTED, BROADCAST, CONFIRMED, FAILED, UNVERIFIED or analogous structured statuses. An RPC/network issue is **not** a reason to resend automatically.

**Explicitly outside the MVP**
- The separate simulated bookstore or any other merchant's catalog, order system, shipping or fulfillment. A future merchant may integrate using generic interfaces, but no merchant-specific entity is a PhishNet core prerequisite.
- ERC-8004 registration/reputation/validation, browser extension, custom or integrated hardware wallet, autonomous spending/agent-held funds, mainnet or real-value funds, full AP2/x402 implementations, multi-agent marketplace, paid SaaS/user billing, agent training, risk/reputation scores and custom blockchain/token.
- A built-in proprietary AI model or mandatory cloud inference provider. The local agent is separately managed and may be unavailable while wallet features remain usable.
- Publishing chat transcripts or personally identifying data to Arc.

## 2. User-facing views (from the sketches)

**Reference 1**: [Wallet, send/receive and plain Chat (vector-traced hand drawing)](concept-ui/wallet-chat-sketch.svg).
**Reference 2**: The second original screenshot from the conversation adds a bottom separator/navigation row. Its original bytes were not available in this workspace; its layout is explicitly transcribed in [concept-ui/README.md](concept-ui/README.md). Do not present a redraw as the original.

**Wallet home**
- Large balance at top; two prominent equal-weight buttons: Send and Receive.
- One unobtrusive, single-line Chat input with microphone icon as an affordance. If voice input is not genuinely implemented, hide/disable the mic and label that limitation; do not render an inert button as functional.
- Bottom navigation: Wallet, Activity, Graph, Settings. Consistent mobile-first display; broader desktop detail layout.
- “PhishNet” can identify the application, but **does not** prefix the chat box or become the assistant persona.
- “Receive” shows selected account, network, full copyable address and optionally QR; distinguish address presentation from full incoming-payment history. If the chain/indexer does not support comprehensive incoming history, say the list is incomplete.

**Payment review**
- A draft created by the local agent opens the **same canonical payment review** as a manual send. Show exact full sender, recipient, asset, amount, chain and estimated fee; include tool/source reference and stated purpose (as an assertion, not proof).
- Any change to authorized terms invalidates quote/approval; obtain a new signature. No amount, payee, network, asset or call-data changes after signing.
- Human sees clear APPROVE/REJECT outcomes and knows which credential signed the CounterSign receipt versus which external wallet submitted the payment.

**Graph view**
- Default to selected wallet + date range, with a transaction/trace picker. Separate synthetic samples under a clearly labeled Demo filter.
- Filters/toggles for Transaction Flow and Decision History independently; both shown overlays shared evidence IDs, both hidden shows an honest empty state.
- Click a node/edge to open the **original event**, source, timestamp, wallet scope, verification method, confidence/uncertainty and any Arc proof.
- Never infer hidden LLM chain-of-thought. An agent-supplied plan or explanation is labeled **agent-reported**, not independently confirmed.
- An ordinary manual payment appears in Transaction Flow and only the decision/approval events actually recorded; no fictional agent nodes.
- A wallet payment imported from the chain is a **chain observation**, not automatically evidence of an in-app human or agent decision.

## 3. One canonical event contract (EventTraceV1)

The event journal is authoritative for **recorded** events, not necessarily their external truth or completeness. An event is validated, assigned an immutable ID and sequence, stored, and only then projected to timeline/activity/graph. The model's emitted JSON is input, **never** a trusted audit record.

Each event contains:
- version, eventId, traceId, sequence, eventType, observedAt UTC, recordedAt UTC, component identity (recorder), actor ID/type, origin (e.g. user UI, agent runtime, payment gateway, consent verifier, wallet provider, chain RPC);
- walletScope (chainId + canonical wallet address, when applicable); correlation IDs (proposalId, consentIntentId, txHash, toolCallId);
- causal parent event IDs with **observed-reference vs inferred-dependency** classification and evidence identifiers;
- payload constrained by an event-specific JSON Schema and privacy class; source/verification state assigned **only by the component that verified it**;
- canonical serialization profile, previous-event digest (for ordered integrity), event digest and recorder authentication or a clearly documented unsigned-local state.

**Suggested event types:** chat.user.submitted (content stored only in protected off-chain content store), agent.tool.requested, tool.result.observed, agent.plan.reported, payment.proposed, payment.validated, policy.evaluated, countersign.intent.created, countersign.resolution.verified, wallet.authorization.requested, wallet.submission.observed, chain.receipt.checked, audit.checkpoint.published, audit.checkpoint.verified.

**Stable objects:** Actor, Interaction/Source, Evidence/Claim, PaymentProposal, PolicyDecision, HumanAuthorization, WalletTransaction, VerificationResult, AuditCheckpoint, EventRelation. Relationships refer to IDs; don't rely on text matching to infer direct influence. Keep schema generic—no bookstore fields.

Example *proposal observation* (illustrative; trusted recorder computes integrity fields separately):

~~~json
{
  "schemaVersion": "phishnet.event.v1",
  "eventId": "evt-example-12",
  "traceId": "trace-example-01",
  "sequence": 12,
  "eventType": "payment.proposed",
  "recordedBy": "payment-gateway",
  "actor": { "type": "agent", "id": "local-agent" },
  "observedAt": "2026-11-26T18:00:00Z",
  "walletScope": { "chainId": 5042002, "address": "0x1111111111111111111111111111111111111111" },
  "links": { "proposalId": "proposal-example-01", "parentEventIds": ["evt-example-11"] },
  "payload": {
    "asset": "native-USDC",
    "decimals": 18,
    "amountBaseUnits": "20000000000000000",
    "recipient": "0x2222222222222222222222222222222222222222"
  },
  "verification": "UNVERIFIED_PROPOSAL"
}
~~~

The amount above is **0.02 USDC**, not a confirmed transfer. Use integer base units for all transaction-bound accounting; record token/network decimals, don't mix the earlier six-decimal simulation fixtures with Arc's 18-decimal native asset.

## 4. Trust and authorization boundary

1. The local agent can **propose** through a typed interface and query allowed read-only tools. It has no EVM signer or CounterSign human private key, and cannot edit, delete or reclassify authoritative events.
2. The trusted gateway validates the draft, captures it in the journal, produces a canonical transaction/intent digest and applies deterministic financial rules.
3. Human approval uses the current [official CounterSign keyed profile](notebook-and-consent.md). The authorized human examines the full transaction, signs the exact intent via a separately controlled credential, and the gateway verifies signatures, signer, scope, expiration, nonce/replay and **persistent one-time consumption**. No client approval Boolean is authoritative.
4. The external wallet separately asks the human to confirm the actual Arc Testnet transaction. The consent receipt is **not** a chain receipt or an EVM transaction signature.
5. The read-only network verifier checks exact transaction fields, canonical block receipt and success; settlement cannot be declared from a fabricated hash or agent claim.
6. If all components run in one compromised browser/device, they do **not** constitute independent financial-grade isolation. Document that boundary. A separate credential/recorder/witness is needed before claiming independent security.
7. Preserve the existing manual-send workflow if the agent runtime is unavailable; never silently elevate the agent into a signer.

## 5. Persistence and on-chain audit anchoring

**Off-chain:** a durable event table, relationships, raw-data references, proposal/approval state, transaction receipts, and verified checkpoints. Prefer a transactionally consistent local-service database (e.g. SQLite) for the backend; use IndexedDB only as client cache/offline UI data. Every write must have a recorded source and monotonic ordering. Persist CounterSign pending, approved, consumed, rejected and expired states across process restarts. Protect keys and sensitive evidence separately.

**Arc Testnet:** batch ordered event commitments into a documented Merkle root or hash-chain checkpoint. Publish **hash/root + minimal sequence metadata**, ideally using an appropriately permissioned small checkpoint contract or demonstrably verifiable transaction commitment. Use an audit publisher key separate from the payment/human keys. Verify against Arc using an independent reader. Checkpoint failures must be retriable and visible; unanchored history must not display as independently anchored.

**Security meaning:** an independently retrieved, finalized checkpoint can expose post-commit modifications, omissions relative to a known range and rollback/inconsistent histories. It **cannot** prove an agent did not suppress events before the gateway observed them, that the data was true, or that underlying private evidence remains available. PWA/one-host recording alone is not a trusted hardware recorder.

## 6. Implementation increments and exit gates

| Gate | Scope | Required observable result |
|---|---|---|
| M0 — Refactor boundaries | Draft EventTraceV1 schemas, recorder interface, tool permissions, transaction trace IDs, baseline regression suite | Current manually approved Arc wallet flow still works; explicit security boundary |
| M1 — Journal | Durable append-only records, real-wallet correlation, explicit evidence/verification provenance, migration of prior browser activity as *untrusted imports* | Restart/trace lookup; edited local data detectable **after** trusted commitment, not before |
| M2 — Human-gated agent proposal | Bring-your-own local-agent adapter, typed unsigned proposal, canonical review; CounterSign keyed receipt with durable one-time consumption | Agent cannot sign; changed terms/rejection/expiry/replay causes no wallet submission |
| M3 — Generic PWA UI | Wallet/Receive/Chat/Activity/Graph/Settings from sketches; safe local agent fallback; installability over secure origin | 320px and 390px mobile + desktop usability, keyboard/touch and honest mic capability |
| M4 — Graph integration | Two independent toggles, joint view, wallet scope, Cytoscape projections, typed evidence links, separate demos | Real transaction source→proposal→approval→receipt trace; no invented reasoning |
| M5 — Arc audit anchoring | Minimal commitments, signed/off-chain event export, independent verifier, proof inclusion and sequence checks | Verified checkpoint for test trace; local history alteration/rollback fails external verification |
| M6 — End-to-end validation | Controlled funded testnet payment requiring explicit human wallet approval; negative/adversarial and recovery tests | End-to-end actual receipts + audit proof + truthful report with failed/untested cases |

These are **gates**, not claims of completed work. A simulation-only run cannot satisfy the funded-payment gate.

## 7. Minimum acceptance tests

- **MVP-01** A local external agent asks for a transfer and receives no signing capability; only a **validated unsigned proposal** reaches review.
- **MVP-02** Human can review all exact terms; if changed after approval, CounterSign receipt and wallet review are invalidated.
- **MVP-03** Independent keyed CounterSign approval + user-confirmed external wallet signing is required in configured agent workflow; reject/default/expiry/foreign signer/replay fail closed across restart.
- **MVP-04** User cancellation or wallet rejection results in no broadcast and a recorded rejected/cancelled event.
- **MVP-05** Real Arc public RPC verification, not submitted hash alone, establishes confirmation and status; mismatched receipt never appears settled.
- **MVP-06** Graph links actual recorded payment and authorization events; manual payment has **no fabricated agent events**.
- **MVP-07** Transaction Flow only, Decision History only, both, and neither show appropriate states, preserving filters/selection and provenance.
- **MVP-08** Clicked nodes show exact source IDs, evidence type, privacy/redaction state and whether observed, asserted, inferred or independently verified.
- **MVP-09** Wallet switch cannot expose another account's private journal or falsely present incomplete imported on-chain data as a complete account history.
- **MVP-10** Independent audit verifier rejects modified committed events, omitted committed leaves, inconsistent sequence/rollback and foreign/signature-invalid checkpoints.
- **MVP-11** No personal data/chat content is written on Arc; anchored data contains minimal hashes/metadata only. Consent and source evidence are never automatically shared publicly.
- **MVP-12** App installs/works as a PWA on a supported secure origin; wallet features function if local model is offline. Chat/mic access is not falsely advertised.
- **MVP-13** Existing manual-payment, browser, CounterSign and synthetic-investigation tests remain passing; add real implementation integration tests with actual observed outputs and denominators.

## 8. Documentation and dependencies

Read [concept-ui/README.md](concept-ui/README.md), [requirements.md](requirements.md), [notebook-and-consent.md](notebook-and-consent.md), [testnet-payments.md](testnet-payments.md), [research-context.md](research-context.md), and [visualization-design-strategy.md](visualization-design-strategy.md) before refactoring. Reuse existing Arc payment and Cytoscape code; do not fabricate model inference, blockchain confirmations, or security metrics. Keep the bookstore entirely separate and outside PhishNet repository/implementation.
