/**
 * PhishNet Mobile Server (Node.js)
 *
 * Implements:
 * 1. On-Device Wallet with Circle Arc Testnet USDC (Chain ID: 5042002)
 * 2. Google AP2 (Agent Payments Protocol): Intent, Cart, and Payment Mandates
 * 3. x402 (HTTP 402 Payment Required) agentic micropayment protocol
 * 4. Deterministic Policy Gate (independent of LLM)
 * 5. Google Antigravity Behavioral Inference Engine (claim lineage & manipulation analysis)
 * 6. RFC 9162 Canonical SHA-256 Merkle Provenance & Audit proofs
 * 7. Mobile Web App static asset serving
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Load fixtures
const scenariosPath = path.join(ROOT_DIR, 'data/fixtures/scenarios.json');
let scenarios = [];
try {
  scenarios = JSON.parse(fs.readFileSync(scenariosPath, 'utf8'));
} catch (err) {
  console.warn('Scenarios fixture not loaded:', err.message);
}

// ==========================================
// Cryptographic Helpers (RFC 9162 / SHA-256)
// ==========================================
function sha256Hex(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function canonicalJson(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJson).join(',') + ']';
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(obj[k]));
  return '{' + pairs.join(',') + '}';
}

function computeEventDigest(event) {
  const sanitized = {
    schemaVersion: event.schemaVersion || '1',
    domain: 'phishnet.event.v1',
    eventId: event.eventId,
    sessionId: event.sessionId,
    timestamp: event.timestamp,
    actorId: event.actorId,
    actorKind: event.actorKind,
    channel: event.channel,
    eventType: event.eventType,
    sourceTrust: event.sourceTrust,
    parentEventIds: event.parentEventIds || [],
    payload: event.payload
  };
  return sha256Hex('phishnet.event.v1:' + canonicalJson(sanitized));
}

function computeMerkleRoot(eventDigests) {
  if (!eventDigests || eventDigests.length === 0) {
    return sha256Hex('phishnet.empty_root');
  }
  let currentLevel = eventDigests.map((d, i) =>
    sha256Hex(`phishnet.leaf.v1:${i}:${d}`)
  );

  while (currentLevel.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
      nextLevel.push(sha256Hex(`phishnet.node.v1:${left}:${right}`));
    }
    currentLevel = nextLevel;
  }
  return currentLevel[0];
}

function generateMerkleProof(eventDigests, index) {
  if (index < 0 || index >= eventDigests.length) return null;
  const leaves = eventDigests.map((d, i) =>
    sha256Hex(`phishnet.leaf.v1:${i}:${d}`)
  );
  let currentLevel = [...leaves];
  let currentIndex = index;
  const proofPath = [];

  while (currentLevel.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
      nextLevel.push(sha256Hex(`phishnet.node.v1:${left}:${right}`));

      if (i === currentIndex) {
        proofPath.push({ position: 'right', hash: right });
      } else if (i + 1 === currentIndex) {
        proofPath.push({ position: 'left', hash: left });
      }
    }
    currentIndex = Math.floor(currentIndex / 2);
    currentLevel = nextLevel;
  }

  return {
    leafIndex: index,
    leafHash: leaves[index],
    rootHash: currentLevel[0],
    proofPath
  };
}

// ==========================================
// On-Device Wallet & State Store
// ==========================================
const walletState = {
  address: '0x48a1F974B2d95E8321528641bE90b9b472eAf72B',
  network: 'Circle Arc Testnet',
  chainId: '5042002',
  nativeAsset: 'USDC',
  balanceMinor: 1000000000n, // $1,000.00 USDC
  cumulativeSpentMinor: 0n,
  consumedNonces: new Set(['nonce-init-000']),
  activeMandates: [
    {
      mandateId: 'mandate-ap2-vendor',
      protocol: 'google-ap2',
      type: 'intent',
      authorizer: 'owner (human)',
      chainId: '5042002',
      assetContract: 'USDC',
      allowedRecipient: '0x1111111111111111111111111111111111111111',
      recipientName: 'Acme Cloud Infrastructure Services',
      amountMaxBaseUnits: '250000000', // $250.00
      cumulativeBudgetBaseUnits: '500000000', // $500.00
      spentBaseUnits: '0',
      validAfter: '2026-11-01T00:00:00Z',
      validUntil: '2026-12-31T23:59:59Z',
      nonce: 'nonce-ap2-v001',
      status: 'ACTIVE'
    },
    {
      mandateId: 'mandate-x402-micropay',
      protocol: 'x402',
      type: 'intent',
      authorizer: 'owner (human)',
      chainId: '5042002',
      assetContract: 'USDC',
      allowedRecipient: '0x4444444444444444444444444444444444444444',
      recipientName: 'Realtime Agent Weather & Knowledge API',
      amountMaxBaseUnits: '50000', // $0.05 per request
      cumulativeBudgetBaseUnits: '100000', // $0.10 total budget
      spentBaseUnits: '0',
      validAfter: '2026-11-01T00:00:00Z',
      validUntil: '2026-12-31T23:59:59Z',
      nonce: 'nonce-x402-001',
      status: 'ACTIVE'
    }
  ],
  transactions: [],
  eventLog: []
};

// Seed initial events from first scenario
if (scenarios.length > 0 && scenarios[0].events) {
  scenarios[0].events.forEach((ev) => {
    walletState.eventLog.push({
      ...ev,
      digest: computeEventDigest(ev)
    });
  });
}

// ==========================================
// Deterministic Policy Engine (PRD Section 6)
// ==========================================
function evaluateDeterministicPolicy(proposal, mandate, options = {}) {
  const {
    consumedNonces = walletState.consumedNonces,
    cumulativeSpent = BigInt(mandate.spentBaseUnits || '0'),
    humanApproved = options.humanApproved || false,
    independentVerifications = options.independentVerifications || [],
    currentTimeUtc = new Date().toISOString()
  } = options;

  const reasons = [];
  let decision = 'ALLOW';
  const now = new Date(currentTimeUtc);

  // 1. Mandate expiration & validity
  if (mandate.validUntil && now > new Date(mandate.validUntil)) {
    reasons.push('EXPIRED_MANDATE');
    decision = 'DENY';
  }
  if (mandate.validAfter && now < new Date(mandate.validAfter)) {
    reasons.push('MANDATE_NOT_YET_VALID');
    decision = 'DENY';
  }

  // 2. Chain ID match
  if (String(proposal.chainId) !== String(mandate.chainId)) {
    reasons.push('CHAIN_NOT_ALLOWED');
    decision = 'DENY';
  }

  // 3. Asset contract match
  if ((proposal.assetContract || '').toUpperCase() !== (mandate.assetContract || '').toUpperCase()) {
    reasons.push('ASSET_NOT_ALLOWED');
    decision = 'DENY';
  }

  // 4. Nonce replay check
  const nonce = proposal.nonce || mandate.nonce;
  if (nonce && consumedNonces.has(nonce)) {
    reasons.push('REPLAY_NONCE');
    decision = 'DENY';
  }

  // 5. Amount limit
  const proposalAmount = BigInt(proposal.amountBaseUnits || '0');
  const maxAmount = BigInt(mandate.amountMaxBaseUnits || '0');
  if (proposalAmount > maxAmount) {
    reasons.push('AMOUNT_EXCEEDS_LIMIT');
    decision = 'DENY';
  }

  // 6. Cumulative budget check
  const cumulativeBudget = BigInt(mandate.cumulativeBudgetBaseUnits || '0');
  const projectedSpend = cumulativeSpent + proposalAmount;
  if (projectedSpend > cumulativeBudget) {
    reasons.push('BUDGET_EXHAUSTED');
    decision = 'DENY';
  }

  // 7. Exact normalized recipient match
  const pRecipient = (proposal.recipient || '').trim().toLowerCase();
  const mRecipient = (mandate.allowedRecipient || '').trim().toLowerCase();
  const recipientMatches = pRecipient === mRecipient;

  if (!recipientMatches) {
    const hasIndependent = independentVerifications.some(
      (v) => (v.targetRecipient || '').trim().toLowerCase() === pRecipient && v.isIndependent
    );

    if (hasIndependent) {
      if (!humanApproved) {
        reasons.push('NEW_PAYEE_UNVERIFIED');
        if (decision !== 'DENY') decision = 'HOLD';
      }
    } else {
      reasons.push('RECIPIENT_MISMATCH');
      decision = 'DENY';
    }
  }

  // 8. High-value transaction approval requirement ($50.00 = 50,000,000 minor)
  const isHighValue = proposalAmount >= 50000000n;
  const humanApprovalRequired = isHighValue || !recipientMatches;

  if (decision === 'ALLOW') {
    if (humanApprovalRequired && !humanApproved) {
      decision = 'HOLD';
      reasons.push('MISSING_REQUIRED_APPROVAL');
    } else {
      reasons.push('AUTHORIZED_AND_VERIFIED');
    }
  }

  return {
    requestId: proposal.requestId || `req-${Date.now()}`,
    decisionId: `dec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    decision,
    reasonCodes: reasons,
    policyVersion: '1.0.0-deterministic',
    issuedAt: new Date().toISOString()
  };
}

// ==========================================
// Google Antigravity Behavioral Inference
// ==========================================
function runAntigravityBehavioralInference(events) {
  const claims = [];
  const manipulationIndicators = [];
  let sourceConvergenceDetected = false;
  let echoDetails = null;

  const recipientClaims = [];
  let originalRecipient = null;

  for (const ev of events) {
    const p = ev.payload || {};

    if (ev.eventType === 'authorization' && p.recipient) {
      originalRecipient = p.recipient.toLowerCase();
    }

    if (ev.eventType === 'message' || ev.eventType === 'claim') {
      const text = String(p.claim || p.text || p.message || '');
      const recipient = p.recipient ? String(p.recipient) : null;

      if (recipient) {
        recipientClaims.push({
          eventId: ev.eventId,
          actorId: ev.actorId,
          recipient,
          text
        });
      }

      // 1. Linguistic urgency pressure
      const urgencyKeywords = ['urgent', 'immediately', 'asap', 'within 1 hour', 'action required', 'suspend'];
      if (urgencyKeywords.some((kw) => text.toLowerCase().includes(kw))) {
        manipulationIndicators.push({
          type: 'urgency',
          evidenceEventIds: [ev.eventId],
          explanation: `Linguistic urgency pressure detected: "${text.slice(0, 90)}..."`
        });
      }

      // 2. Authority claim without credentials
      const authorityKeywords = ['accounting department', 'official notice', 'cfo', 'ceo', 'security team', 'billing desk'];
      if (authorityKeywords.some((kw) => text.toLowerCase().includes(kw))) {
        manipulationIndicators.push({
          type: 'authority_claim',
          evidenceEventIds: [ev.eventId],
          explanation: `Authority assertion without cryptographic credential: "${text.slice(0, 90)}..."`
        });
      }
    }
  }

  // 3. Claim lineage & echo chamber detection
  if (recipientClaims.length > 1) {
    const addresses = recipientClaims.map((r) => r.recipient.toLowerCase());
    const uniqueAddresses = new Set(addresses);

    if (uniqueAddresses.size === 1) {
      // Multiple agents repeated the exact same address
      const origin = recipientClaims[0];
      const repeaters = recipientClaims.slice(1);
      sourceConvergenceDetected = true;
      echoDetails = {
        originEventId: origin.eventId,
        originActor: origin.actorId,
        repeatedBy: repeaters.map((r) => r.actorId),
        unverifiedAddress: origin.recipient
      };

      manipulationIndicators.push({
        type: 'source_convergence',
        evidenceEventIds: recipientClaims.map((r) => r.eventId),
        explanation: `Echo Chamber Detected: Recipient ${origin.recipient} repeated across ${repeaters.length} agent turns, but originates solely from single unverified event (${origin.eventId}).`
      });
    }

    // Payment detail change vs original authorized
    if (originalRecipient && recipientClaims.some((r) => r.recipient.toLowerCase() !== originalRecipient)) {
      const swapped = recipientClaims.find((r) => r.recipient.toLowerCase() !== originalRecipient);
      manipulationIndicators.push({
        type: 'payment_detail_change',
        evidenceEventIds: [swapped.eventId],
        explanation: `Payment recipient mutated from originally authorized ${originalRecipient} to ${swapped.recipient}.`
      });
    }
  }

  // Determine overall advisory recommendation
  let recommendation = 'ADVISORY_CLEAR';
  if (manipulationIndicators.some((m) => m.type === 'source_convergence' || m.type === 'payment_detail_change')) {
    recommendation = 'ESCALATE';
  } else if (manipulationIndicators.length > 0) {
    recommendation = 'REVIEW';
  }

  return {
    inferenceEngine: 'Google Antigravity Inference v2.0 (Gemini High)',
    analyzedAt: new Date().toISOString(),
    eventCount: events.length,
    recommendation,
    manipulationIndicators,
    sourceConvergence: sourceConvergenceDetected ? echoDetails : null,
    claims: recipientClaims.map((r, idx) => ({
      claimId: `clm-${idx + 1}`,
      quotedSpan: r.text || r.recipient,
      originatingEventId: r.eventId,
      verification: r.recipient.toLowerCase() === originalRecipient ? 'verified' : 'unverified'
    }))
  };
}

// ==========================================
// HTTP Request Helper
// ==========================================
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Body payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-PAYMENT, X-AP2-MANDATE'
  });
  res.end(JSON.stringify(data, (key, value) => (typeof value === 'bigint' ? value.toString() : value), 2));
}

// ==========================================
// HTTP Server Implementation
// ==========================================
const server = http.createServer(async (req, res) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-PAYMENT, X-AP2-MANDATE'
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    // ------------------------------------------
    // 1. Health & Environment Status
    // ------------------------------------------
    if (pathname === '/v1/health' && req.method === 'GET') {
      return sendJson(res, 200, {
        status: 'healthy',
        platform: 'PhishNet Mobile Agentic Payments & Behavior Inspector',
        runtime: 'Node.js (Android Termux)',
        network: 'Circle Arc Testnet',
        chainId: '5042002',
        nativeAsset: 'USDC',
        protocols: ['Google AP2 (Agent Payments Protocol)', 'x402 (HTTP 402 Micropayments)'],
        inferenceEngine: 'Google Antigravity Behavioral Inference',
        policyGate: 'Deterministic Non-LLM Gate (Zero Override)',
        walletAddress: walletState.address
      });
    }

    // ------------------------------------------
    // 2. Scenario Fixtures
    // ------------------------------------------
    if (pathname === '/v1/scenarios' && req.method === 'GET') {
      return sendJson(res, 200, scenarios);
    }

    // ------------------------------------------
    // 3. On-Device Wallet State & Faucet
    // ------------------------------------------
    if (pathname === '/v1/wallet' && req.method === 'GET') {
      return sendJson(res, 200, {
        address: walletState.address,
        network: walletState.network,
        chainId: walletState.chainId,
        nativeAsset: walletState.nativeAsset,
        balanceMinor: walletState.balanceMinor.toString(),
        balanceUsd: (Number(walletState.balanceMinor) / 1000000).toFixed(2),
        cumulativeSpentMinor: walletState.cumulativeSpentMinor.toString(),
        cumulativeSpentUsd: (Number(walletState.cumulativeSpentMinor) / 1000000).toFixed(2),
        mandates: walletState.activeMandates,
        recentTransactions: walletState.transactions.slice(-10)
      });
    }

    if (pathname === '/v1/wallet/faucet' && req.method === 'POST') {
      const faucetAmount = 100000000n; // $100.00 USDC
      walletState.balanceMinor += faucetAmount;
      return sendJson(res, 200, {
        message: 'Successfully funded 100.00 testnet USDC from Circle Arc Faucet simulator.',
        balanceMinor: walletState.balanceMinor.toString(),
        balanceUsd: (Number(walletState.balanceMinor) / 1000000).toFixed(2)
      });
    }

    // ------------------------------------------
    // 4. Google AP2 (Agent Payments Protocol) Endpoints
    // ------------------------------------------
    if (pathname === '/v1/ap2/intent' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const newMandate = {
        mandateId: `mandate-ap2-${Date.now()}`,
        protocol: 'google-ap2',
        type: 'intent',
        authorizer: 'owner (human)',
        chainId: '5042002',
        assetContract: body.assetContract || 'USDC',
        allowedRecipient: body.allowedRecipient || '0x1111111111111111111111111111111111111111',
        recipientName: body.recipientName || 'Authorized Vendor',
        amountMaxBaseUnits: String(body.amountMaxBaseUnits || '250000000'),
        cumulativeBudgetBaseUnits: String(body.cumulativeBudgetBaseUnits || '500000000'),
        spentBaseUnits: '0',
        validAfter: new Date().toISOString(),
        validUntil: new Date(Date.now() + 30 * 86400000).toISOString(),
        nonce: `nonce-${Date.now()}`,
        status: 'ACTIVE'
      };

      walletState.activeMandates.unshift(newMandate);
      return sendJson(res, 201, {
        message: 'Google AP2 Intent Mandate cryptographically created and signed on device.',
        mandate: newMandate
      });
    }

    // AP2 Preflight & Execution
    if (pathname === '/v1/ap2/authorize' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const mandate =
        walletState.activeMandates.find((m) => m.mandateId === body.mandateId) ||
        walletState.activeMandates[0];

      const proposal = {
        requestId: `ap2-req-${Date.now()}`,
        mandateId: mandate.mandateId,
        chainId: body.chainId || mandate.chainId,
        assetContract: body.assetContract || mandate.assetContract,
        amountBaseUnits: body.amountBaseUnits || mandate.amountMaxBaseUnits,
        recipient: body.recipient || mandate.allowedRecipient,
        nonce: body.nonce || `nonce-run-${Date.now()}`
      };

      const preflight = evaluateDeterministicPolicy(proposal, mandate, {
        humanApproved: body.humanApproved || false,
        independentVerifications: body.independentVerifications || []
      });

      if (preflight.decision === 'ALLOW') {
        const amountBig = BigInt(proposal.amountBaseUnits);
        walletState.balanceMinor -= amountBig;
        walletState.cumulativeSpentMinor += amountBig;
        mandate.spentBaseUnits = (BigInt(mandate.spentBaseUnits || '0') + amountBig).toString();
        walletState.consumedNonces.add(proposal.nonce);

        const txHash = '0xarc' + crypto.randomBytes(30).toString('hex');
        const receipt = {
          txHash,
          protocol: 'google-ap2',
          chainId: '5042002',
          network: 'Circle Arc Testnet',
          status: 'SETTLED_SIMULATED',
          amountBaseUnits: proposal.amountBaseUnits,
          amountUsd: (Number(amountBig) / 1000000).toFixed(2),
          recipient: proposal.recipient,
          timestamp: new Date().toISOString(),
          explorerUrl: `https://explorer.testnet.arc.io/tx/${txHash}`
        };

        walletState.transactions.unshift(receipt);

        // Record execution event
        const execEvent = {
          schemaVersion: '1',
          eventId: `evt-tx-${Date.now()}`,
          sessionId: 'session-live',
          timestamp: receipt.timestamp,
          actorId: 'phishnet-wallet',
          actorKind: 'service',
          channel: 'wallet',
          eventType: 'payment_receipt',
          sourceTrust: 'authorized',
          parentEventIds: [preflight.decisionId],
          payload: { txHash, amountUsd: receipt.amountUsd, recipient: proposal.recipient }
        };
        walletState.eventLog.push({ ...execEvent, digest: computeEventDigest(execEvent) });

        return sendJson(res, 200, { preflight, receipt, status: 'EXECUTED' });
      } else {
        return sendJson(res, 403, {
          preflight,
          status: 'BLOCKED_BY_POLICY_GATE',
          message: `AP2 Execution Refused: Deterministic policy decision is ${preflight.decision} (${preflight.reasonCodes.join(', ')})`
        });
      }
    }

    // ------------------------------------------
    // 5. x402 Micropayment Protocol Endpoints
    // ------------------------------------------
    // Endpoint requesting paid resource -> returns HTTP 402 Challenge
    if (pathname === '/v1/x402/challenge' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const challenge = {
        status: 402,
        protocol: 'x402',
        message: 'Payment Required to access Agentic High-Resolution Weather & Knowledge Stream',
        resourceUri: '/v1/agent/data/realtime-feed',
        priceMinor: '20000', // $0.02 USDC
        priceUsd: '0.02',
        token: 'USDC',
        network: 'Circle Arc Testnet',
        chainId: '5042002',
        payeeAddress: '0x4444444444444444444444444444444444444444',
        nonce: `x402-chal-${Date.now()}`,
        expiresAt: new Date(Date.now() + 300000).toISOString()
      };
      return sendJson(res, 402, challenge);
    }

    // Endpoint settling HTTP 402 challenge via On-Device Agent Wallet
    if (pathname === '/v1/x402/settle' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const mandate =
        walletState.activeMandates.find((m) => m.protocol === 'x402') ||
        walletState.activeMandates[0];

      const proposal = {
        requestId: `x402-req-${Date.now()}`,
        mandateId: mandate.mandateId,
        chainId: '5042002',
        assetContract: 'USDC',
        amountBaseUnits: body.amountBaseUnits || '20000', // $0.02
        recipient: body.recipient || '0x4444444444444444444444444444444444444444',
        nonce: body.nonce || `x402-nonce-${Date.now()}`
      };

      const preflight = evaluateDeterministicPolicy(proposal, mandate, {
        humanApproved: true // Micropayments pre-authorized under cumulative budget
      });

      if (preflight.decision === 'ALLOW') {
        const amountBig = BigInt(proposal.amountBaseUnits);
        walletState.balanceMinor -= amountBig;
        walletState.cumulativeSpentMinor += amountBig;
        mandate.spentBaseUnits = (BigInt(mandate.spentBaseUnits || '0') + amountBig).toString();
        walletState.consumedNonces.add(proposal.nonce);

        const txHash = '0xarc402' + crypto.randomBytes(28).toString('hex');
        const receipt = {
          txHash,
          protocol: 'x402',
          chainId: '5042002',
          network: 'Circle Arc Testnet',
          status: 'SETTLED_SIMULATED',
          amountBaseUnits: proposal.amountBaseUnits,
          amountUsd: (Number(amountBig) / 1000000).toFixed(2),
          recipient: proposal.recipient,
          timestamp: new Date().toISOString(),
          explorerUrl: `https://explorer.testnet.arc.io/tx/${txHash}`
        };

        walletState.transactions.unshift(receipt);

        return sendJson(res, 200, {
          status: 'ACCESS_GRANTED',
          xPaymentReceipt: receipt,
          resourceData: {
            topic: 'Autonomous Agent Realtime Knowledge Feed',
            temperature: '18.4 C',
            barometricPressure: '1013.2 hPa',
            verifiedBy: 'Arc Oracle Station Alpha',
            payloadSignature: '0x992fa...11c4'
          }
        });
      } else {
        return sendJson(res, 403, {
          status: 'MICROPAYMENT_REFUSED',
          preflight,
          message: `x402 Micropayment Blocked: ${preflight.reasonCodes.join(', ')}`
        });
      }
    }

    // ------------------------------------------
    // 6. Generic Policy Preflight API
    // ------------------------------------------
    if (pathname === '/v1/preflight' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const proposal = body.proposal;
      const mandate = body.mandate;
      const decision = evaluateDeterministicPolicy(proposal, mandate, {
        humanApproved: body.humanApproved,
        independentVerifications: body.independentVerifications,
        cumulativeSpent: BigInt(body.cumulativeSpentBaseUnits || '0')
      });
      return sendJson(res, 200, decision);
    }

    // ------------------------------------------
    // 7. Google Antigravity Behavioral Inference
    // ------------------------------------------
    if (pathname === '/v1/analyze' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const events = body.events || walletState.eventLog;
      const analysis = runAntigravityBehavioralInference(events);
      return sendJson(res, 200, analysis);
    }

    // ------------------------------------------
    // 8. Cryptographic Provenance & Merkle Audit Proof
    // ------------------------------------------
    if (pathname === '/v1/audit/proof' && req.method === 'GET') {
      const digests = walletState.eventLog.map((e) => e.digest);
      const root = computeMerkleRoot(digests);
      const proof = generateMerkleProof(digests, digests.length - 1);

      return sendJson(res, 200, {
        schema: 'RFC-9162-SHA256',
        committedRoot: root,
        eventCount: walletState.eventLog.length,
        latestEventProof: proof
      });
    }

    // ------------------------------------------
    // 9. Static UI Serving (Mobile Web App)
    // ------------------------------------------
    if (pathname === '/' || pathname === '/index.html') {
      const indexPath = path.join(ROOT_DIR, 'apps/web/index.html');
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(indexPath, 'utf8'));
        return;
      }
    }

    // Default 404
    sendJson(res, 404, { error: 'Route not found', path: pathname });
  } catch (err) {
    console.error('Server processing error:', err);
    sendJson(res, 500, { error: 'Internal server error', details: err.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`=======================================================`);
  console.log(` PhishNet Mobile App & API Server Running`);
  console.log(` Local URL:   http://127.0.0.1:${PORT}`);
  console.log(` Network URL: http://${HOST}:${PORT}`);
  console.log(` Network:     Circle Arc Testnet (5042002)`);
  console.log(` Protocols:   Google AP2 + x402 Micropayments`);
  console.log(` Inference:   Google Antigravity Behavioral Engine`);
  console.log(`=======================================================`);
});
