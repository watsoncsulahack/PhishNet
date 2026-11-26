# PhishNet: Research Context and Design Rationale

Date: November 25, 2026. Audience: human stakeholders and autonomous coding agents.

## 1. The problem and intended function

The product owner wants a financial/payments application that lets users VISUALIZE PATTERNS OF EXPLOITATION. PhishNet originated as a phishing-detection idea and evolved into a provenance-aware AI-agent financial security platform.

The principal questions are:
1. How did a particular claim enter a workflow?
2. Which humans or agents repeated, paraphrased, or changed it?
3. Did later claims gain apparent credibility merely through repetition?
4. What independent evidence supports the claim?
5. What payment action did it influence?
6. Who was actually authorized to approve and execute the payment?

**Research hypothesis, not established efficacy:** A provenance-aware investigation interface plus independent payment enforcement may improve the recognition and prevention of unsupported financial actions compared with analyzing only a suspicious message or URL. It must be tested against simple allowlist/budget controls and human reviewers, including legitimate counterexamples.

## 2. Four different trust questions

**Message authenticity** asks whether a certain account/key originated the data. It does not make the assertion true.
**Evidence validity** asks whether independent evidence supports the assertion. Two agents repeating one source are not two independent witnesses.
**Delegated authority** asks whether a signed, bounded human mandate permits this exact asset, chain, payee, amount, purpose, nonce and time window. Model output or a client approval Boolean cannot supply this authority.
**Execution/audit** asks whether a transaction really settled and whether independently witnessed records can later verify an event existed. A hash does not establish truth, completeness, or settlement.

## 3. Research findings and implementation consequences

### Trail of Bits — R01
Will Vandevanter, October 22, 2025, documents agent platforms where automatically approved CLI commands could be exploited through argument injection to execute actions without intended approval. **This is not a test of PhishNet itself.** Consequence: keep model/tool inputs untrusted, use sandboxed and narrow tool capabilities, and make all execution routes enforce policy independently. A model-based injection detector is not a security boundary.

### Independent human approval — R02, R03
I-HITL and Countersign Labs focus on human approval with cryptographic evidence outside agent control. Consequence: verify real signatures bound to canonical transaction terms, independently manage trusted signing credentials, and prohibit the agent from modifying the authorization environment. Biometric or signature confirmation does not by itself demonstrate informed human understanding.

### FICO blockchain model governance — R04, R05
FICO describes traceability for analytic tracking documents, model development assets, revisions and approvals, using a permissioned blockchain. EP3850557B1 has a reported 2018-09-11 priority date and European publication/grant dated 2026-02-25. Patent claim scope requires legal analysis. Consequence: distinguish transaction provenance from future governance of PhishNet's own model and rule versions. Blockchain need not be used where signed append-only logs provide the requisite verifiability.

### New York Fed bank-runs research — R06
Correia, Luck and Verner's July 2026 Staff Report 1198 uses LLMs to extract historical events, identifying 3,984 individual-bank runs from 1863 to 1934. The report analyzes fundamentals and consequences; **it is NOT evidence that AI agents caused those runs.** Future hypothesis: correlated agent responses to common untrustworthy information could merit study, but PhishNet currently has no systemic-risk model.

### NIST Phish Scale and Microsoft ClickFix — R07, R08
Context and work relevance influence human response to phishing. ClickFix documents malicious operations disguised as ordinary troubleshooting or CAPTCHA workflows. Consequence: track *context and sequences*, not simply keyword hits. An urgent message is not automatically fraudulent, and a polished, nonurgent message may still be deceptive.

### AgentDojo benchmark — R09
AgentDojo (NeurIPS 2024) includes 97 tasks and 629 security test cases involving agent tools and untrusted content. This is a research baseline, **not** measured performance for PhishNet. Consequence: evaluate actual unauthorized action outcomes, claim attribution, benign false blocks, and performance on held-out scenario families.

### Payment protocols — R10–R12
AP2, x402 and Circle Arc provide relevant mechanisms for delegated payment authorizations, pay-per-request interactions and testnet settlement. Protocol-inspired JSON or HTTP status codes do not establish protocol conformance. Testnet labels and fabricated transaction hashes are not confirmed payments.

## 4. Audit facts from initial PhishNet implementation

Reference: https://github.com/watsoncsulahack/PhishNet ; reviewed code baseline ab57d51915fb28e17c1c089b1df10578325237b6.

- The current main Node server keeps wallets, mandates, consumed nonces, transactions and events in memory.
- AP2-style mandates are constructed as JSON without verified authorizer signatures.
- Payments are simulated with local accounting and fabricated transaction-like hashes; the nominal live Arc adapter also creates a fake settled receipt rather than broadcasting and verifying a transaction.
- The API accepts client-submitted humanApproved flags, which are not independent authorization.
- Named Gemini/Antigravity inference is implemented as deterministic keyword and recipient-repetition heuristics.
- Claim lineage based on matching addresses may infer causal chains without sufficient evidence.
- Merkle hashing is custom, does not establish complete audit history and should not be called RFC 9162-compliant without conforming implementation.
- Tests replicate policy logic; some regression cases copy expected labels directly into the actual outcome, and some headline metrics are hard-coded.

These are **gaps to correct**, not established exploit successes.

## 5. Product cases and counterfactuals

**Vendor substitution:** Authorized recipient A; untrusted source claims recipient B; multiple agents repeat this claim; final payment to B is denied. Show the exact sequence and where confidence grew without new evidence.

**Legitimate vendor update:** A verified recipient change plus a NEW valid mandate explicitly permits B. Show why this is allowed instead of equating all recipient changes with fraud.

**Micropayment:** An agent makes a $0.02 API request within budget; later a duplicate or surcharge is blocked. Measure the cumulative amount and nonce.

**Injected authority:** A message asks the agent to disregard restrictions. The advisory UI can highlight the attempt, but no model text changes execution permission.

**Audit:** Tampering with previously committed evidence must be detected against an independent trusted checkpoint, not through a cosmetic UI badge.

## 6. Decisions and open questions

| Decision | Reason |
|---|---|
| Investigation + independent payment authorization | The harmful action is the endpoint of an information chain, not just a suspicious URL. |
| Simulation-first | Existing settlement/approval mechanisms are incomplete and must not put funds at risk. |
| Risk model advisory only | Prompt injection and evidence hallucinations cannot become authorization. |
| Source provenance distinct from verification | Correlation/repetition is not independent corroboration. |
| Lightweight ERDs, detailed schema checklist | Entity communication should be readable while security constraints remain explicit. |
| Test real implementations | Green self-referential tests give false reassurance. |

Unanswered: Does provenance improve decisions beyond allowlists? Can reviewers interpret uncertainty? What dataset supports valid claim influence edges? Who would adopt and pay? When does a distributed ledger outperform externally signed checkpoints? How do real privacy, regulatory and patent concerns affect deployment? These require studies and customer discovery; do not invent results.

## 7. Coding-agent reading order

Read requirements.md, this research-context.md, research-references.md, diagrams.md, normalization.md, schema-implementation-checklist.md, testing.md and implementation-plan.md before making architectural changes. The simplified 1NF/2NF/3NF diagrams are **presentation stages**, not mathematically proven normal forms or complete migration specifications.
