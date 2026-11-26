# Chat workspace increment

Owner request: pull the upstream README update; repair the compact wallet composer; add a dedicated bottom **Chat** tab with a larger conversation surface suitable for item discovery/comparison. This extends the four-tab sketch to **Wallet / Activity / Chat / Graph / Settings**. It does not add a merchant backend, fulfillment, Google Shopping integration or an autonomous financial signer.

## Design and behavior

The layout uses a conversation rail on desktop, an accessible history sheet on mobile, a pinned multiline composer, keyboard-operated options menu, draft starter prompts, and source-linked item cards. The wallet keeps its compact single-line Chat field; sending there opens a new conversation in the larger workspace. Existing conversations can be reopened after signing in/reloading. Account changes clear protected text, cached responses, item details and comparison selections.

The visual reference is Google's official description of [shopping in Gemini](https://support.google.com/gemini/answer/16730149?co=GENIE.Platform%3DDesktop&hl=en): selectable product cards, details and comparison follow-ups. This implementation uses original HTML/CSS and native browser controls. No Google interface source, brand artwork or third-party component code was copied; no new runtime dependency was added.

Cards are actual **agent-reported** data. Prices, merchant labels and descriptions are assertions, not verified inventory or settlement. Images are optional small embedded PNG/JPEG/WebP data only; absent images are labeled. Remote images are not fetched. External product links must use HTTPS, show the destination domain in the detail view, and open with `noopener noreferrer`. There is no fabricated catalog, stock, rating, assistant response or purchase confirmation.

Selected products are sent as validated `{eventId,itemId}` references to the exact encrypted original reply. The gateway resolves their original data for the agent, rejects cross-wallet/trace references and nonexistent/rewritten items, and records observed references in the journal. The visible human message stays plain text with named selection chips. A card can link to a validated proposal only when it belongs to the same agent, wallet and conversation. **Review payment** opens the unchanged canonical CounterSign/external-wallet gate; neither selecting a card nor an agent response authorizes a payment.

## Local capability setup

The supplied value was confirmed by the owner to be an **agent capability created in Settings**, not a model-provider key or a wallet signing key. It is stored only in ignored `.env.local` with owner-only permissions, and was checked against the active hashed capability in the local journal. Its value is deliberately absent from this documentation, tracked files and browser assets.

`npm run dev` now loads `.env.local` through Node's native optional env-file support. Restart an already-running development server to load the updated routes and configuration. The CLI also loads that local file, preserving existing process environment overrides:

```bash
npm run dev
# In another local terminal:
npm run agent:tool -- status
npm run agent:tool -- jobs
```

`status` checks the bearer credential without claiming jobs, reading conversation text, starting a model or requesting a wallet signature. In Settings, **Check local connector** checks whether the configured credential belongs to the signed-in wallet and whether a real agent has polled recently; it never returns the raw credential. Other wallets receive a generic unavailable result.

The capability authenticates a separately managed local agent. It does not itself run a model. Messages remain visibly queued while no agent is responding. Existing `plan.report` capability holders can use the new structured response form under the same authority to report content; credentials restricted to read-only tools cannot. No financial permissions are expanded.

## Agent reply contract

Poll `/v1/agent/jobs` with the configured capability. Each assigned job includes its `chatId`, conversation `traceId`, original `eventId`, human `text`, recent recorded context (up to twenty records, bounded for size), and original `selectedItems` when present. Context is bounded at the human message's sequence so later instructions are not attributed to an earlier turn.

Use `chat.respond` once for the turn, with a stable `replyId` for safe retry:

```bash
npm run agent:tool -- tool chat.respond '{"chatId":"RETURNED_CHAT_ID","replyId":"reply-001","text":"Here are some options to compare.","items":[{"id":"option-a","title":"Agent-provided item","merchant":"Merchant assertion","url":"https://example.com/item","price":{"amount":"39.00","currency":"USD"},"features":["A reported feature"]}]}'
```

The example is a protocol example, not real merchandise or a quote. Omit `items` for ordinary replies. Up to six items are supported; optional `description`, embedded `imageDataUrl` and `proposalId` are validated. Total protected reply JSON is limited to 32KB. A changed response cannot reuse a `replyId`; an identical retry returns the original event. A second response for the same human turn is rejected. Chat follow-ups use the same `traceId`; a new chat starts another trace.

The recorder emits `agent.message.reported` with `AGENT_REPORTED`, private-reference privacy, content digest and causal source IDs. Plaintext replies/items stay encrypted off-chain. They appear in Decision History as real recorded agent events. CounterSign signatures, wallet submissions, RPC verification and audit commitments remain distinct. Original `plan.report` notes are labeled separately in the conversation.

## Verification

`tests/chat.test.js` covers typed card validation, protected persistence/restart, reply idempotency, thread context, capability restrictions, cross-scope source/proposal rejection and immutable selected-item provenance. `tests/mvp-http.test.js` exercises the actual status/chat/content/follow-up HTTP boundary. `tests/browser/chat.spec.js` exercises all five navigation entries, compact composer alignment, keyboard menu, item details/comparison, history/reload, account-switch clearing, inert untrusted markup and the CounterSign payment gate at 320px, 390px and desktop.

The first phone run passed 5/6; an inherited form-button margin misaligned the compact composer and was fixed. The first complete run passed 92/93; the remaining test required the disabled microphone control to remain visible at 320px, which was restored. Final results are recorded in [the execution report](../../evaluation/chat-workspace-results.json). Existing funded-payment and real anchoring deferrals remain unchanged.

## Final local activation

Final verification passed **93/93 browser cases** and **32/32 MVP tests**, with existing regression suites passing. The provided capability also authenticated a live **read-only Arc Testnet balance query** against the existing app; the returned balance was deliberately omitted from public test artifacts. No chat job was claimed and no wallet signature/payment was requested.

A parallel dev start initially found port 3001 occupied. The listener was confirmed to be this workspace's PhishNet server, then gracefully restarted while preserving its service environment, data directory and durable approval store. The updated server now returns HTTP 200 for health and the Chat stylesheet, and the actual configured capability passes the new `status` endpoint with `signingCapability:false`. Refresh **http://127.0.0.1:3001/#chat**. A separately running agent still supplies replies; credential validation does not start an AI model.
