# Direct human-approved testnet payments

## Scope decision

The owner requested functioning testnet payment initiation and a cohesive payment app with a visualization tab. This adds a **direct human wallet payment** path. It does not enable autonomous agent spending or turn the synthetic mandate verifier into a production authorizer. Earlier simulation-only restrictions continue to apply to the legacy AP2/x402-inspired API, agent-policy replay and disabled server-side Arc signer adapter.

A user explicitly connects a wallet, reviews a fixed native USDC transfer and approves it in the external wallet. PhishNet stores no signing key, can request no background payment and exposes no server broadcast/signing endpoint. The connected wallet manages credentials, cryptographic transaction authorization and nonces. There is no claim that PhishNet verifies the identity of a recipient or can block transactions made outside the app.

## Implemented boundaries

- Only Arc Testnet chain 5042002 (`0x4cef52`). The chain is read from both the wallet and the configured public RPC. No mainnet selector or arbitrary RPC input.
- Native USDC uses **18 decimals**. Human amount input is restricted to six decimal places and converted using exact integer math; legacy simulation amounts remain at six base decimals and are not reused for network sends.
- Complete 42-character recipient, strict mixed-case checksum, nonzero address, positive amount and a product cap of 100 test USDC per payment.
- This release supports externally owned wallet recipients, not contracts/smart-wallet recipients. Recipient code is read before review and re-read before wallet signing. The final wallet transaction always contains empty calldata.
- Public RPC quote reads chain, code, balance, gas estimate and gas price. The app budgets 120% of estimated gas and 2× current gas price; wallet approval displays the final fee. Increased quote fees require review again.
- The full sender/recipient, amount, network and fee are shown before the external wallet prompt. Any account, network, amount, recipient or note change invalidates the review. Reviews expire after one minute. Both account and chain are checked again immediately before invoking the wallet, and chainId is included in the wallet request.
- One in-flight wallet submission per page; duplicate button clicks cannot send twice. A rejected wallet prompt creates no activity record. Broadcast failures never fabricate a hash.
- `CONFIRMED` requires a successful public-RPC receipt, matching hash, sender, recipient, native value, chain, empty input, block number/hash, and inclusion in the currently returned canonical block. A wallet hash alone is `BROADCAST`. Receipt mismatches are explicit; RPC unavailability is `UNVERIFIED`, never a reason to automatically resend.
- Activity is a capped local browser journal, not durable account history or tamper-proof evidence. Persisted status is not trusted: saved hashes are rechecked after reload. Notes remain in the browser and are not put on-chain.
- Public RPC reads use fixed methods/parameters from application code, a timeout and a local API rate cap. Testnet endpoints reject cross-origin requests and unexpected hosts; they have no CORS wildcard. All served responses add CSP, frame, MIME and referrer headers. Existing legacy endpoints are not represented as production financial controls.

The public RPC is a network trust dependency, independent of the injected wallet provider but not a multisource consensus audit. A compromised device, wallet, RPC or frontend is outside the assurance established here. A local duplicate-click lock is not an institutional idempotency service, and browser history is not the normalized persistent database required for autonomous enforcement. Those requirements remain open.

## Architecture

| Module | Responsibility |
|---|---|
| `packages/payments/src/transfer.js` | Fixed chain, strict address/amount parsing, exact transaction construction, receipt comparison |
| `apps/api/src/testnet.js` | Read-only balance, quote and receipt verification against official Arc RPC |
| `apps/web/app.js` | Wallet discovery/selection, exact review, explicit wallet send, activity, real payment trail, tab navigation |
| `apps/web/investigate.js` | Synthetic claim timeline/graph, kept in Visualizations and isolated from wallet execution |
| `tests/payments.test.js` | Production parsing, chain/balance/code gates and receipt verification tests |
| `tests/browser/payments.spec.js` | Mock-wallet/RPC interaction tests, mobile and desktop; no real funds |
| `scripts/check-arc-network.mjs` | Read-only live chain/decimals/gas-estimate check; never signs/broadcasts |

## Licenses and sources checked before integration

- viem **2.58.7**, MIT: installed `node_modules/viem/LICENSE`; dependency version/integrity pinned in package-lock.json. Used for checksum validation, address normalization and integer unit conversion; no online CDN script. License notices are retained in the generated bundle.
- esbuild **0.28.2**, MIT: installed `node_modules/esbuild/LICENSE.md`. Development-only local bundler. No catalog application or paid example code was copied.
- Official [Arc connection documentation](https://docs.arc.io/arc/references/connect-to-arc): testnet chain, RPC, explorer, faucet and 18 native decimals checked 2026-11-26.
- [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193) and EIP-6963: external wallet requests/account/network events and wallet discovery. Native EIP-1559 request parameters, not AP2/x402 compatibility claims.

## Verification log

`npm run test:payments`: **7/7 passed** against the production payment module and public-reader implementation (controlled RPC stubs). Includes strict amount/address tests, forbidden calldata/chain fields, wrong network, insufficient fee-inclusive funds, contract recipient, receipt mismatch, reverted/pending/orphaned receipt and RPC failure cases.

`node scripts/check-arc-network.mjs`: **PASS live read-only**. Chain 5042002; observed block 74180041; ERC-20 decimals 6; native estimate for 0.000001 USDC returned gas `0x6270`, fee budget `1260000000000000` native units and value `0xe8d4a51000`. No signing or broadcast. Earlier sandbox DNS failure was resolved by running the same check with network access.

`npm test`: **15/15 passed** after introducing read-only testnet endpoints. Legacy policy/approval simulations retain their existing isolation. Full payment browser results are recorded after the UI increment; mocked wallet submissions are never reported as live on-chain transactions.

No funded wallet is available to this coding session. A real transfer still requires the user's connected wallet, faucet balance and explicit wallet approval. No real transaction hash or live settled transfer is claimed by this log.
