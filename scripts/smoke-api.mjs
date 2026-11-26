#!/usr/bin/env node
// Safe loopback PhishNet API smoke test. This is NOT a payment-security certification.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 34000 + Math.floor(Math.random()*10000);
const origin = 'http://127.0.0.1:' + port;
const { HOST: _host, ...serverEnv } = process.env;
const server = spawn(process.execPath, [path.join(root,'apps/api/src/server.js')], {
  cwd: root, env: {...serverEnv, PORT:String(port)}, stdio:['ignore','pipe','pipe']
});
let stderr='', stdout='';
server.stderr.on('data',chunk=>{stderr+=chunk.toString()});
server.stdout.on('data',chunk=>{stdout+=chunk.toString()});
let passed=0, failed=0;
async function get(endpoint){
  const res=await fetch(origin+endpoint,{signal:AbortSignal.timeout(5000)});
  return {status:res.status,body:await res.json()};
}
async function post(endpoint,body){
  const res=await fetch(origin+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
  return {status:res.status,body:await res.json()};
}
async function test(name,fn){
  try{await fn();passed++;console.log('PASS '+name);}
  catch(err){failed++;console.error('FAIL '+name+': '+err.message);}
}
const inFuture=new Date(Date.now()+86400000).toISOString();
const inPast=new Date(Date.now()-86400000).toISOString();
const earlier=new Date(Date.now()-3600000).toISOString();
const mandate={
  mandateId:'smoke-mandate',chainId:'5042002',assetContract:'USDC',
  allowedRecipient:'0x1111111111111111111111111111111111111111',
  amountMaxBaseUnits:'250000000',cumulativeBudgetBaseUnits:'500000000',
  spentBaseUnits:'0', validAfter:earlier,validUntil:inFuture,
  nonce:'smoke-unused',purposeCode:'testing'
};
const proposal={
  requestId:'smoke-request',sessionId:'smoke-session',mandateId:'smoke-mandate',
  chainId:'5042002',assetContract:'USDC',recipient:mandate.allowedRecipient,
  amountBaseUnits:'20000',nonce:'smoke-nonce-1',purposeCode:'testing',
  sourceEventIds:[]
};
try{
  let started=false;
  for(let attempt=0;attempt<45;attempt++){
    if(server.exitCode!==null)break;
    try{const r=await get('/v1/health');if(r.status===200){started=true;break;}}catch{}
    await delay(120);
  }
  assert.ok(started,'server startup failed: '+stderr.slice(0,500)+' '+stdout.slice(0,300));
  await test('health endpoint responds',async()=>{
    const r=await get('/v1/health');
    assert.equal(r.status,200);assert.equal(r.body.chainId,'5042002');
  });
  await test('scenario fixtures are retrievable',async()=>{
    const r=await get('/v1/scenarios');
    assert.equal(r.status,200);assert.ok(Array.isArray(r.body));
    assert.ok(r.body.some(s=>s.scenarioId==='vendor-swap'));
  });
  await test('behavioral analysis returns an advisory not an authority token',async()=>{
    const scenarios=(await get('/v1/scenarios')).body;
    const r=await post('/v1/analyze',{events:scenarios[0].events});
    assert.equal(r.status,200);
    assert.ok(['ADVISORY_CLEAR','REVIEW','ESCALATE'].includes(r.body.recommendation));
    assert.ok(Array.isArray(r.body.manipulationIndicators));
  });
  async function expectDecision(label,p,m,options,expected,reason){
    await test(label,async()=>{
      const r=await post('/v1/preflight',{proposal:p,mandate:m,...options});
      assert.equal(r.status,200);
      assert.equal(r.body.decision,expected);
      if(reason)assert.ok(r.body.reasonCodes.includes(reason),'missing reason '+reason);
    });
  }
  await expectDecision('valid low-value proposal allowed',proposal,mandate,{},'ALLOW','SIMULATION_WITHIN_POLICY');
  await expectDecision('wrong recipient rejected',{...proposal,recipient:'0x2222222222222222222222222222222222222222'},mandate,{},'DENY','RECIPIENT_MISMATCH');
  await expectDecision('wrong chain rejected',{...proposal,chainId:'1'},mandate,{},'DENY','CHAIN_NOT_ALLOWED');
  await expectDecision('over-limit amount rejected',{...proposal,amountBaseUnits:'250000001'},mandate,{},'DENY','AMOUNT_EXCEEDS_LIMIT');
  await expectDecision('expired mandate rejected',proposal,{...mandate,validUntil:inPast},{},'DENY','EXPIRED_MANDATE');
  // Replay-state end-to-end tests are not covered by this read-only preflight smoke test.
  await expectDecision('high-value proposal held pending approval',{...proposal,amountBaseUnits:'75000000'},mandate,{},'HOLD','MISSING_REQUIRED_APPROVAL');
  await expectDecision('client approval cannot authorize high-value proposal', {...proposal,amountBaseUnits:'75000000'}, mandate, {humanApproved:true}, 'HOLD', 'MISSING_REQUIRED_APPROVAL');
  await expectDecision('client verification cannot authorize changed recipient', {...proposal,recipient:'0x2222222222222222222222222222222222222222'}, mandate, {humanApproved:true,independentVerifications:[{targetRecipient:'0x2222222222222222222222222222222222222222',isIndependent:true}]}, 'DENY', 'RECIPIENT_MISMATCH');
  await expectDecision('zero amount denied', {...proposal,amountBaseUnits:'0'}, mandate, {}, 'DENY', 'INVALID_AMOUNT');
  await expectDecision('malformed amount denied', {...proposal,amountBaseUnits:'1.5'}, mandate, {}, 'DENY', 'INVALID_INPUT');
  await expectDecision('negative amount denied', {...proposal,amountBaseUnits:'-1'}, mandate, {}, 'DENY', 'INVALID_INPUT');
  await test('simulation receipt has no explorer link',async()=>{
    const r=await post('/v1/x402/settle',{nonce:'smoke-simulated-receipt'});
    assert.equal(r.status,200); assert.equal(r.body.xPaymentReceipt.status,'SIMULATED');
    assert.equal(r.body.xPaymentReceipt.environment,'SIMULATION');
    assert.equal(r.body.xPaymentReceipt.explorerUrl,undefined);
  });
  console.log('Smoke tests: '+passed+' passed, '+failed+' failed.');
  console.log('LIMITATION: This does not validate signatures, live settlement, persistence, authorization independence or prompt injection safety.');
  if(failed)process.exitCode=1;
}catch(err){
  console.error('FAIL server smoke test: '+err.stack);
  process.exitCode=1;
}finally{
  server.kill('SIGTERM');
  await Promise.race([new Promise(r=>server.once('exit',r)),delay(1500)]);
  if(server.exitCode===null)server.kill('SIGKILL');
}
