# Agent handoff: PhishNet wallet + approval + audit MVP

Synchronize **the current main branch** of https://github.com/watsoncsulahack/PhishNet. Read:

1. docs/design-reset/mvp-scope.md (authoritative new MVP scope)
2. docs/design-reset/concept-ui/README.md (owner's wallet/chat sketches and honest image provenance)
3. docs/design-reset/notebook-and-consent.md and docs/design-reset/testnet-payments.md
4. docs/design-reset/requirements.md, traceability.md, testing.md, research-context.md and visualization-design-strategy.md

**Mission:** Complete one agent-proposed, human-reviewed, CounterSign-authorized, wallet-executed Arc Testnet payment and make its recorded event sequence visible in a wallet-connected two-layer knowledge graph with independently checkable audit commitments.

**Out of scope:** bookstore, ERC-8004, browser extension, hardware wallet, agent-held signing keys, mainnet, and autonomous spending. The user's bookstore is a separate project: don't add or integrate it into PhishNet. Reuse the user's local agent via a restricted connector; PhishNet should not require bundling a model.

**Execution method:**
- Audit latest implementation and test results; make MVP-01…MVP-13 requirements-to-code/test matrix. Do not rely on legacy duplicated or self-affirming tests.
- Implement EventTraceV1 schema and gateway-observed append-only journal before building new graph nodes. Separate agent assertions from independently verified records. Preserve evidence IDs, privacy boundaries and replay state.
- Extend the current official CounterSign keyed-approver integration. Exact amount/payee/chain/asset commitment, trusted human signer, restart-durable expiry and one-time consumption, external wallet signing; rejection/default failure prevents submission. No agent-controlled approval boolean or signing capability.
- Keep existing native Arc Testnet transfer and independently checked receipt path; do not introduce mainnet or token/contract changes.
- Render real wallet activity through the existing Cytoscape graph. Add **independently selectable** Transaction Flow and Decision History layers, including both visible/none states. Label demo fixtures as synthetic. Do not invent chain-of-thought nodes.
- Implement simple responsive wallet home: balance, SEND, RECEIVE, plain CHAT, bottom nav (Wallet/Activity/Graph/Settings). Use the owner's sketches as intent; no “Ask PhishNet” copy. No fake operational microphone.
- Once the journal/verifier are correct, add minimal Arc Testnet checkpoint publishing for event hashes only. No chat content/PII on chain. Build a genuinely independent proof verifier with tamper/rollback tests and clearly document incomplete-capture limits.
- Add deterministic integration and browser tests, including 320/390 px, all negative authorization scenarios, wallet switch, reload/restart, chain receipt mismatch and graph parity. Controlled testnet transfer needs explicit human approval and must be distinguished from mocked tests.
- Work through M0–M6 in docs/design-reset/mvp-scope.md, run tests at each stage, update docs and traceability, commit small verified increments, and report observed passes/failures/limitations. Do not claim production-grade financial audit security based only on a PWA-local recorder.

**First task:** Produce a delta against the current repo, then implement **M0 EventTraceV1** and **M1 durable recorded transaction journal**, while preserving current wallet functionality. Do not defer all tests to the end.
