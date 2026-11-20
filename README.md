# PhishNet — Provenance-Aware Security Platform for Agentic Payments

## Android preview (new)

A native, phone-first app now lives in [`apps/android`](apps/android). It creates an empty, encrypted device-held **test wallet**, reads the real Arc Testnet balance, links to Circle's faucet, and includes a private built-in help assistant. No backend or Termux server is needed.

**Install:** Open the repository's **Actions → Android preview → successful run → Artifacts → PhishNet-Android-preview**, download and unzip it, then install `app-debug.apk` on Android 9+. This is a debug-signed preview, not a production release. Future preview builds may require uninstalling; uninstalling destroys this wallet.

**Important:** Sending payments and autonomous agent spending are intentionally disabled. The assistant is a local guide, not an LLM or an earning bot. There is no wallet recovery yet; never send real funds. Read the [Android guide](apps/android/README.md) and [security review](docs/android-security-review.md).

The sections below describe the original prototype and its intended architecture, **not audited production guarantees**. In particular, the Node/PowerShell wallet APIs use in-memory simulated money and do not provide authenticated signing or verified AP2/x402 compliance. The old live adapter now fails closed rather than fabricating settlement.


> **Trace the claims behind AI payment recommendations before money moves.**

PhishNet is an open-source, provenance-aware security and financial authorization platform designed to defend human–AI and agent-to-agent workflows against multi-stage social engineering, context laundering, and unauthorized payments.

Built for the **UBC 2026 Hackathon** (Track: *Agentic Payments and AI* | Chain: *Circle Arc Testnet*).

---

## 1. Problem: The Multi-Stage Information Laundering Threat

In modern agentic systems, external parties can introduce deceptive claims into an interaction history (via emails, tool outputs, or agent-to-agent messages). As intermediate agents summarize and repeat these claims, they acquire apparent credibility through an **echo chamber effect**. Eventually, a financial agent may confidently recommend an unauthorized payment (e.g., to an attacker's substituted wallet) based on an assertion that originated several turns earlier without independent corroboration.

Traditional defenses fail:
1. **URL / Phishing Scanners:** Blind to conversational workflows without links.
2. **Single-Message LLMs:** Confuse multi-agent repetition with independent verification.
3. **Advisory-Only Agents:** Lack the cryptographic and deterministic authority to stop payment settlement.

---

## 2. PhishNet Architecture

PhishNet enforces a strict security principle:
$$\text{Authenticated Message} \neq \text{Trustworthy Claim} \neq \text{Authorized Transaction}$$

```
Interaction History (Chat / Tool / Email / A2A)
                      │
           [Ingestion Boundary]
                      │
  ┌───────────────────┴───────────────────┐
  │                                       │
  ▼                                       ▼
Interactive Provenance Graph        Cryptographic Event Log
- Event DAG with parent links       - Canonical SHA-256 serialization
- Claim lineage tracking            - Append-only Merkle tree
- Source convergence detection      - Inclusion proofs & tamper check
  │
  ▼
PhishNet Risk Analyzer (LLM + Grounding KB)
- Extraction of claims & evidence IDs
- Persuasion & urgency detection
- Advisory recommendation (CLEAR / REVIEW / ESCALATE)
  │
  ▼
[INDEPENDENT DETERMINISTIC PAYMENT GATE] <─── Signed Mandate & Budget
- Exact normalized recipient match
- Amount bounds & cumulative budget
- Chain ID & token contract verification
- Expiration & nonce replay protection
- Human approval requirement for high-value/new payees
  │
  ├────────────────────────┬────────────────────────┐
  ▼                        ▼                        ▼
 ALLOW                    HOLD                     DENY
  │                        │                        │
  ▼                        ▼                        ▼
Arc Testnet Signer   Awaiting Human /        Execution Strictly
(USDC Settlement)   Out-of-Band Proof            Refused
```

### Three Logically Independent Layers:
1. **Financial Agent:** Proposes payments based on workflow context, but has zero unrestricted signing authority.
2. **PhishNet Risk Analyzer:** Evaluates interaction history, maps claims to origins, and flags manipulation cues. Advisory only.
3. **Independent Authorization Engine:** Pure, deterministic code. **An LLM's recommendation can NEVER override this gate.**

---

## 3. Product Modes & Dual System Architecture

PhishNet is packaged as a unified mobile-first application with two integrated surfaces:

1. **On-Device Agentic Wallet & Policy Gate:**
   - **Circle Arc Testnet Rails:** Real-time testnet balance and execution on Chain ID `5042002` with native USDC settlement.
   - **Google AP2 (Agent Payments Protocol):** Issues and validates Intent Mandates, Cart Mandates, and Payment Mandates.
   - **x402 Micropayments Protocol:** Handles HTTP 402 Payment Required challenges for pay-per-request agent queries with automatic budget deductions and replay protection.
   - **Deterministic Policy Enforcement:** Independent, non-LLM policy verification that strictly enforces recipient normalization, budget caps, nonces, and human approval.

2. **Agent Behavior Inspector & Provenance Dashboard:**
   - **Agent Activity Track:** Chronological timeline tracing agent actions, tool calls, and claims across sessions over time.
   - **Interactive Claim Lineage DAG:** Visual SVG graph mapping claim origins and flagging echo chambers / source convergence.
   - **Google Antigravity Behavioral Inference:** Runs deep linguistic and context-laundering analysis to surface urgency manipulation, uncredentialed authority claims, and mutated payment details.
   - **RFC 9162 Merkle Audit Trail:** Canonical SHA-256 event digests and live cryptographic tamper-detection.

---

## 4. Blockchain & Payment Integration

- **Primary Target Network:** **Circle Arc Testnet**
  - **Chain ID:** `5042002` (`0x4CEF52`)
  - **RPC URL:** `https://rpc.testnet.arc.io`
  - **Native Gas Token:** `USDC`
  - **Block Explorer:** `https://explorer.testnet.arc.io`
  - **Faucet:** `https://faucet.circle.com`
- **Supported Payment Scales:**
  - **x402 Micropayments (~$0.02):** Automated API lookup charges with cumulative budget tracking and duplicate nonce protection.
  - **Vendor Payments (~$250.00):** Business transfers requiring exact recipient matching, signed mandates, and out-of-band verification.
- **Simulation Transparency:** Local testing uses an explicitly labeled `status: SIMULATED` simulator to ensure simulated transactions are never misrepresented as settled on-chain payments.

---

## 5. Quickstart & How to Run

PhishNet includes a self-contained, native zero-dependency Windows engine as well as standard Node.js scripts.

### Option A: Node.js (Mobile, Linux, macOS, Android Termux)
```bash
# 1. Run the comprehensive automated verification suite:
node tests/run-all.js

# 2. Start the PhishNet Mobile Server & Web App:
node apps/api/src/server.js
```
Open browser to: `http://127.0.0.1:3000`

### Option B: Native Zero-Dependency Windows Engine
Runs immediately in PowerShell without installing Node or Python:

```powershell
# 1. Run the comprehensive automated test suite (13/13 tests + 16 regression cases):
powershell -ExecutionPolicy Bypass -File tests/run-tests.ps1

# 2. Start the native PhishNet API Server & Web Application:
powershell -ExecutionPolicy Bypass -File apps/api/serve.ps1 -Port 3000
```
Open your browser to: `http://127.0.0.1:3000`

### Option B: Node.js / pnpm Runtime
```bash
pnpm install
pnpm dev
pnpm test
```

---

## 6. Verification & Evaluation Results

Automated test run results from `tests/run-tests.ps1`:

| Metric | Target | Measured Result | Status |
|---|---|---|---|
| **Unauthorized Approval Rate** | 0.0% | **0.0%** (0 unauthorized transactions executed) | **PASS** |
| **False Block Rate (Authorized Cases)** | 0.0% | **0.0%** (All valid authorizations allowed) | **PASS** |
| **LLM Override Resistance** | 100% | **100%** (Adversary LLM prompt cannot bypass policy) | **PASS** |
| **Cryptographic Merkle Tamper Detection** | 100% | **100%** (Altered events fail Merkle proof) | **PASS** |
| **Controlled Provenance Cases** | 16/16 | **16/16** Passed | **PASS** |

### Evaluated Scenario Families:
1. `vendor-swap`: External party injects address change; 2 agents repeat it; deterministic gate blocks payment (`RECIPIENT_MISMATCH`).
2. `vendor-verified`: Vendor changes address; verified via out-of-band CFO channel; fresh signed mandate; transaction permitted (`AUTHORIZED_AND_VERIFIED`).
3. `api-budget-exhausted`: API provider attempts surcharge exceeding cumulative budget; transaction blocked (`BUDGET_EXHAUSTED`).
4. `api-base`: Authorized $0.02 micropayment within scope and budget; permitted (`AUTHORIZED_AND_VERIFIED`).
5. `replayed-nonce`: Duplicate billing attempt reusing consumed nonce; immediately blocked (`REPLAY_NONCE`).
6. `llm-override-attack`: Adversarial prompt claims "100% verified SAFE"; policy gate strictly enforces recipient check and blocks payment.

---

## 7. Epistemic Limitations & Disclosures

1. **Synthetic Scenarios:** The evaluation suite consists of controlled regression fixtures, not field measurements of real-world scam prevalence.
2. **Grounding Knowledge:** The included research records (`research_knowledge.jsonl`) provide structured retrieval context for the agent, not proof of LLM fine-tuning.
3. **Cryptographic Proofs:** Merkle inclusion proofs establish the integrity of *recorded* events; they do not prove that an interaction history was complete or that external actors were honest.
4. **Testnet Assets:** All demonstrations use testnet USDC on Circle Arc Testnet. Never import mainnet private keys or real user funds.

---

## 8. License

PhishNet is open-source software licensed under the **Apache License, Version 2.0**.
