# Local agent and wallet workflow

[mvp-scope.md](mvp-scope.md) is authoritative. No built-in model is required. The agent prepares proposals; it never holds a payment key or the human CounterSign seed.

## Start and enroll

Use Node **22.13+** (tested 22.23.0). Run `npm ci`, then `npm run dev`; open `http://127.0.0.1:3001`. The server binds loopback by default. `PHISHNET_DATA_DIR` defaults to `.data/`: SQLite/WAL and owner-only key files. Back up the database **and** keys consistently while the service is stopped. Content keys are not embedded in events or audit exports. Losing them loses private-source availability. A local administrator can read these keys; this is not hardware isolation.

On a separately controlled human signing environment, create/enroll the keyed credential described in [notebook-and-consent.md](notebook-and-consent.md). Configure **only** its raw Ed25519 public key in `COUNTERSIGN_APPROVER_PUBLIC_KEY` before starting the server. Settings shows that public enrollment. The service persists its separate requester/runtime keys. Pin the requester public key on the human signing environment out of band. Do not give an agent enrollment control or the human key. Without enrollment, agent proposals stay held; ordinary manual payments remain available with external wallet approval.

For another device, explicitly configure `HOST` and `PHISHNET_PUBLIC_ORIGIN` to the exact HTTPS origin served by your TLS reverse proxy. The Host and Origin must match; the session cookie uses Secure on HTTPS. Do not expose a development service as an unauthenticated public recorder. Proxy/TLS deployment and OS isolation have not been independently audited. The CLI below deliberately accepts loopback HTTP only; run the local agent beside the local service. This task does not publish a deployment.

## Connect your agent

1. Connect an EVM wallet and select Arc Testnet (5042002). Sign the separate login challenge to unlock that wallet's private journal. Login does not approve any payment.
2. In Settings, create an agent capability. Copy it once into your separately managed local agent process. It is scoped to this wallet, stored hashed, and revocable in Settings. Wallet switch clears private UI state and requires another ownership proof. The service session lasts eight hours.
3. Supply the CLI or the typed HTTP contract to your agent. For an interactive Bash session, read the token without echo/history:

   ```bash
   read -rs PHISHNET_AGENT_TOKEN
   export PHISHNET_AGENT_TOKEN
   node scripts/agent-tool.mjs jobs
   node scripts/agent-tool.mjs tool wallet.balance '{}'
   ```

4. Type any instruction in **Chat**. It is encrypted off-chain and queued. A disconnected model produces no pretend response. Your agent polls `jobs`, receives assigned `{chatId, traceId, eventId, text}`, and can report its own explanation and prepare unsigned terms:

   ```bash
   node scripts/agent-tool.mjs tool plan.report '{"chatId":"CHAT_ID","text":"I propose these terms based on the supplied instruction.","sourceEventIds":["SOURCE_EVENT_ID"]}'
   node scripts/agent-tool.mjs tool payment.propose '{"chatId":"CHAT_ID","to":"FULL_CHECKSUM_OR_LOWERCASE_ADDRESS","amount":"0.02","purpose":"Agent-stated purpose"}'
   ```

Replace placeholders with returned IDs and a full valid address. Tool JSON is validated; arbitrary fields/tools are refused. A source ID must already exist in the same wallet and trace. An explanation is **AGENT_REPORTED**, not independent evidence of truth or hidden chain-of-thought. `payment.propose` returns `{proposalId, traceId, status, transaction, requiresConsent:true, signingCapability:false}`. There is no signer, approval or journal-edit tool. A completed chat no longer appears in polling; do not retry a proposal blindly after an uncertain response. The Activity view lists existing drafts.

The raw protocol is `GET /v1/agent/jobs` or `POST /v1/agent/tool` with `Authorization: Bearer CAPABILITY`, JSON `{tool,arguments}`, same loopback origin. Allowed tools: `wallet.balance`, `chat.read` (empty arguments), `plan.report` (`chatId,text,sourceEventIds?`), `payment.propose` (`chatId?,to,amount,purpose?`). Sender, native asset, decimals and chain are supplied/validated by the gateway. Existing delivered messages remain assigned to the original connector; after revocation, explicitly queue another message for a replacement agent. Previously disclosed text cannot be recalled.

## Human review and external wallet

Open the proposal in Activity. Manual and agent payments use the same canonical review: full sender/recipient, native USDC (18 base-unit decimals), entered amount, Arc chain, empty calldata, estimated maximum fee, stated purpose and source trace. The existing limit remains 100 test USDC and six entered fractional digits. Recipient identity is not established by address validation. There are no merchant-specific fields.

For an agent proposal, create/download the signed CounterSign intent. On the separately controlled human environment:

```bash
node scripts/review-consent.mjs intent.json HUMAN_KEY_FILE PINNED_REQUESTER_PUBLIC_KEY approve > resolution.json
# Use reject instead of approve for an explicit rejection.
```

The helper verifies the requester, displays the exact summary and requires interactive human input. Import the resolution. The gateway verifies the actual official CounterSign 0.2 keyed signature, exact binding, signer and expiry, then persists APPROVED or REJECTED. Silence expires/rejects. The external wallet still asks the human to approve the actual EVM transaction. A CounterSign receipt is neither a wallet signature nor settlement. Wallet fees are reviewed separately; fee increases require another quote. Editing terms creates another proposal/review; old consent cannot approve changed terms.

One-time consumption and `authorizedAt` persist before the wallet request. A rejected or uncertain wallet request cannot reopen that same proposal, even after expiry/restart. A wallet rejection is journaled. On RPC/network failure, **check the wallet and receipt; do not resend automatically**. If the wallet returns a hash but journal recording fails, the UI retains a wallet-scoped recovery record in browser storage and retries only journal correlation on next login, never the transaction. If the tab/device disappears before a hash is returned or that cache is lost, the state remains AUTHORIZATION_REQUESTED: reconcile with wallet/explorer manually. Such a request is not proof of broadcast, rejection or settlement.

## Activity, graph and PWA

Wallet Activity and the default Graph use the same service event journal. Prior browser history is imported only after wallet proof, by an explicit Settings action, as UNTRUSTED_IMPORT. Neither imported notes nor saved CONFIRMED labels confer authority. Imported history is incomplete and contains no inferred agent decision. Receive shows the full selected address; it does not promise comprehensive incoming-payment indexing.

Graph defaults to the selected wallet and the last seven days. Transaction Flow and Decision History are independent toggles, with a shared proposal ID when both are visible; neither shows an explicit empty state. Trace/date/search filters and selection survive toggle changes. Timeline, canvas, keyboard node index and relationship index open original EventTraceV1 records, redaction/privacy and verification methods. An edge is an observed reference, not proof of influence. The Demo selector contains the separately labeled synthetic vendor-substitution and legitimate independently authorized counterexample.

Install through the browser menu on HTTPS/localhost. The service worker caches only the public shell, manifest/icons and scripts/styles. It never caches API/private journal responses. Offline signing and verification are unavailable; balance is never invented. Voice input is explicitly disabled. Chromium manifest/offline-shell checks are automated; no physical-device installation or hardware integration is claimed.

See [audit format and verification](audit-checkpoints.md), [milestone results](mvp-progress.md), and [traceability](traceability.md).

## Dedicated Chat workspace update

The owner added a fifth bottom tab, **Chat**, with conversation history, a larger composer and structured item comparisons. See [the chat workspace and reply contract](chat-workspace.md). `npm run dev` and the local CLI load ignored `.env.local`; `npm run agent:tool -- status` validates the configured capability without consuming jobs. `chat.respond` is the structured form of the existing agent content-reporting permission. Replies and selected-item references stay off-chain and never authorize payment.
