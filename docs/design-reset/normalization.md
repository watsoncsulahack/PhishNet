# PhishNet — Progressive ERD Views and Formal Normalization

## The three drawings requested for design review

The three files deliberately use a **progressive notation convention**:

| Diagram | What is shown | Goal |
|---|---|---|
| [1NF view](erd-1nf.mmd) | **Only entities and crow's-foot relationships** | See the business concepts, cardinality and system scope without technical clutter. |
| [2NF view](erd-2nf.mmd) | The same entities/relationships **plus identifying fields, primary keys and referencing foreign keys** | Make records and their relationships addressable. Labels `id` and `ref` are descriptive placeholders, not SQL datatypes. |
| [3NF view](erd-3nf.mmd) | The same core model **plus selected attributes and illustrative datatypes** | Provide a readable starting point for implementation schema design. |

**Technical caveat:** These are the user's *presentation-stage labels*, **not** the formal mathematical definitions of database normal forms. In relational theory, 1NF concerns atomic values; 2NF removes partial functional dependencies on candidate keys; 3NF constrains transitive dependencies (more precisely, every nontrivial FD has a superkey determinant or a prime RHS). Adding keys does not by itself achieve 2NF; adding datatypes does not achieve 3NF. An implementation agent must verify actual functional dependencies before declaring the SQL schema normalized.

The former repository versions of these files were extensive (10 wide 1NF tables, 23 entity 2NF/3NF models). They were too detailed for the conceptual design step. These **14 core entities** deliberately focus on the MVP; a later physical data dictionary and subsystem diagrams can extend them.

## Reading the crow's-foot relationships

`ACTOR ||--o{ EVENT` means each event has **one** recorded actor and an actor may produce **zero or more** events. The same notation describes session ownership, claims, source evidence, signed mandates, and policy outcomes.

Two appearances of `EVENT ||--o{ EVENT_DEPENDENCY` are intentional: `source_event_id` and `target_event_id` create a directed self-reference, allowing multiple origins and avoiding treating one repeated statement as independent evidence.

`CLAIM_MENTION` links a claim to each observed appearance in an event. `CLAIM_EVIDENCE` links claims to one or more supporting/refuting evidence records. These are relationship entities, not separate product features; leaving them out would conceal the many-to-many provenance problem.

## Definition and enforcement boundaries

- `ACTOR` includes human, agent or service. Display names and asserted roles are **not** authenticated authority.
- `EVENT` represents observed or imported material. A reference or hash does **not** guarantee the log is complete or the source honest.
- `EVENT_DEPENDENCY` records observed references or **explicitly inferred** influence; its verification state must distinguish them.
- `CLAIM` is an assertion, not a verified truth. Repeated mentions do not imply independent corroboration.
- `EVIDENCE` stores traceability and verification state; trust is established through independent processes outside the model.
- `FINDING` is an advisory observation, not a transaction authorization.
- `MANDATE` represents bounded human-delegated authority, requiring real signature verification before live use.
- `PROPOSAL` is a requested payment; it never directly creates an executable transfer.
- `APPROVAL` binds a signed exact transaction and independent human credential; a client-provided boolean is insufficient.
- `POLICY_DECISION` is the non-LLM allow/hold/deny outcome; it must not trust forged upstream approvals.
- `EXECUTION` distinguishes SIMULATED, BROADCAST, CONFIRMED and FAILED. Only a verified receipt can support CONFIRMED.

## Implementation extensions deliberately omitted from the overview drawings

A **production-oriented** schema will need additional tables beyond the simple drawings. Examples: `CREDENTIAL` (public key, key issuer, status), `MANDATE_RECIPIENT` for multiple authorized payees, `DECISION_REASON` for multiple reasons, `CONSUMED_NONCE` for durable replay protection, budget reservations/accounting, `AUDIT_CHECKPOINT` and `AUDIT_LEAF`, `FINDING_EVIDENCE`, model/rule-version lineage, account or organization ownership, and tenant-level access controls.

Do **not** implement lists of recipient addresses, evidence IDs, ancestor IDs, or reason codes as comma-delimited strings simply to keep the drawing compact. Do not use a single `primary_reason_code` as a substitute for the full set of machine-readable decision reasons.

The agent must maintain a separate [database implementation checklist](schema-implementation-checklist.md) and design normalized migrations from the requirements; diagram simplicity **never overrides** security or data-integrity requirements.

## Modeling decisions to validate before database migrations

1. Determine stable primary and candidate keys, uniqueness, and deletion behavior for all relationships.
2. Enforce event session consistency and cycle detection for dependency edges.
3. Model evidence and findings with source references and uncertainty.
4. Protect signing credentials, allow mandate revocation, and bind approval to the canonical transaction.
5. Use integer minor/base units, transaction-bound nonce/idempotency, and atomic budget debits/reservations.
6. Preserve append-only event integrity and independently witnessed audit commitments; do not place private conversation content on public chains.
7. Write migrations and real persistence tests for referential integrity, restart replay, concurrency and failure recovery.
