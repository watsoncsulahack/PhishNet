# PhishNet: 3NF-oriented ERD and Integrity Notes

**Canonical target:** \`erd-3nf.mmd\`, formerly mislabeled 1NF. This target is a proposed logical model, not the repository's current in-memory application state. See \`normalization.md\` for why the two earlier designs are intentionally less normalized.

## Key relationship tables

- \`EVENT_PARENT(child_event_id,parent_event_id)\`: one observed or inferred directed dependency per row; reject cycles, duplicates, and cross-session references.
- \`CLAIM_MENTION\`: records each source-span mention of a claim; identical strings alone are not proof of a shared source.
- \`CLAIM_EVIDENCE(claim_id,evidence_id)\`: one relation per supporting/refuting/uncertain piece of evidence, keeping source and provenance explicit.
- \`FINDING_EVENT(finding_id,event_id)\`: source events relevant to a risk finding.
- \`MANDATE_RECIPIENT(mandate_id,recipient_address)\`: one signed-authorized destination per row; new recipients require a valid newly authorized mandate.
- \`PROPOSAL_EVENT(proposal_id,event_id)\`: events cited by a payment proposal.
- \`DECISION_REASON(decision_id,reason_code)\`: independent rows for reasons instead of a JSON array.
- \`CONSUMED_NONCE(mandate_id,nonce)\`: unique and persistent consumed identifiers.
- \`AUDIT_LEAF(checkpoint_id,event_id)\`: membership and leaf order of independently committed event sets.

## Integrity and safety constraints

1. Enforce all foreign keys, primary keys and unique constraints, including credential keys, nonce per mandate, and leaf index per checkpoint.
2. Require positive integer payment amounts, valid timestamps, amount/budget bounds, and normalized exact chain, asset and recipient identifiers.
3. Never treat a display name, role claim, LLM assurance, or client-provided approval flag as independently authenticated authorization.
4. A signed approval must bind exact transaction digest, mandate, authorizer, challenge and expiry; verify credential status and key origin.
5. A recipient-verification record can establish evidence but **cannot alone amend** a signed mandate.
6. Payment execution must recheck the canonical payload, reserve or charge budget atomically, prevent replay across restarts and reconcile failure/retry.
7. A network receipt must be independently checked for correct chain, asset, recipient, amount, status and transaction identity before confirmation.
8. Hashes and Merkle paths prove inclusion relative to a known root only. Independent checkpoint witnesses/anchors are necessary against retrospective rewriting; even then completeness and truth are not guaranteed.
9. Implement tenant/resource access checks before any remotely accessible use; segregate credential storage from agent tools.
10. Do not place private conversation content, PII, credentials or signing secrets on public chains. Redaction and retention must be deliberate.
11. Model/rule versions and source citations must be stored for reproducible findings; the risk model has no power to approve or sign.
12. The target may need a separate payment ledger, idempotency keys, pending reservations, revocation support and audit/checkpoint witnesses. Formal candidate-key/FD review and migrations precede production use.

Legend: PK = primary key, FK = foreign key, UK = unique key. Merely satisfying 3NF is not a security certification.
