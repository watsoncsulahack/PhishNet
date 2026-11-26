# PhishNet — Diagrams (live Mermaid previews)

These diagrams are **progressively detailed design views** rather than three proofs of relational normalization. See [normalization.md](normalization.md). GitHub renders them automatically; editable source files are [dfd-level-0.mmd](dfd-level-0.mmd), [erd-1nf.mmd](erd-1nf.mmd), [erd-2nf.mmd](erd-2nf.mmd), [erd-3nf.mmd](erd-3nf.mmd).

## Level 0 DFD: PhishNet as one system process

```mermaid
%% PhishNet Level 0 Data Flow Diagram (context diagram)
%% PhishNet is represented as ONE process; stores and internal sub-processes are Level 1 concerns.
flowchart LR
  U["Human user / authorizer"]
  A["Financial AI agent / developer client"]
  X["External content and evidence sources"]
  V["Independent identity / verification provider"]
  P["Payment rail / testnet facilitator"]
  R["Auditor / security investigator"]
  S(("0: PhishNet Investigation and Payment Authorization System"))
  U -->|"Decisions, signed mandates, consent, case requests"| S
  S -->|"Payment comparison, warnings, evidence graph, approval challenge"| U
  A -->|"Payment proposals and interaction events"| S
  S -->|"Preflight ALLOW / HOLD / DENY, reasons, receipts"| A
  X -->|"Referenced messages, documents, tool responses"| S
  S -->|"Authorized source retrieval / verification requests"| X
  S -->|"Identity, signature, recipient verification requests"| V
  V -->|"Authenticated verification results"| S
  S -->|"Authorized transaction only (future P1 testnet)"| P
  P -->|"Confirmed transaction receipt / status"| S
  R -->|"Investigation and audit-proof requests"| S
  S -->|"Redacted evidence, lineage, decisions, audit results"| R
  classDef system fill:#10304d,color:#ffffff,stroke:#2e9b93,stroke-width:3px;
  classDef external fill:#f1f5f9,color:#0f172a,stroke:#94a3b8;
  class S system;
  class U,A,X,V,P,R external;
```

## 1NF view: entities and crow's-foot relationships only

```mermaid
%% PHISHNET 1NF VIEW: ENTITY/RELATIONSHIP CONCEPT MAP (USER-REQUESTED PRESENTATION LAYER)
%% No attributes or keys. This is NOT a formal proof of first normal form.
%% Crow's foot: || = exactly one; o{ = zero or more.
erDiagram
    ACTOR ||--o{ SESSION : owns
    ACTOR ||--o{ EVENT : produces
    SESSION ||--o{ EVENT : contains
    EVENT ||--o{ EVENT_DEPENDENCY : source_for
    EVENT ||--o{ EVENT_DEPENDENCY : references
    SESSION ||--o{ CLAIM : contains
    CLAIM ||--o{ CLAIM_MENTION : is_mentioned
    EVENT ||--o{ CLAIM_MENTION : mentions
    EVENT ||--o{ EVIDENCE : supplies
    CLAIM ||--o{ CLAIM_EVIDENCE : supported_by
    EVIDENCE ||--o{ CLAIM_EVIDENCE : linked_to
    SESSION ||--o{ FINDING : assessed_in
    ACTOR ||--o{ MANDATE : authorizes
    SESSION ||--o{ PROPOSAL : contains
    MANDATE ||--o{ PROPOSAL : governs
    ACTOR ||--o{ APPROVAL : signs
    PROPOSAL ||--o{ APPROVAL : requires
    PROPOSAL ||--o{ POLICY_DECISION : evaluated_by
    PROPOSAL ||--o{ EXECUTION : executed_as
    POLICY_DECISION ||--o{ EXECUTION : permits
```

## 2NF view: identifiers, PKs and FK references

```mermaid
%% PHISHNET 2NF VIEW: ENTITY KEYS AND FOREIGN-KEY REFERENCES (PRESENTATION LAYER)
%% 'id' and 'ref' denote identifier/reference, NOT physical SQL datatypes.
%% This is NOT a formal second-normal-form proof.
erDiagram
    ACTOR {
        id actor_id PK
    }
    SESSION {
        id session_id PK
        ref owner_actor_id FK
    }
    EVENT {
        id event_id PK
        ref session_id FK
        ref actor_id FK
    }
    EVENT_DEPENDENCY {
        id dependency_id PK
        ref source_event_id FK
        ref target_event_id FK
    }
    CLAIM {
        id claim_id PK
        ref session_id FK
    }
    CLAIM_MENTION {
        id mention_id PK
        ref claim_id FK
        ref event_id FK
    }
    EVIDENCE {
        id evidence_id PK
        ref event_id FK
    }
    CLAIM_EVIDENCE {
        id claim_id PK,FK
        id evidence_id PK,FK
    }
    FINDING {
        id finding_id PK
        ref session_id FK
    }
    MANDATE {
        id mandate_id PK
        ref authorizer_actor_id FK
    }
    PROPOSAL {
        id proposal_id PK
        ref session_id FK
        ref mandate_id FK
    }
    APPROVAL {
        id approval_id PK
        ref proposal_id FK
        ref approver_actor_id FK
    }
    POLICY_DECISION {
        id decision_id PK
        ref proposal_id FK
    }
    EXECUTION {
        id execution_id PK
        ref proposal_id FK
        ref decision_id FK
    }
    ACTOR ||--o{ SESSION : owns
    ACTOR ||--o{ EVENT : produces
    SESSION ||--o{ EVENT : contains
    EVENT ||--o{ EVENT_DEPENDENCY : source_for
    EVENT ||--o{ EVENT_DEPENDENCY : references
    SESSION ||--o{ CLAIM : contains
    CLAIM ||--o{ CLAIM_MENTION : is_mentioned
    EVENT ||--o{ CLAIM_MENTION : mentions
    EVENT ||--o{ EVIDENCE : supplies
    CLAIM ||--o{ CLAIM_EVIDENCE : supported_by
    EVIDENCE ||--o{ CLAIM_EVIDENCE : linked_to
    SESSION ||--o{ FINDING : assessed_in
    ACTOR ||--o{ MANDATE : authorizes
    SESSION ||--o{ PROPOSAL : contains
    MANDATE ||--o{ PROPOSAL : governs
    ACTOR ||--o{ APPROVAL : signs
    PROPOSAL ||--o{ APPROVAL : requires
    PROPOSAL ||--o{ POLICY_DECISION : evaluated_by
    PROPOSAL ||--o{ EXECUTION : executed_as
    POLICY_DECISION ||--o{ EXECUTION : permits
```

## 3NF view: attributes and illustrative datatypes

```mermaid
%% PHISHNET 3NF VIEW: TYPED LOGICAL-SCHEMA DESIGN (PRESENTATION LAYER)
%% Datatypes are illustrative; 3NF depends on functional dependencies, NOT type declarations.
%% Physical SQL requires documented extensions and separate migration validation.
erDiagram
    ACTOR {
        uuid actor_id PK
        string kind
        string display_name
        string identity_status
    }
    SESSION {
        uuid session_id PK
        uuid owner_actor_id FK
        string title
        string environment
        datetime created_at
    }
    EVENT {
        uuid event_id PK
        uuid session_id FK
        uuid actor_id FK
        string channel
        string trust_state
        text content_text
        datetime occurred_at
    }
    EVENT_DEPENDENCY {
        uuid dependency_id PK
        uuid source_event_id FK
        uuid target_event_id FK
        string basis
        string verification_state
    }
    CLAIM {
        uuid claim_id PK
        uuid session_id FK
        text statement
        string assessment
    }
    CLAIM_MENTION {
        uuid mention_id PK
        uuid claim_id FK
        uuid event_id FK
        text quoted_span
    }
    EVIDENCE {
        uuid evidence_id PK
        uuid event_id FK
        string kind
        string verification_state
        string content_digest
    }
    CLAIM_EVIDENCE {
        uuid claim_id PK,FK
        uuid evidence_id PK,FK
        string relation_type
    }
    FINDING {
        uuid finding_id PK
        uuid session_id FK
        string indicator_type
        string analyzer_version
        string assessment
    }
    MANDATE {
        uuid mandate_id PK
        uuid authorizer_actor_id FK
        string recipient_address
        string chain_id
        string asset_id
        bigint per_payment_limit
        bigint cumulative_budget
        datetime valid_until
        string signature_reference
    }
    PROPOSAL {
        uuid proposal_id PK
        uuid session_id FK
        uuid mandate_id FK
        string recipient_address
        bigint amount_base_units
        string nonce
        datetime created_at
    }
    APPROVAL {
        uuid approval_id PK
        uuid proposal_id FK
        uuid approver_actor_id FK
        string transaction_digest
        string signature_reference
        datetime expires_at
    }
    POLICY_DECISION {
        uuid decision_id PK
        uuid proposal_id FK
        string result
        string policy_version
        string primary_reason_code
    }
    EXECUTION {
        uuid execution_id PK
        uuid proposal_id FK
        uuid decision_id FK
        string mode
        string status
        string transaction_hash
    }
    ACTOR ||--o{ SESSION : owns
    ACTOR ||--o{ EVENT : produces
    SESSION ||--o{ EVENT : contains
    EVENT ||--o{ EVENT_DEPENDENCY : source_for
    EVENT ||--o{ EVENT_DEPENDENCY : references
    SESSION ||--o{ CLAIM : contains
    CLAIM ||--o{ CLAIM_MENTION : is_mentioned
    EVENT ||--o{ CLAIM_MENTION : mentions
    EVENT ||--o{ EVIDENCE : supplies
    CLAIM ||--o{ CLAIM_EVIDENCE : supported_by
    EVIDENCE ||--o{ CLAIM_EVIDENCE : linked_to
    SESSION ||--o{ FINDING : assessed_in
    ACTOR ||--o{ MANDATE : authorizes
    SESSION ||--o{ PROPOSAL : contains
    MANDATE ||--o{ PROPOSAL : governs
    ACTOR ||--o{ APPROVAL : signs
    PROPOSAL ||--o{ APPROVAL : requires
    PROPOSAL ||--o{ POLICY_DECISION : evaluated_by
    PROPOSAL ||--o{ EXECUTION : executed_as
    POLICY_DECISION ||--o{ EXECUTION : permits
```
