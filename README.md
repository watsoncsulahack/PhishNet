# PhishNet

**Payments with perspective.** Send test USDC through your wallet, follow network receipts, and explore the evidence behind agent payment instructions.

## Run the app

Use Node **22.13+** (tested 22.23.0), `npm ci`, then `npm run dev`. Open **http://127.0.0.1:3001**. Connect an external wallet, select Arc Testnet, and sign the separate ownership challenge to unlock its private journal. Send and Receive are available without a local AI model. Install the PWA through your browser on HTTPS or localhost.

**Wallet · Activity · Graph · Settings.** Generic Chat queues encrypted off-chain messages for a separately managed local agent. Settings issues a revocable, wallet-scoped agent capability. The agent may query typed read tools and prepare unsigned proposals; it cannot approve or sign. All proposals use the same exact-terms review. Agent payments require an enrolled, separately controlled **CounterSign keyed** human credential, followed by approval in the external EVM wallet.

Configure only `COUNTERSIGN_APPROVER_PUBLIC_KEY` on the service; never give it the human seed. State persists in `.data/` (override `PHISHNET_DATA_DIR`). The configured audit publisher is a separate external wallet (`PHISHNET_AUDIT_PUBLISHER_ADDRESS`). The service holds local recorder/content keys, **no financial signer or human consent private key**. Back up the database and owner-only key directory together. See [setup and local-agent tools](docs/design-reset/local-agent.md) and [checkpoint publication/verifier](docs/design-reset/audit-checkpoints.md).

Payments use native USDC with **18 base-unit decimals**, six entered fractional digits, chain **5042002**, empty calldata and the existing **100 test USDC** limit. Contract recipients are unsupported; recipient identity is not verified by address checks. A CounterSign receipt, wallet-returned hash, and successful canonical RPC receipt are distinct evidence. Verification failures never trigger automatic resend.

Graph uses the same durable EventTraceV1 journal as Activity, with independent **Transaction Flow** and **Decision History** switches (either, both, neither). Click timeline nodes, map nodes or relationships to inspect original records and verification/privacy metadata. Explanations are agent-reported, not hidden reasoning. Synthetic investigations are under an explicit Demo selector; imported browser history is untrusted and incomplete. Account switching clears private views and requires wallet proof again.

## Verify

```bash
npm run build
npm run test:mvp          # schemas, durable journal, agent/consent, graph, audit and actual HTTP integration
npm test                  # existing simulation API checks
npm run test:unit
npm run test:payments
npm run test:chain
npm run test:notebook
npm run test:consent
npm run test:consent-api
npm run test:testnet-api
npx playwright install chromium
npm run test:browser      # 320px, 390px, desktop, PWA; controlled wallet/RPC, actual gateway and signatures
node scripts/verify-design-docs.mjs
node scripts/check-arc-network.mjs # optional live READ-ONLY check; never signs/broadcasts
```

[Authoritative MVP scope](docs/design-reset/mvp-scope.md) · [Milestones and actual results](docs/design-reset/mvp-progress.md) · [Traceability](docs/design-reset/traceability.md).

**Funded M6 payment and real Arc checkpoint publication remain pending by owner instruction.** Tests with controlled keys/RPC do not demonstrate live settlement, independent credential custody, OS isolation, an external audit or human efficacy. The checkpoint verifier requires public identities and a checkpoint head pinned outside the recorder, then independently reads the fixed Arc RPC. Local signatures/hash chains alone do not establish external anchoring. No mainnet, autonomous financial signing, merchant integration, ERC-8004, extension or hardware-wallet integration is included.

Legacy `/v1/ap2/*`, `/v1/x402/*` and policy simulations remain separate, in-memory protocol-inspired examples. Their six-decimal fixtures cannot authorize native 18-decimal wallet payments. A complete production hardening/security audit and a human study remain open. Dependency versions/licenses are pinned; full bundled MIT notices are served locally. No catalog application's source or noncommercial Obsidian code was copied.

Apache-2.0.
