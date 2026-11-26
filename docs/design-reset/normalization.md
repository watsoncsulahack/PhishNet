# PhishNet ERD Normalization: 1NF → 2NF → 3NF-oriented target

This is a **design progression**, not three competing production schemas. Read the editable diagrams in this order: [1NF](erd-1nf.mmd), [2NF](erd-2nf.mmd), [3NF-oriented](erd-3nf.mmd). The current application still uses memory-backed JSON, not these tables. Use the **3NF-oriented diagram** as the initial migration candidate only after checking its keys and functional dependencies.

## Definitions

- **1NF:** each column value is atomic for its domain, each row has a key, and repeating groups are represented by separate rows rather than arrays or comma-separated lists. **Partial and transitive dependencies are still allowed.**
- **2NF:** satisfies 1NF, and every non-prime attribute is fully functionally dependent on every candidate key, so no non-prime attribute depends only on part of a composite candidate key. **Transitive dependencies are still allowed.**
- **3NF:** satisfies 2NF and each nontrivial dependency \`X → A\` has a superkey on the left or a prime attribute on the right. The final drawing is **3NF-oriented**, not a proof of all candidate keys, FDs, or BCNF.
- It is normal for some tables shown in a 1NF diagram to also satisfy higher normal forms. Normal forms classify relations; their labels do not require every table to have a violation of the next form.
- **Key scope:** the instructional 1NF composite identifiers are scoped to the parent where appropriate (e.g. event ID within a session; approval ID within a proposal). The 2NF/3NF designs introduce globally unique surrogate IDs where indicated. Do not mistake a non-minimal superkey for a candidate key.

## 1NF: atomic but deliberately redundant

The [1NF ERD](erd-1nf.mmd) contains 10 wide tables with single-valued fields and explicit rows for links, evidence, recipients, decision reasons and audit memberships. Examples of **partial dependencies** requiring decomposition:

| 1NF table (composite key) | Partial dependency | Update anomaly |
|---|---|---|
| \`ACTIVITY_LOG_1NF(session_id,event_id)\` | \`session_id → session_title,session_owner_id\` | Session title repeated for every event. |
| \`EVENT_LINK_1NF(session_id,child_event_id,parent_event_id)\` | \`session_id → session_title\` | Session facts repeated for each link. |
| \`CLAIM_OCCURRENCE_1NF(session_id,claim_id,event_id,mention_index)\` | \`(session_id,claim_id) → claim_statement,claim_truth_state\` | Claim description repeated at each occurrence. |
| \`CLAIM_SUPPORT_1NF(claim_id,evidence_id)\` | \`claim_id → claim_statement\`; \`evidence_id → evidence_type,evidence_uri\` | Claim/evidence properties repeated across associations. |
| \`FINDING_SOURCE_1NF(finding_id,event_id)\` | \`finding_id → finding_type,assessment,explanation\` | Repeated finding descriptions. |
| \`MANDATE_PAYEE_1NF(mandate_id,recipient_address)\` | \`mandate_id → total_budget,valid_until,owner_principal_id\` | Each allowed recipient repeats all mandate attributes. |
| \`PROPOSAL_DECISION_REASON_1NF(proposal_id,decision_id,reason_code)\` | \`proposal_id → amount_base_units,proposed_recipient\`; \`decision_id → decision_result,policy_version\` | Proposal and decision metadata copied per reason. |
| \`AUDIT_MEMBERSHIP_1NF(checkpoint_id,event_id)\` | \`checkpoint_id → checkpoint_root,checkpoint_signature\`; \`event_id → event_digest\` | Checkpoint root repeated per included event. |

\`EXECUTION_RECORD_1NF\` uses a simple key and already satisfies 2NF; that is expected.

## 2NF: partial dependencies removed

The [2NF ERD](erd-2nf.mmd) decomposes the wide relations: \`MANDATE_PAYEE\` becomes \`MANDATE\` and \`MANDATE_RECIPIENT\`; \`CLAIM_SUPPORT\` becomes \`CLAIM\`, \`EVIDENCE\` and \`CLAIM_EVIDENCE\`; \`PROPOSAL_DECISION_REASON\` becomes \`PAYMENT_PROPOSAL\`, \`POLICY_DECISION\` and \`DECISION_REASON\`. Child facts depend on the full primary/candidate key of their respective table.

**Intentional transitive dependencies that remain legal under 2NF:**

- \`SESSION_2NF.session_id → owner_principal_id → owner_display_name\`
- \`EVENT_2NF.event_id → actor_principal_id → actor_display_name\`
- \`MANDATE_2NF.mandate_id → owner_principal_id → owner_display_name\`
- \`HUMAN_APPROVAL_2NF.approval_id → credential_id → signer_key_id\`
- \`POLICY_DECISION_2NF.decision_id → proposal_id → proposal_recipient_address\`

Do **not** implement those deliberate display-name/key/recipient copies as authoritative storage in production; they illustrate the remaining step.

## 3NF-oriented implementation target

The [3NF-oriented ERD](erd-3nf.mmd) is the previous diagram, correctly relabeled. It removes the intentional transitive copies: \`SESSION\`/ \`EVENT\`/ \`MANDATE\` link to \`PRINCIPAL\`; \`HUMAN_APPROVAL\` links to \`CREDENTIAL\`; \`POLICY_DECISION\` links to \`PAYMENT_PROPOSAL\`. Join tables model repeated relationships atomically. Consult [integrity notes](erd-3nf-notes.md) before writing SQL.

**Security caveat:** normalization does not prove event truth, complete provenance, signed human authorization, tamper-evident independent audit history, or safe settlement. Those require additional constraints and enforcement under [requirements.md](requirements.md).

## Guidance to implementation agent

1. Treat 1NF and 2NF as explanatory models, **never as the target database**.
2. Verify the 3NF diagram's candidate keys, dependencies, referential integrity, nullable fields, tenant boundaries, constraints and indexes before generating migrations.
3. Preserve only facts the platform can actually verify; distinguish source claims from authority and observed from inferred dependency edges.
4. Use integer payment units, durable replay state, atomic budget reservations, independent approval verification and simulated-only execution until P1 gates pass.
5. Create migration tests and cite relevant \`UR-*\` / \`SR-*\` IDs in changes.
