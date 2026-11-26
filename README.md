# PhishNet

A local, mobile-first investigation demo for claims behind agent payment proposals. **All financial actions are simulated.** No network transfer, live signing, protocol conformance or fraud-detection efficacy is established.

## Run

Requires Node.js 22+.

```bash
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Review vendor recipient substitution, then switch to the independently authorized update counterexample. Select timeline events, graph nodes or relationship labels to inspect the same canonical evidence. Addresses are fully displayed and copyable.

The case API (`GET /v1/investigations`) is read-only. Its two synthetic replays use a fixed clock (2026-11-26 09:10 UTC). The legitimate update verifies Ed25519 fixture signatures for a separate reviewer, a new mandate and the exact proposal. Ephemeral fixture keys are generated within the process; this demonstrates signature checking, **not real identity enrollment or independent human authorization**. No private keys reach the browser.

## Verify

```bash
npm test                       # 15 actual-server API smoke checks
npm run test:unit              # investigation/signature fixtures
npx playwright install chromium
npm run test:browser           # Chromium, 320px / 390px / desktop
node scripts/verify-design-docs.mjs
```

Browser results are generated in `test-results/browser-results.json`. See [the investigation results](docs/design-reset/investigation-results.md) for recorded commands, outcomes and VC-01–VC-10 status. A local reviewer form measures decisions, source attribution, elapsed time, confidence and input errors; results stay in memory until downloaded. Automated form tests are not human study observations.

## Architecture and limits

One canonical case model drives payment comparison, chronology, provenance and source detail. A shared deterministic simulation policy serves both API and fixture replay. Source authenticity, assertion truth, observed links, inferred influence, verified authorization and settlement remain distinct.

The initial slice uses native accessible controls and an original small fixed graph. [Component selection](docs/design-reset/interface-architecture.md) documents the catalog review, license checks and why React dependencies are deferred.

The legacy AP2/x402-inspired API simulates balances in memory; it does not enforce external payments. Persistence, full input/ownership validation, production credentials, revocation, transaction-bound passkeys, isolated signing, atomic durable budgets, protocol compliance, independent audit checkpoints and verified testnet settlement remain open. The PowerShell server/test harness and TypeScript legacy modules are not the supported investigation runtime; their previous headline metrics are not valid evidence. There are no measured human efficacy or market results.

[Design reset](docs/design-reset/README.md) · [Requirements traceability](docs/design-reset/traceability.md)

Apache-2.0.
