# Decision notebook and independent consent

The owner supplied an Obsidian/org-roam reference and requested a map of agent decisions with recognizable reasoning, interaction and payment events, inalienable human consent via counter-sign, and a future physical approval card. This increment adds the notebook interface and a real **counter-sign 0.2 raw-Ed25519 keyed-approver profile**. It does not claim to reveal private model cognition or to have tested a physical device.

## Notebook behavior and evidence semantics

The Visualizations tab now contains a dark three-pane workspace: chronological case notes, an original-source document with wiki-style linked notes/backlinks, and an interactive Cytoscape map. Select a note, map node or backlink to read the same canonical event. Drag nodes, pan, zoom or use the keyboard index. Search, node-type filters and the replay slider operate on those event IDs; a note outside the current replay/filter is not left in the reader as if it were present.

Types are human intent, source evidence, interaction, **recorded rationale summary**, payment proposal, deterministic policy decision, human consent and settlement. Text labels/symbols accompany colors. Observed references, inferred influence, unknown/unverified relations and separately verified fixture independence remain distinct. An occurrence after another event does not establish causation.

The vendor substitution and legitimate-update cases are still synthetic. Added rationale summaries are fixture-authored explanations, not transcripts or reconstructed hidden chain of thought. A policy result is not source truth; a synthetic signature is not enrolled real identity; an approval is not blockchain settlement. No running LLM/agent-log ingestion connector is implemented by this increment. Real wallet payment journals remain separate recorded traces; they do not acquire invented agent reasoning.

## Counter-sign integration and trust boundary

Runtime dependency: `@countersignlabs/counter-sign` **0.2.0**, npm integrity pinned in package-lock.json. Reference repo/spec reviewed at commit **11e0956d0498b3f90c27b9d31b9372388e59a1ec**:

- [counter-sign repository](https://github.com/countersign-labs/counter-sign/tree/11e0956d0498b3f90c27b9d31b9372388e59a1ec)
- [specification](https://github.com/countersign-labs/counter-sign/blob/11e0956d0498b3f90c27b9d31b9372388e59a1ec/spec/countersign-spec.md), by Haridarman Kumaresan, CC BY 4.0; no long extracts or protocol source copied.
- Reference code: Apache-2.0. Copyright 2026 Haridarman Kumaresan. This product includes the counter-sign dependency developed at https://github.com/countersign-labs/counter-sign; its LICENSE and NOTICE are retained in the installed package.

`packages/consent/src/broker.js` imports the actual official `createIntent`, `verifyResolution` and key/canonicalization functions. It does not substitute a Boolean for protocol verification. The operator configures **only the human's public key** in `COUNTERSIGN_APPROVER_PUBLIC_KEY`, outside the requesting agent. The broker holds separate, ephemeral requester and runtime keys, never the human secret.

The signed Intent binds a unique ID, allowed keyed approver, five-minute deadline, reject-on-silence policy, and a truthful exact payment summary containing a domain-separated SHA-256 commitment over native transfer fields (`from`, `to`, `value`, `chainId`, empty `data`). Fees are reviewed separately in the final external wallet approval; the human intent does not promise a fixed network fee.

`/v1/testnet/consent/intent`, `/receipt`, `/consume` share the existing local-origin/Host/JSON/rate boundaries. The app exports the Intent for a manual route to the human; it imports the human-signed Resolution, verifies it against the pinned approver via the official protocol verifier, checks receipt time and exact payment binding, and atomically consumes the approval once before the wallet prompt. Rejects, foreign keys, changed terms, expired windows and replay fail closed. Default/authority-vouched approvals are not accepted by this profile. No approval-notification messages are sent to any external service.

If the human key is not configured, **the UI says counter-sign is not enrolled**. It never auto-enrolls a requester-controlled key or fabricates a human receipt. Direct manually initiated wallet payments still require their existing wallet confirmation; autonomous agent execution remains unavailable. When the profile is configured, all in-app sends require both the separate keyed receipt and external wallet approval.

This is an application control for this wallet-request path, not a server-held signer, smart-account spending policy, or a block on transactions users initiate elsewhere. A hostile frontend could request a transaction directly from the wallet, but cannot replace the wallet's human confirmation with a server signature. Production inalienability additionally requires that an agent cannot edit the trusted enrollment/config, restart the approval runtime under a new identity, read the human key, or operate the human's separate signer. Those OS/device/organizational boundaries are not attested by this local app.

## Try independently keyed consent

Use a separate human-controlled signing environment. Do not create the human signing seed inside an agent-accessible workspace. On that environment, create an Ed25519 key using the upstream key-generation tooling (or the library's `generateKeypair`) and keep its secret seed in a protected local JSON key file containing `secretKey`. Only copy the **public key** to the PhishNet operator.

Start PhishNet with the public enrollment:

```bash
COUNTERSIGN_APPROVER_PUBLIC_KEY='PUBLIC_KEY_ONLY' npm run dev
```

Read `/v1/testnet/consent/config` through a trusted operator channel and pin `requesterPublicKey` on the signing environment independently of the request file. Requester keys are ephemeral in this prototype, so a server restart requires a newly pinned requester and a new intent; old requests/approvals cannot be resumed.

In the payment review, choose **Create signed intent**, then **Download intent for approver**. On the human-controlled environment, inspect the full request and run:

```bash
node scripts/review-consent.mjs intent.json /secure/human-key.json PINNED_REQUESTER_PUBLIC_KEY approve > resolution.json
```

The helper checks the signed requester identity, action, default and expiry; displays the signed summary; requires interactive `APPROVE` (or `REJECT`) input; and produces a genuine portable protocol Resolution. It does not send a transaction or transmit the signing key. Import `resolution.json` into the payment review, then continue to the external wallet. A wallet rejection consumes that one-time consent; request a new intent before retrying.

Consent-enabled payment reviews allow five minutes; ordinary wallet-only quotes retain their one-minute review window. Amount/recipient/account/network edits still invalidate the review, and fresh network/fee checks run before signing. The local broker's pending/consumed records are process-local; unknown IDs fail closed after restart. There is no durable approval journal or org-root enrollment registry in this prototype. Browser-saved receipt records are marked unverified after reload and never become execution authority.

## Physical card / hardware-wallet path

A hardware-backed EVM account exposed through the existing connected-wallet provider can prototype the **final transaction signature** if that wallet/device supports the selected network and can display meaningful exact terms. MetaMask documents [hardware-account connection and transaction signing](https://support.metamask.io/more-web3/wallets/how-to-connect-a-trezor-or-ledger-hardware-wallet/). No hardware wallet, firmware or Arc/device combination has been exercised here, and the app cannot attest hardware presence.

The independent **counter-sign receipt** is a different artifact. This profile uses Ed25519; an EVM hardware-wallet transaction signature uses a different scheme and cannot simply be relabeled as a counter-sign Countersignature. Upstream also supports keyed WebAuthn credentials, but PhishNet has not implemented the required WebAuthn enrollment/signing-link/RP-policy flow. A future card should hold a human-only key and trusted display, pin authorized requester/enrollment roots, show chain/recipient/amount/scope, sign the bound decision with expiry and one-time challenge, and support revocation/recovery outside agent control. A separate signing adapter and device tests are required before making a hardware-backed approval claim.

## Licenses and dependency audit

Cytoscape **3.35.0**, MIT, selected from the existing visualization catalog for a read-only navigable knowledge graph; installed LICENSE inspected. Full notices for the browser-bundled Cytoscape, viem and @noble/hashes are retained in the served bundle license file. No Obsidian application code or assets are copied; the screenshot is a visual reference only.

Installing counter-sign initially pulled a Nodemailer dependency with known advisories. Nodemailer is unused by this manual file route; it is nevertheless overridden to **10.1.4** and pinned. The subsequent install audit reports **0 vulnerabilities**. No chat/email adapters are configured or called; an audit scan is not a security certification.

## Actual verification

- `npm run test:consent`: **6/6 passed** against actual counter-sign signatures and broker code: signed/keyed/default-reject Intent; one-time exact approval; forged/unlisted/Boolean/foreign receipt rejection; changed terms; veto; expiry; future receipt; missing enrollment/restart refusal.
- `npm run test:consent-api`: **6/6 passed** through the actual HTTP server. A separate test signer holds the simulated human seed; the server receives only the public key. No wallet or blockchain transfer.
- `npm run test:notebook`: **3/3 passed** for canonical types, filtering/replay and reference validation.
- `npm run test:unit`: **4/4** existing fixture tests passed.
- `npm run test:browser`: **63/63 passed in 25.3 seconds** across 320px touch, 390px touch and desktop. Includes actual canvas-node clicks, zoom, native keyboard index, search/type/replay/backlinks, plus configured-consent missing/accepted/rejected flows with mock wallet/RPC. Browser mock approvals are not independent signature evidence; the actual signature/API tests above supply that evidence.
- Visual QA: desktop and phone notebook screenshots inspected. Original VC-01–09 regression tests pass in the new layout, with exact terms disclosed through an explicit review control. VC-10 real human reviewer study remains **NOT_RUN**.

No physical device, live agent connector, funded end-to-end consent+wallet transfer, or production key-isolation certification was performed. Source hashes and final execution data are recorded in `evaluation/notebook-consent-results.json`.
