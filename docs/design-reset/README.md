# PhishNet Design Reset — Agent Handoff

**Status:** Proposed architecture. The code still requires security and functionality work. Initial audit baseline: ab57d519.

## Required reading order

1. [research-context.md](research-context.md) — history, research findings, product motivation, and architectural decisions.
2. [research-references.md](research-references.md) — primary citations and caveats.
3. [uploaded-source-notes.md](uploaded-source-notes.md) — original summaries of **all six** new mobile/visualization/business/blockchain readings and publication restrictions.
4. [visualization-design-strategy.md](visualization-design-strategy.md) — new mobile-first interaction architecture, screen-by-screen proposals and visual acceptance tests.
5. [visualization-projects.md](visualization-projects.md) — ranked open-source UI/chart examples with GitHub links, license classifications and reuse warnings.
6. [requirements.md](requirements.md) — **26 user** and **50 system requirements**, and nothing beyond those sections.
7. [dfd-level-0.mmd](dfd-level-0.mmd) — one-system Level 0 context data-flow diagram.
8. [erd-1nf.mmd](erd-1nf.mmd) — **entities and crow's-foot links only**.
9. [erd-2nf.mmd](erd-2nf.mmd) — same model **with primary and foreign keys**.
10. [erd-3nf.mmd](erd-3nf.mmd) — same model **with attributes and datatypes**.
11. [diagrams.md](diagrams.md) — rendered Mermaid previews for GitHub.
12. [normalization.md](normalization.md) — clarifies visual-stage terminology versus formal relational 1NF/2NF/3NF.
13. [schema-implementation-checklist.md](schema-implementation-checklist.md) — physical database integrity extensions omitted from simple diagrams.
14. [testing.md](testing.md) — test tiers, concrete cases and readiness gates.
15. [implementation-plan.md](implementation-plan.md) — stage-by-stage work.

**Notation caveat:** The labels 1NF, 2NF, and 3NF here denote the owner's desired *progressively detailed presentation layers*. Formally they mean atomicity, no partial functional dependencies, and additional functional-dependency constraints, respectively. Adding PKs or datatypes does not accomplish normalization. Do not mistake these concise views for production SQL.

The current prototype is simulation only. Existing fabricated testnet-like hashes, client Boolean approvals, heuristic analysis and self-referential tests are known gaps. Build real security boundaries and execute valid tests before any financial execution.

## Next task for coding agent

Read all documents, make a requirement-to-code/test traceability matrix, run and inspect baseline tests, then begin Stage 0 of implementation-plan.md. Ensure fake transactions and unsupported AI claims are unambiguously labeled. Each stage requires source-code tests, observed results and an auditable commit.

## Visualization recommendation

Start with **a readable mobile payment comparison + source-linked timeline**, then a desktop React Flow graph. Treat dashboard KPI walls as optional research/operations views. Maintain **one canonical case/evidence source of truth** across screen sizes. Licenses matter: only import source code after pinning and checking the applicable license; particularly **do not copy Blockscout's custom-licensed frontend as if it were permissive**. See [visualization-projects.md](visualization-projects.md).
