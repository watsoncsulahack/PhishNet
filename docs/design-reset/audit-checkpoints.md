# Arc checkpoint format and independent verification

This is a documented MVP proof format, **not a financial-grade recorder or an independent security audit**. Live funded payment and real checkpoint publication remain pending. Automated tests use controlled RPC/keys and say so.

## Keys, scope and publication

`PHISHNET_AUDIT_PUBLISHER_ADDRESS` pins an external EVM wallet separate from payment accounts. PhishNet holds **no publisher private key**. The service creates a distinct owner-only Ed25519 checkpoint-recorder key; it is separate from CounterSign requester/runtime keys and the human credential. Settings shows the public recorder/publisher. Pin those identities outside the app before trusting an export. The server rejects checkpoints with a publisher used as a payment account and reserves the configured publisher against new proposals. These address checks cannot attest independent control of devices or operators.

In Settings, prepare a checkpoint, then download its exact unsigned transaction or use a **different injected wallet provider** for the pinned audit account. Explicitly approve it in that external audit wallet on Arc Testnet. If only one provider is available, submit the downloaded descriptor externally and import its returned hash. A hash alone is BROADCAST, never ANCHORED. `Verify Arc anchor` checks actual RPC data, exact transaction/calldata, successful receipt, canonical block inclusion, and a finalized block at/after the inclusion block. Errors are UNVERIFIED and journaled; check again or explicitly record a replacement publication hash. No automatic transaction retry occurs. A server-displayed result remains a server report; independent verification requires the CLI below.

The commitment is a zero-value self-addressed transaction (`from=to=pinned publisher`, `chainId=5042002`). Calldata is exactly **84 bytes**:

| Bytes | Meaning |
|---|---|
| 0–3 | ASCII `PNA1` (`504e4131`) |
| 4–35 | SHA-256 Merkle root |
| 36–43 | First sequence, unsigned big-endian 64-bit (v1 always 1) |
| 44–51 | Last sequence, unsigned big-endian 64-bit |
| 52–83 | SHA-256 signed-checkpoint-body digest |

No wallet payment terms, names, conversation, private note, credential, raw evidence or source document is placed in calldata. Standard publisher/gas/block metadata remains public. All original/private sources stay in the scoped encrypted off-chain store.

## Hashes and signatures

Canonical profile `phishnet.sorted-json.v1`: recursively sort object keys by JavaScript UTF-16 ordering, JSON-encode strings/booleans/null, keep array order, accept only safe integer JSON numbers, no whitespace. Undefined/non-JSON values and fractional numbers are refused. This is a documented custom profile, not a claim of RFC 8785 implementation. Financial units are decimal strings.

Event digest: SHA256 of UTF-8 `phishnet.event.v1\n` followed by canonical EventTraceV1 without `integrity.eventDigest`. The event still contains its previous digest and explicit `unsigned-local` authentication. The local hash chain and SQLite triggers alone are rewritable by a compromised host.

Each checkpoint covers the full prefix 1…N (bounded at 100,000 events in v1). Leaf metadata is `{sequence,eventDigest,walletTag}`; walletTag = SHA256(`phishnet.wallet-scope.v1\n` + lowercase address). Leaf hash = SHA256(0x00 || uint64be(sequence) || eventDigest32 || walletTag32). Internal node = SHA256(0x01 || left32 || right32). An odd last child is promoted unchanged. Proof positions/lengths are checked, not inferred from supplied directions. Empty roots are forbidden.

The checkpoint body contains version/profile/ID/range/root/previousCheckpointDigest/public recorder/public publisher/Arc chain/time. Digest = SHA256(`phishnet.checkpoint.v1\n` + canonical body). Ed25519 signs those same domain-prefixed bytes. The digest is also committed in the Arc transaction. A checkpoint-created observation follows the prefix being checkpointed, avoiding circular hashes.

Export contains the signed checkpoint, all prefix leaf metadata, and original events plus Merkle proofs **only for the selected wallet**. Foreign payloads are withheld. Since wallet tags are root-bound, a verifier requiring disclosure of every selected-wallet leaf rejects selected-wallet omissions and duplicate/reordered/modified committed events. Other leaf metadata is opaque; do not treat its payloads as inspected. Chat plaintext and encryption keys are not exported. Off-chain event payloads for the selected wallet include its addresses/amounts: an audit export is private unless the owner explicitly shares it.

## Independent verifier

Download the scoped proof from Settings. Transfer it to another environment with this open-source verifier and its dependencies, **without connecting to the PhishNet API**. Supply the recorder identity, publisher and checkpoint digest from separately trusted records/witnesses, not merely from the untrusted export:

```bash
node scripts/verify-audit.mjs export.json \
  --recorder PINNED_RAW_ED25519_PUBLIC_KEY_HEX \
  --publisher PINNED_LOWERCASE_PUBLISHER_ADDRESS \
  --head PINNED_CHECKPOINT_DIGEST \
  --wallet SELECTED_LOWERCASE_WALLET_ADDRESS
```

The CLI checks schema, every supplied prefix leaf/sequence, selected-wallet completeness, event digests/previous links, inclusion paths, recorder signature and pinned head, then talks **directly** to `https://rpc.testnet.arc.io`. It checks the transaction hash, sender, recipient, chain, zero value, exact minimal data, successful receipt, canonical block membership and finalized height. Missing/unavailable/mismatched evidence exits 1 with `NOT VERIFIED`. It has no offline success or `--skip-verification` mode. No private key is needed. Public RPC is a network reader, not a locally verified full-node/light-client consensus proof; a malicious RPC or compromised pinned publisher/recorder remains a trust dependency.

The expected head must be pinned outside the potentially compromised recorder. A valid older checkpoint is not automatically the newest history. Without an independent newer head/witness, rollback/freshness cannot be detected; the CLI therefore requires the expected digest. Replacing it with the export's own value defeats that protection. Signed checkpoint ancestry is recorded, but the v1 CLI verifies a full prefix against one externally pinned head rather than claiming a separate consistency-proof protocol.

A finalized commitment exposes later modification/omission of committed data relative to the pinned range. It cannot establish event truth, events suppressed before recording, private-source availability, authorization-device separation, or consent to anything outside the signed payment. Before any live verification, software tests establish these comparisons only against controlled readers. See the actual [MVP verification report](../../evaluation/mvp-results.json).
