/** Local, in-memory financial simulation and heuristic investigation demo. */

import { evaluateDeterministicPolicy as evaluateSimulationPolicy } from '../../../packages/core/src/simulation-policy.js';
import { investigations } from '../../../packages/core/src/investigations.js';
import { testnet } from './testnet.js';
import { Journal } from '../../../packages/journal/src/journal.js';
import { createGateway } from './gateway.js';
import {localOrigin} from './gateway-http.js';
import { gatewayHandler } from './gateway-http.js';
import {createAudit} from './audit.js';
import {dispatchJob} from '../../../packages/agent/src/bridge.js';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';
const journal = new Journal(process.env.PHISHNET_DATA_DIR || path.join(ROOT_DIR, '.data'));
const gateway = createGateway({journal, allowDynamicConsent: true, requireUnenrolledAgentConsent: false, defaultAgentBackend: process.env.PHISHNET_AGENT_BACKEND || 'antigravity'});
gateway.audit=createAudit(gateway);
const consentBroker = gateway.consent;
const handleGateway = gatewayHandler(gateway);

const runtimeAgentTokens = new Map();
const activeDispatchWallets = new Set();
const queuedDispatchWallets = new Set();

function resolveRuntimeAgent(wallet) {
  const configured = (process.env.PHISHNET_AGENT_TOKEN || '').trim();
  if (configured) {
    try {
      const a = gateway.agent(configured);
      if (a.wallet === wallet) return a;
    } catch {}
  }
  const cached = runtimeAgentTokens.get(wallet);
  if (cached) {
    try { return gateway.agent(cached); } catch { runtimeAgentTokens.delete(wallet); }
  }
  const issued = gateway.issueAgent(wallet);
  runtimeAgentTokens.set(wallet, issued.token);
  return gateway.agent(issued.token);
}

async function dispatchWalletChat(wallet) {
  if (!wallet || process.env.PHISHNET_AUTO_AGENT === '0') return;
  const backend = gateway.backend();
  if (backend === 'manual') return;
  if (activeDispatchWallets.has(wallet)) {
    queuedDispatchWallets.add(wallet);
    return;
  }
  activeDispatchWallets.add(wallet);
  try {
    do {
      queuedDispatchWallets.delete(wallet);
      const agent = resolveRuntimeAgent(wallet);
      const client = { tool: (tool, args) => gateway.tool(agent, { tool, arguments: args }) };
      const jobs = gateway.jobs(agent);
      for (const job of jobs) {
        const currentBackend = gateway.backend();
        if (currentBackend === 'manual') break;
        try {
          gateway.emitAgentStatus(wallet, { traceId: job.traceId, phase: 'reading', backend: currentBackend, label: 'Reading wallet balance & faucet transactions…' });
          try {
            const txRes = await gateway.tool(agent, { tool: 'wallet.transactions', arguments: {} });
            if (txRes) job.walletSnapshot = { ...job.walletSnapshot, ...txRes };
          } catch {}
          try {
            const bal = await gateway.tool(agent, { tool: 'wallet.balance', arguments: {} });
            if (bal?.balanceUSDC) job.walletSnapshot = { ...job.walletSnapshot, balanceBaseUnits: bal.balanceBaseUnits, balanceUSDC: bal.balanceUSDC };
          } catch {}
          gateway.emitAgentStatus(wallet, { traceId: job.traceId, phase: 'thinking', backend: currentBackend, label: `Thinking with ${currentBackend}…` });
          await dispatchJob(client, job, { backend: currentBackend });
          gateway.emitAgentStatus(wallet, { traceId: job.traceId, phase: 'idle', backend: currentBackend });
        } catch (err) {
          console.warn(`Local agent dispatch (${currentBackend}) error:`, err.message);
          gateway.emitAgentStatus(wallet, { traceId: job.traceId, phase: 'idle', backend: currentBackend });
          try {
            await client.tool('chat.respond', {
              chatId: job.chatId,
              replyId: 'bridge-err-' + job.chatId,
              text: `Local agent backend (${currentBackend}) could not complete this reply: ${err.message}. You can switch backends in Settings or connect via /v1/mcp.`,
              items: []
            });
          } catch {}
        }
      }
    } while (queuedDispatchWallets.has(wallet));
  } catch (err) {
    console.warn('Local agent dispatch loop error:', err.message);
  } finally {
    activeDispatchWallets.delete(wallet);
  }
}

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
  return evaluateSimulationPolicy(proposal, mandate, {consumedNonces: walletState.consumedNonces, ...options});
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
      sourceConvergenceDetected = false;
      echoDetails = {
        originEventId: origin.eventId,
        originActor: origin.actorId,
        repeatedBy: repeaters.map((r) => r.actorId),
        unverifiedAddress: origin.recipient
      };

      manipulationIndicators.push({
        type: 'source_convergence',
        evidenceEventIds: recipientClaims.map((r) => r.eventId),
        explanation: `Echo Chamber Detected: Recipient ${origin.recipient} repeated across ${repeaters.length} agent turns, the common origin is unknown.`
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
    inferenceEngine: 'Local keyword and recipient-matching heuristic (advisory)',
    analyzedAt: new Date().toISOString(),
    eventCount: events.length,
    recommendation,
    manipulationIndicators,
    sourceConvergence: sourceConvergenceDetected ? echoDetails : null,
    claims: recipientClaims.map((r, idx) => ({
      claimId: `clm-${idx + 1}`,
      quotedSpan: r.text || r.recipient,
      originatingEventId: r.eventId,
      verification: 'unverified'
    }))
  };
}

// ==========================================
// HTTP Request Helper
// ==========================================
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    let body = '';
    let aborted = false;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > 65536) {
        aborted = true;
        req.destroy();
        reject(new Error('Body payload too large'));
      } else {
        body += chunk;
      }
    });
    req.on('end', () => {
      if (aborted) return;
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
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data, (key, value) => (typeof value === 'bigint' ? value.toString() : value), 2));
}

// ==========================================
// HTTP Server Implementation
// ==========================================
let testnetWindow = {start:Date.now(), count:0};
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  if(await handleGateway(req,res)){
    if(req.method==='POST'&&req.url?.startsWith('/v1/gateway/chat')&&res.statusCode===201){
      const wallet=String(req.headers['x-phishnet-wallet']||'').toLowerCase();
      if(wallet)setImmediate(()=>void dispatchWalletChat(wallet));
    }
    return;
  }
  // Wallet signing stays in the user's wallet. These routes only read Arc public data or require wallet session auth for consent mutations.
  if (req.url?.startsWith('/v1/testnet/')) {
    let origin;try{origin=localOrigin(req,process.env.PHISHNET_PUBLIC_ORIGIN||'');}catch{res.writeHead(403,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({error:'Use this API from the configured PhishNet origin.'}));}
    const reply = (status, body) => {res.writeHead(status, {'Content-Type':'application/json', 'Cache-Control':'no-store'});res.end(JSON.stringify(body));};

    if(Date.now()-testnetWindow.start>60000)testnetWindow={start:Date.now(),count:0};
    if(++testnetWindow.count>180)return reply(429,{error:'Too many requests. Wait one minute and retry.'});
    try {
      const endpoint = new URL(req.url,origin);
      if(req.method==='GET' && endpoint.pathname==='/v1/testnet/consent/config')return reply(200,consentBroker.config());
      if(req.method==='POST' && ['/v1/testnet/consent/intent','/v1/testnet/consent/receipt','/v1/testnet/consent/consume'].includes(endpoint.pathname)){
        const raw=req.headers.cookie?.match(/(?:^|;\s*)phishnet_session=([A-Za-z0-9_-]+)/)?.[1];
        let wallet;try{wallet=gateway.session(raw,req.headers['x-phishnet-wallet']);}catch{return reply(401,{error:'Sign in with the selected wallet to manage CounterSign intents.'});}
        if(!req.headers['content-type']?.startsWith('application/json'))return reply(415,{error:'JSON body required.'});
        const input=await parseJsonBody(req);
        if(endpoint.pathname.endsWith('/intent')){
          if(String(input?.from||'').toLowerCase()!==wallet)return reply(403,{error:'Consent intent sender must match the signed-in wallet.'});
          return reply(200,consentBroker.create(input));
        }
        return reply(200,endpoint.pathname.endsWith('/receipt')?consentBroker.accept(input,wallet):consentBroker.consume(input,wallet));
      }
      if(req.method==='GET' && endpoint.pathname==='/v1/testnet/network')return reply(200,await testnet.network());
      if(req.method==='GET' && endpoint.pathname==='/v1/testnet/balance')return reply(200,await testnet.balance(endpoint.searchParams.get('address')));
      if(req.method==='POST' && ['/v1/testnet/quote','/v1/testnet/receipt'].includes(endpoint.pathname)) {
        if(!req.headers['content-type']?.startsWith('application/json'))return reply(415,{error:'JSON body required.'});
        const body=await parseJsonBody(req);
        return reply(200,endpoint.pathname.endsWith('/quote')?{...await testnet.quote(body),consentRequired:consentBroker.config().configured}:await testnet.receipt(body));
      }
      return reply(404,{error:'Testnet route not found.'});
    } catch(error) {return reply(400,{error:error.message || 'Testnet request failed.'});}
  }
  try{localOrigin(req,process.env.PHISHNET_PUBLIC_ORIGIN||'');}catch{return sendJson(res,403,{error:'Use this API from the configured PhishNet origin.'});}
  // Refuse preflighted cross-origin requests rather than exposing wildcard CORS.
  if (req.method === 'OPTIONS') {
    res.writeHead(405, { 'Cache-Control': 'no-store' });
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
        environment: 'SIMULATION',
        capabilities: {legacyPaymentApis:'SIMULATION', directPayments:'External human-approved Arc Testnet wallet', testnetApi:'Read-only network checks; no server signing'},
        runtime: 'Node.js',
        network: 'Simulated Arc configuration (no network connection)',
        chainId: '5042002',
        nativeAsset: 'USDC',
        protocols: ['AP2-inspired simulation', 'x402-inspired simulation'],
        inferenceEngine: 'Local heuristic (advisory)',
        policyGate: 'Simulation only; not an enforcement service',
        walletAddress: walletState.address
      });
    }

    // ------------------------------------------
    // 2. Scenario Fixtures
    // ------------------------------------------
    if (pathname === '/v1/investigations' && req.method === 'GET') {
      return sendJson(res, 200, investigations);
    }

    if (pathname === '/v1/scenarios' && req.method === 'GET') {
      return sendJson(res, 200, scenarios);
    }

    // ------------------------------------------
    // 3. On-Device Wallet State & Faucet
    // ------------------------------------------
    if (pathname === '/v1/wallet' && req.method === 'GET') {
      return sendJson(res, 200, {
        environment: 'SIMULATION',
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
        message: 'Simulated balance increased by 100.00 units; no funds were transferred.',
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
        message: 'Simulated mandate created; no signature or independent authorization was verified.',
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
        if (amountBig > walletState.balanceMinor) return sendJson(res, 403, {status: 'SIMULATION_INSUFFICIENT_BALANCE'});
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
          status: 'SIMULATED',
          amountBaseUnits: proposal.amountBaseUnits,
          amountUsd: (Number(amountBig) / 1000000).toFixed(2),
          recipient: proposal.recipient,
          timestamp: new Date().toISOString(),
          environment: 'SIMULATION'
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

        return sendJson(res, 200, { preflight, receipt, status: 'SIMULATED' });
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
        network: 'Simulated Arc configuration (no network connection)',
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
        if (amountBig > walletState.balanceMinor) return sendJson(res, 403, {status: 'SIMULATION_INSUFFICIENT_BALANCE'});
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
          status: 'SIMULATED',
          amountBaseUnits: proposal.amountBaseUnits,
          amountUsd: (Number(amountBig) / 1000000).toFixed(2),
          recipient: proposal.recipient,
          timestamp: new Date().toISOString(),
          environment: 'SIMULATION'
        };

        walletState.transactions.unshift(receipt);

        return sendJson(res, 200, {
          status: 'ACCESS_GRANTED',
          xPaymentReceipt: receipt,
          resourceData: {
            topic: 'Autonomous Agent Realtime Knowledge Feed',
            temperature: '18.4 C',
            barometricPressure: '1013.2 hPa',
            source: 'synthetic demonstration data'
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
      if (body.cumulativeSpentBaseUnits !== undefined && (typeof body.cumulativeSpentBaseUnits !== 'string' || !/^(0|[1-9][0-9]{0,29})$/.test(body.cumulativeSpentBaseUnits))) {
        return sendJson(res, 400, {error: 'Invalid cumulative spend'});
      }
      const decision = evaluateDeterministicPolicy(proposal, mandate, {
        humanApproved: body.humanApproved,
        independentVerifications: body.independentVerifications,
        cumulativeSpent: typeof body.cumulativeSpentBaseUnits === 'string' && /^(0|[1-9][0-9]{0,29})$/.test(body.cumulativeSpentBaseUnits) ? BigInt(body.cumulativeSpentBaseUnits) : 0n
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
        schema: 'custom-demo-merkle-sha256',
        limitation: 'No independent checkpoint or verification of history',
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
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(fs.readFileSync(indexPath, 'utf8'));
        return;
      }
    }

    const assets = {'/chat.css':['chat.css','text/css'], '/mvp.css':['mvp.css','text/css'], '/sw.js':['sw.js','text/javascript'], '/manifest.webmanifest':['manifest.webmanifest','application/manifest+json'], '/icon.svg':['icon.svg','image/svg+xml'], '/icon-192.png':['icon-192.png','image/png'], '/icon-512.png':['icon-512.png','image/png'], '/app.js':['build/app.js','text/javascript'], '/app.css':['app.css','text/css'], '/notebook.css':['notebook.css','text/css'], '/app.js.LEGAL.txt':['build/app.js.LEGAL.txt','text/plain'], '/investigate.js': ['investigate.js', 'text/javascript'], '/investigate.css': ['investigate.css', 'text/css']};
    if (req.method === 'GET' && assets[pathname]) {
      const [file, type] = assets[pathname];
      res.writeHead(200, {'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-cache'});
      return res.end(fs.readFileSync(path.join(ROOT_DIR, 'apps/web', file)));
    }
    // Default 404
    sendJson(res, 404, { error: 'Route not found', path: pathname });
  } catch (err) {
    console.error('Server processing error:', err);
    sendJson(res, 400, { error: 'Invalid request' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`=======================================================`);
  console.log(` PhishNet Mobile App & API Server Running`);
  console.log(` Local URL:   http://127.0.0.1:${PORT}`);
  console.log(` Network URL: http://${HOST}:${PORT}`);
  console.log(` Payments:    Human-approved Arc Testnet wallet`);
  console.log(` Legacy APIs: SIMULATION (no server signing)`);
  console.log(` Protocols:   AP2/x402-inspired examples`);
  console.log(` Analysis:    local advisory heuristics`);
  console.log(`=======================================================`);
});

process.on('SIGTERM',()=>server.close(()=>{journal.close();process.exit(0);}));
