# PhishNet — Requirements

**Version:** 1.0-draft | **Date:** 2026-11-25 | **Baseline:** `watsoncsulahack/PhishNet`, `main` at `ab57d519` | **Status:** Proposed target requirements, not claims of implemented features.

## 1. User Requirements

Each statement describes an outcome the user needs, without prescribing the technical implementation. **Priority:** P0 = essential for the safe research MVP; P1 = next increment; P2 = later research/production exploration. **Modes:** Advisory means PhishNet explains an external payment but cannot stop it; Enforcement means the payment provider actually integrates its separate authorization gate.

| ID | Priority | User requirement |
|---|---|---|
| UR-01 | P0 | As a person supervising an AI financial agent, I can view a proposed payment's recipient, amount, currency, network, purpose and origin before deciding what to do. |
| UR-02 | P0 | As an investigator, I can replay a human–agent–agent interaction in chronological order, with a clear distinction between actual observed events and demonstration data. |
| UR-03 | P0 | As an investigator, I can see a navigable graph connecting messages, claims, supporting evidence and proposed financial actions. |
| UR-04 | P0 | As an investigator, I can inspect the original source and context of each displayed assertion rather than relying solely on an AI-generated summary. |
| UR-05 | P0 | As an investigator, I can distinguish repetition of one source from corroboration by independent verified sources, including an explicit 'unknown' state when lineage cannot be established. |
| UR-06 | P0 | As a user, I can identify how a recipient, amount or purpose changed between my original authorization and the agent's proposal. |
| UR-07 | P0 | As a user, I can inspect explainable indicators of urgency, impersonated authority, instruction laundering, and payment-detail substitution, together with the evidence behind each indicator. |
| UR-08 | P0 | As a user, I can tell the difference between a suspicious pattern, an unverified claim, and a confirmed authorization violation; the interface does not label uncertainty as proven fraud. |
| UR-09 | P0 | As a developer, I can submit a proposed payment to a deterministic preflight check and receive ALLOW, HOLD or DENY with machine-readable reasons. |
| UR-10 | P0 | As a person delegating spending authority, I can define permitted recipient(s), asset, chain, maximum amount per transaction, cumulative budget, validity period and permitted purpose. |
| UR-11 | P0 | As a payment owner, I can be confident that advisory AI output cannot itself grant or extend spending permissions. |
| UR-12 | P0 | As a user, I can see whether a payment was proposed, denied, awaiting approval, simulated, broadcast, confirmed or failed; I am never shown a fabricated transaction as settled. |
| UR-13 | P0 | As a researcher, I can compare a malicious recipient-substitution scenario against a genuine independently approved recipient update. |
| UR-14 | P0 | As a researcher, I can replay authorized micropayment, budget exhaustion, and duplicate-payment scenarios without real funds. |
| UR-15 | P0 | As a mobile user, I can operate the inspector, transaction comparison and demo controls in a small-screen browser. |
| UR-16 | P0 | As a privacy-conscious user, I can use seeded demonstrations without connecting a real bank account, mainnet wallet or private conversation history. |
| UR-17 | P1 | As a human authorizer, I can approve the exact canonical transaction out of the agent's control, and inspect evidence that the approval is genuine and still valid. |
| UR-18 | P1 | As a reviewer, I can require independent verification of a new payee rather than accepting a message claiming that verification occurred. |
| UR-19 | P1 | As an auditor, I can verify that a displayed event belongs to a previously committed history and identify any limitations of that proof. |
| UR-20 | P1 | As a developer, I can integrate an authenticated enforcement endpoint without giving an AI agent access to payment-signing keys. |
| UR-21 | P1 | As a researcher, I can compare rule-only, final-message, full-transcript and provenance-aware approaches on the same held-out evaluation set. |
| UR-22 | P1 | As a researcher, I can export redacted case evidence, provenance links, policy decisions and test results for reproducible analysis. |
| UR-23 | P1 | As a user, I can examine real testnet payment receipts only when an actual transaction has been independently verified on-chain. |
| UR-24 | P2 | As an organization, I can review aggregate patterns across consented sessions without exposing customers' raw messages or identities to unauthorized viewers. |
| UR-25 | P2 | As a model-governance reviewer, I can trace PhishNet analyses to the model/rule version, evaluation evidence and approval history used to produce them. |
| UR-26 | P2 | As an institutional user, I can integrate case review with existing incident-response and payment-provider workflows under documented permissions. |

## 2. System Requirements

Each requirement is verifiable. **P0 deliverable:** a safe local, fixture-based provenance explorer and deterministic *simulation* of payment authorization. **P1:** genuine independently authenticated execution controls and optional verified testnet integration. **P2:** institutional integrations and research extensions. No requirement authorizes mainnet custody or production financial services in the initial release.

| ID | Priority | System requirement / acceptance condition |
|---|---|---|
| SR-001 | P0 | The system SHALL expose an explicit `SIMULATION` environment and SHALL label every simulated balance, funding event, payment receipt and transaction hash as simulated. |
| SR-002 | P0 | The system SHALL NOT claim blockchain settlement, create explorer links for fabricated hashes, or return `SETTLED` without verified network confirmation. |
| SR-003 | P0 | The demo API SHALL bind to loopback by default; nonlocal access SHALL require an explicit configuration choice and shall not enable financial execution. |
| SR-004 | P0 | The system SHALL use one canonical domain schema and one shared policy evaluation implementation across the server and automated tests, eliminating replicated production policy code. |
| SR-005 | P0 | The system SHALL validate input schemas and reject unexpected fields, malformed IDs, invalid address formats, invalid timestamps, invalid amounts, and oversized payloads before processing. |
| SR-006 | P0 | All amounts and budgets SHALL be represented as nonnegative integer base units; transaction amounts SHALL be strictly positive and within a configured maximum. |
| SR-007 | P0 | The system SHALL preserve session, actor, event, event-parent, claim, claim-occurrence, evidence and claim-evidence references with referential integrity. |
| SR-008 | P0 | The system SHALL retain the source channel and observed trust state per event; observed provenance and inferred dependency SHALL be separately labeled. |
| SR-009 | P0 | The system SHALL reject or quarantine event-parent cycles, missing references, incompatible sessions and duplicate event IDs with conflicting content. |
| SR-010 | P0 | A claim repeated across events SHALL retain a shared claim identity or explicit equivalence evidence; exact text or recipient string matching alone SHALL NOT establish causal dependence. |
| SR-011 | P0 | Evidence classified `independently_verified` SHALL require a recorded verification method and verified verifier identity; an LLM assertion of verification SHALL NOT meet this requirement. |
| SR-012 | P0 | The system SHALL render an interactive timeline and source/provenance graph whose nodes can reveal the original source text, actor, timestamp, source trust, and claim/evidence relationships. |
| SR-013 | P0 | The graph SHALL visually distinguish `observed`, `inferred`, `unverified`, and `unknown` relations and SHALL NOT present inferred edges as proven causal history. |
| SR-014 | P0 | The system SHALL compute differences between a stored mandate and a payment proposal for recipient, asset, chain, amount, purpose and validity window. |
| SR-015 | P0 | The risk analyzer SHALL produce structured findings containing indicator type, source event references, explanation, method/version and uncertainty. |
| SR-016 | P0 | The risk analyzer SHALL be advisory; neither model output nor a risk label SHALL be accepted as a human approval, independently verified recipient change or execution authorization. |
| SR-017 | P0 | The system SHALL include a deterministic, independently testable policy evaluator returning `ALLOW`, `HOLD` or `DENY` plus reason codes and the policy version. |
| SR-018 | P0 | The policy evaluator SHALL check chain ID, exact asset identity, exact canonical recipient, per-payment limit, cumulative spend, signed-authority status where applicable, mandate expiry, positive amount, purpose, and replay identifier. |
| SR-019 | P0 | The system SHALL DENY a mismatched recipient unless a separately authenticated updated mandate permits that recipient; a Boolean 'independently verified' claim alone SHALL be insufficient. |
| SR-020 | P0 | High-risk and new-recipient proposals SHALL enter `HOLD` unless a valid transaction-bound approval exists; the amount threshold SHALL be configurable and clearly identified as product policy rather than an industry norm. |
| SR-021 | P0 | Any incomplete, invalid or unverifiable financial authorization SHALL fail closed in enforcement mode; advisory mode SHALL clearly say that external transfers cannot be blocked. |
| SR-022 | P0 | The simulation SHALL prevent overspending the available simulated balance and SHALL atomically update the simulated mandate budget and consumed replay identifier when a simulated payment is accepted. |
| SR-023 | P0 | The system SHALL persist events, mandates, proposals, decisions, simulated payments and consumed replay identifiers in a transactional local database; a process restart SHALL NOT reset prior spend or replay state. |
| SR-024 | P0 | The application SHALL escape or safely render all untrusted event/claim content and SHALL NOT interpolate it into unsanitized HTML. |
| SR-025 | P0 | The application SHALL not execute instructions found within email, webpage, retrieved document, tool output or agent conversation as application commands. |
| SR-026 | P0 | The demonstration SHALL include at minimum: unauthorized vendor-address substitution, verified legitimate change, authorized micropayment, exhausted budget, duplicate nonce, expired mandate, and malicious prompt claiming override authority. |
| SR-027 | P0 | Automated tests SHALL execute the real policy, provenance and API implementations against independent expected results; expected labels SHALL never be reused as actual predictions. |
| SR-028 | P0 | Test reports SHALL calculate pass rate, unauthorized execution rate, false-block rate and case counts from executed tests and SHALL disclose synthetic-only data and statistical limitations. |
| SR-029 | P0 | The repository SHALL include repeatable setup commands, fixtures, a locally runnable demo, a test command and an explanation of implemented versus planned capabilities. |
| SR-030 | P0 | The mobile browser UI SHALL support the documented test flows on a narrow viewport without requiring desktop-only interaction. |
| SR-031 | P1 | The system SHALL authenticate each human, service and integration identity before accepting protected financial or audit operations and SHALL enforce tenant/resource ownership for each request. |
| SR-032 | P1 | The system SHALL verify human approvals cryptographically using independent public-key credentials or passkeys; approval records SHALL bind a canonical transaction digest, authorizer, mandate, expiry and one-time challenge. |
| SR-033 | P1 | The system SHALL separately verify mandate issuer identity, signature, permitted delegation scope and revocation/expiry before producing an executable `ALLOW`. |
| SR-034 | P1 | The signing service SHALL be logically and credential-isolated from the risk analyzer and agent tools; no alternative endpoint SHALL allow payment execution without equivalent checks. |
| SR-035 | P1 | The execution service SHALL atomically reserve budget, mark one-time identifiers as used, re-validate the exact signed payload and complete or reconcile execution without a check-to-use gap. |
| SR-036 | P1 | Testnet execution SHALL use the chain's real signing/broadcast mechanism and verify final receipt status and transaction fields from a network source before assigning `CONFIRMED`. |
| SR-037 | P1 | The system SHALL implement the actual selected AP2/x402 specification version when claiming protocol compatibility; otherwise the UI/docs SHALL say `protocol-inspired simulation`. |
| SR-038 | P1 | The audit subsystem SHALL implement tested canonical event digests, append-only commitments, signed checkpoints, verifiable inclusion proofs and independently stored checkpoints; any RFC 9162 claim SHALL match the standard algorithm. |
| SR-039 | P1 | Raw conversations, personal identifiers, secrets and wallet private keys SHALL NOT be written to public-chain transactions or shared/public logs. |
| SR-040 | P1 | A model-based extractor MAY be used to identify claim candidates, but every cited event ID SHALL exist, outputs SHALL pass strict validation, and the model SHALL have no shell, wallet-signing or policy-writing permissions. |
| SR-041 | P1 | The system SHALL retain analysis model/rule version and relevant evidence references so findings can be reconstructed or challenged. |
| SR-042 | P1 | The evaluation harness SHALL compare policy-only, final-message, complete-transcript and provenance-aware approaches on case-family-disjoint holdouts with documented counts, errors, latency and confidence limits. |
| SR-043 | P1 | The system SHALL support privacy-preserving, user-controlled redaction and export of investigation cases with original event IDs and provenance metadata. |
| SR-044 | P1 | The application SHALL enforce rate limits, resource bounds, security headers, server-side session controls, and an explicit origin policy on any remotely accessible build. |
| SR-045 | P1 | The team SHALL define and verify security test cases for injected instructions, spoofed approval evidence, recipient changes, expired mandates, replay across restarts, concurrent budget spending and missing audit events. |
| SR-046 | P2 | The system MAY support an institution-controlled integration connector under scoped credentials, with documented approval and rollback flows. |
| SR-047 | P2 | The system MAY correlate consented cases across sessions using privacy-preserving pseudonymous identifiers and a retention/deletion policy. |
| SR-048 | P2 | The system MAY anchor signed audit checkpoints to a public blockchain without publishing raw customer content. |
| SR-049 | P2 | The system MAY maintain dataset, model, test and approval lineage for the analyzer itself, distinct from the transaction provenance graph. |
| SR-050 | P2 | Before production financial use, the service SHALL undergo a separate operational security, privacy, legal/regulatory and third-party integration review. |
