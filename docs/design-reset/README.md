# PhishNet Design Reset — Documentation Handoff

**Status:** proposed design targets (2026-11-25/26), not proof of implementation. Source repository: [watsoncsulahack/PhishNet](https://github.com/watsoncsulahack/PhishNet) (audited baseline \`main\` at \`ab57d519\`).

## Reading order

1. [requirements.md](requirements.md) — **only** user requirements (26) and system requirements (50), priority-tagged with stable IDs.
2. [dfd-level-0.mmd](dfd-level-0.mmd) — Level 0 context data-flow diagram, with one PhishNet system process and six external entities.
3. [normalization.md](normalization.md) — functional dependencies and the exact 1NF→2NF→3NF decomposition.
4. [erd-1nf.mmd](erd-1nf.mmd) — atomic **1NF** wide relations with deliberately retained partial-key dependencies.
5. [erd-2nf.mmd](erd-2nf.mmd) — **2NF** decomposition removing partial dependencies while retaining documented transitive dependencies.
6. [erd-3nf.mmd](erd-3nf.mmd) and [erd-3nf-notes.md](erd-3nf-notes.md) — previous ERD correctly relabeled as a **3NF-oriented** migration candidate.
7. [diagrams.md](diagrams.md) — Mermaid-rendered previews of DFD and all three ERD levels.
8. [implementation-plan.md](implementation-plan.md) — staged engineering roadmap and acceptance criteria.

Mermaid sources are canonical editable diagrams. **Only the 3NF-oriented ERD is intended as a future implementation starting point; 1NF/2NF are teaching designs.** Final SQL still requires candidate-key, referential-integrity, security and migration review.

## Non-negotiable current-app facts

Current Node server uses simulated money and fabricated testnet-like hashes, client-origin approval booleans, heuristic keyword analysis, an in-memory wallet and a flawed self-referential regression test. Cryptographic authorization, payment settlement, genuine model inference and reliable auditable event histories are **not** verified current capabilities. The MVP is simulation only.

## Phone agent entry point

Start with [implementation-plan.md](implementation-plan.md) **Stage 0**. Audit the current code against SRs; make simulated features unmistakably simulated; ensure locally safe deployment; make automated tests call the actual shared implementation; then progress through durable provenance, UX and policy. Record evidence of each acceptance criterion before marking completed.
