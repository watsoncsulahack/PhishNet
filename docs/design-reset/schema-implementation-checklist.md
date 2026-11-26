# PhishNet — Physical-Schema Implementation Checklist

The concise ERDs show **14 core entities**. They are for communication and design review; they do not replace physical database specifications.

## Minimum migration work

- [ ] Identify organization/account/tenant ownership of every protected record.
- [ ] Define PKs, candidate keys, FK constraints, uniqueness, nullability, and cascades.
- [ ] Define normalized join tables for claim mentions, evidence, source dependencies and any multi-valued fields.
- [ ] Add separately identifiable public-key credentials and verification history.
- [ ] Define multiple authorized recipients and approval signers as child rows where permitted.
- [ ] Define policy decisions with **multiple structured reason codes** in `DECISION_REASON`.
- [ ] Implement `CONSUMED_NONCE` and `BUDGET_RESERVATION`/payment accounting in transactions; add idempotency constraints.
- [ ] Define `AUDIT_CHECKPOINT` and `AUDIT_LEAF` separate from untrusted event content, with independently verifiable root commitments.
- [ ] Define source/reference authenticity, observed versus inferred lineage, and a method/version for findings.
- [ ] Never store raw secret keys, full sensitive messages on-chain, or client-supplied 'approved' booleans as evidence.
- [ ] Add SQL migration and rollback tests; verify restart persistence and concurrent spend invariants.
- [ ] Document `1NF → 2NF → 3NF` decomposition using actual functional dependencies if claiming academic normal form compliance.

## Example constraints

- `PAYMENT_PROPOSAL.amount_base_units > 0`, and amounts are integer base units.
- `EVENT_DEPENDENCY.source_event_id <> target_event_id`; reject longer cycles in application or database logic.
- Every child source event belongs to the authorized tenant/session (or explicitly trusted cross-session import).
- A complete payment approval binds proposal digest, chain, asset, recipient, amount, expiry and scope.
- A confirmed payment refers to a real, independently verifiable network transaction receipt; simulated receipts have no explorer URLs.

## Suggested data dictionary organization

`identity` (actor, credential, tenant), `interaction` (session, event, dependency), `evidence` (claim, mention, source, finding), `authorization` (mandate, recipient, approval), `payments` (proposal, policy, budget, nonce, execution), `audit` (checkpoint, membership, external anchor). Add detail only when tests demand it.
