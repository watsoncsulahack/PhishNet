# Initial Android / payment security review

This is a code review and implementation note, not a security audit.

## Findings in original prototype

- `apps/api/src/server.js` exposes unauthenticated wallet mutation endpoints on `0.0.0.0` with wildcard CORS. Caller-supplied `humanApproved` and verification flags are not authenticated human approval/evidence.
- Wallet address and starting funds are hard-coded; faucet and payments only mutate in-memory numbers. Restart loses budgets, nonces, and activity.
- `packages/chain/src/arc.ts` previously generated random transaction hashes and a hard-coded block in its supposed live path. **Fixed:** live execution throws without claiming broadcast or settlement.
- Policy implementations are duplicated; malformed dates, missing nonces, zero/negative amounts and insufficient balance need fail-closed validation. Existing synthetic tests do not establish end-to-end payment safety.
- AP2 intent creation claims signing but produces no signature. The behavioral engine uses keyword rules, not the named external AI service. Merkle hashing is custom and should not be represented as verified RFC 9162 compliance without conformance work.

The legacy prototype remains for research. It is NOT used by the Android wallet and is NOT safe for real assets. Other prototype findings above remain unresolved.

## Native preview boundary

- Creates real secp256k1 keys with web3j crypto and encrypts them using AES-GCM and Android Keystore; no signing/export API or secret logging.
- Existing unreadable storage fails closed: no automatic wallet replacement.
- No backup, cleartext HTTP, analytics, remote chat, fake balances, fake receipts, or automatic faucet claims.
- Only trusted hard-coded HTTPS destinations (Arc RPC and Circle faucet); chain ID is checked before balance read. A compromised RPC can still misreport balances. No multi-provider verification yet.
- Native USDC balances use 18 decimals. No dependency on prototype's six-decimal accounting.
- Key generation transiently holds secret material in process memory. Rooted devices, accessibility malware, compromised OS/app dependencies, and physical device compromise are outside current protections. No claim of universal hardware backing.
- Assistant is explicitly a local guide, never a payment authority. Automated fund acquisition/spending is not implemented.
- No recovery or signing authentication yet: receive-only testnet preview, not production custody.

## Release gates

1. Design and test recovery before users rely on balances.
2. Bind biometric/device-credential approval cryptographically to recipient, chain, asset, amount, fees, nonce, and expiry.
3. Share strict validated policy with the signing boundary; disallow unsigned caller approval claims.
4. Persist nonces/budgets atomically with crash/restart/concurrency tests. Reserve funds for pending transactions.
5. Broadcast signed testnet transactions and verify receipts/confirmations; never infer settlement from a generated identifier.
6. Integrate a sandboxed assistant with read-only tools first. Faucet access must respect authentication and rate limits; no promise of earnings.
7. Perform accessibility, dependency, threat-model and independent security reviews. Establish stable release signing outside debug CI.
