# PhishNet

**Payments with perspective.** Send test USDC through your wallet, follow network receipts, and explore the evidence behind agent payment instructions.

## Run the app

Requires Node.js 22+ and a browser wallet supporting custom EVM networks (for example MetaMask).

```bash
npm ci
npm run dev
```

Open **http://127.0.0.1:3001**. `npm run dev` builds the wallet bundle before starting the local server. No API key, seed phrase or private-key environment variable is needed.

1. **Connect wallet.** Approve the connection and switch to Arc Testnet. If needed, the app offers to add the official network.
2. **Get test funds.** Use the in-app link to the [Circle faucet](https://faucet.circle.com), select Arc Testnet, and fund your connected address. USDC pays both the transfer and network fee.
3. **Send a payment.** Enter a complete recipient wallet address and amount (up to 100 test USDC per payment). Review the full addresses, exact amount, network and estimated fee, then approve the transaction in your wallet.
4. **Follow Activity.** A wallet submission is BROADCAST; CONFIRMED appears only after the public RPC receipt and transaction match the reviewed payment. Check the explorer or inspect the recorded payment trail.
5. **Open Visualizations.** Explore the vendor-substitution and independently signed-update synthetic cases through the same linked timeline, graph and source inspector. These examples do not initiate payments.

The connected-wallet path signs only in the external wallet. It uses **native USDC at 18 decimals** on chain **5042002**, with empty calldata. Amount input supports six decimal places. Contract/smart-wallet recipients are not supported in this release. Recipient identity is not independently verified by a format/code check. No mainnet, autonomous agent signing, or server-held keys are enabled.

On mobile, use a compatible wallet browser with access to the running app. The default server is local to this computer; a separate phone cannot reach this computer via its own `localhost`. This build's testnet read API accepts localhost hosts only. Remote/mobile hosting and secure public-origin configuration require a separate deployment step.

## Verify

```bash
npm run build
npm test                  # existing simulation API regression checks
npm run test:unit         # synthetic investigation/signature fixtures
npm run test:payments     # actual transfer validation and RPC reader with controlled inputs
npm run test:testnet-api  # actual read-only HTTP boundary tests
npm run test:chain        # legacy server signer stays disabled
npx playwright install chromium
npm run test:browser      # 320px, 390px and desktop; mocked wallet/RPC
node scripts/verify-design-docs.mjs
node scripts/check-arc-network.mjs # optional LIVE read-only chain/decimals/gas estimate
```

Browser output is generated in `test-results/browser-results.json`, with screenshots and failure traces. The live network script never signs or broadcasts. Automated wallet submissions are mocked and are not proof of a real on-chain transfer. A funded wallet and the user's explicit approval are required to execute a real testnet transfer.

[Payment scope and actual results](docs/design-reset/testnet-payments.md) · [Requirements traceability](docs/design-reset/traceability.md) · [Design reset](docs/design-reset/README.md)

## Data and remaining scope

Payment history and optional notes stay in this browser. Saved confirmation labels are not trusted after reload: every saved hash is rechecked. This is a local journal, not an account-wide index or tamper-proof audit log. Clearing browser data removes it; the network/wallet record remains.

Legacy `/v1/ap2/*`, `/v1/x402/*` and generic policy endpoints remain **in-memory, protocol-inspired simulations**. Their six-decimal fixture amounts never feed the native 18-decimal wallet path. Synthetic mandate keys demonstrate signature checking, not production identity or independent human enrollment. Autonomous authorizations, durable policy budgets/replay accounting, tenant isolation, verified AP2/x402, private audit checkpoints and human efficacy studies remain open. Legacy PowerShell code is not the supported payment-app runtime.

Runtime dependencies: viem 2.58.7 (MIT). Local build: esbuild 0.28.2 (MIT). Dependency licenses are retained; no remote JavaScript CDN is used.

Apache-2.0.

## Decision notebook and independent consent

**Visualizations** now includes an Obsidian-inspired notebook: chronological notes, an original-source reader with wiki-style backlinks, and a draggable/zoomable graph. Filter source evidence, interactions, recorded rationale summaries, payment proposals, policy decisions, consent and settlement; replay the case chronologically. These agent examples remain synthetic and do not expose or reconstruct private model reasoning.

An optional independently keyed **counter-sign 0.2** profile adds a second human-consent requirement before the wallet prompt. Configure only `COUNTERSIGN_APPROVER_PUBLIC_KEY`; keep the human signing seed on a separate human-controlled environment. The app exports a signed, exact-payment Intent and imports/verifies a keyed Resolution. Silence, rejection, altered terms and replay cannot authorize a transfer. Without that enrollment, the UI explicitly reports counter-sign unconfigured and ordinary manual wallet confirmation remains mandatory.

[Consent setup, trust boundaries and hardware-card plan](docs/design-reset/notebook-and-consent.md). A hardware-backed wallet account can prototype final transaction signing, subject to device/network support; its EVM signature is not automatically a counter-sign receipt. No physical device is attested or tested here.

```bash
npm run test:notebook
npm run test:consent
npm run test:consent-api
```

The current suite passes 63 browser cases, 6 actual consent HTTP checks, 6 consent unit tests and 3 notebook-model tests. See [executed notebook/consent results](evaluation/notebook-consent-results.json). Human efficacy, physical-device and funded consent-plus-wallet end-to-end tests remain open.
