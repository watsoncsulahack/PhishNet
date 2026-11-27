import {test} from 'node:test';import assert from 'node:assert/strict';
import {projectJournal} from '../packages/provenance/src/live.js';
import {createZip,parseZip} from '../packages/journal/src/zip.js';
const wallet='0x'+'1'.repeat(40),other='0x'+'2'.repeat(40);
const event=(id,type,payload={},parents=[])=>({eventId:id,eventType:type,traceId:'trace-1',walletScope:{address:wallet},recordedAt:'2026-11-26T12:00:00.000Z',payload,relations:parents.map(eventId=>({eventId,kind:'OBSERVED_REFERENCE',evidenceIds:[eventId]}))});
const events=[event('p','payment.proposed',{from:wallet,recipient:other,initiator:'human'}),event('auth','wallet.authorization.requested',{},['p']),event('hash','wallet.submission.observed',{},['auth']),event('receipt','chain.receipt.checked',{},['hash'])];
test('four independent visibility states preserve originals and shared IDs without invented agent notes',()=>{for(const [transactionFlow,decisionHistory] of [[true,false],[false,true],[true,true],[false,false]]){const view=projectJournal(events,{wallet,transactionFlow,decisionHistory});assert.equal(view.events.length,transactionFlow?(decisionHistory?4:3):decisionHistory?2:0);assert.equal(new Set(view.nodes.map(n=>n.id)).size,view.nodes.length);assert.ok(!view.nodes.some(n=>n.kind==='agent'));for(const node of view.nodes)assert.ok(events.includes(node.event));}assert.equal(projectJournal(events,{wallet}).nodes.filter(n=>n.id==='p').length,1);});
test('scope, dates, trace and text filters never bridge omitted provenance or expose another wallet',()=>{const original=JSON.stringify(events);assert.equal(projectJournal(events,{wallet:other}).nodes.length,0);assert.equal(projectJournal(events,{wallet,from:'2026-11-27'}).nodes.length,0);assert.equal(projectJournal(events,{wallet,trace:'trace-other'}).nodes.length,0);const v=projectJournal(events,{wallet,decisionHistory:false});assert.ok(!v.edges.some(e=>e.source==='p'&&e.target==='hash'));assert.equal(JSON.stringify(events),original);});
test('only actual agent-reported events produce agent nodes; imports remain exact observations',()=>{const report=event('reported','agent.plan.reported',{contentRef:'encrypted-reference'}),imp=event('import','history.imported',{from:wallet,recipient:other});const v=projectJournal([report,imp],{wallet});assert.equal(v.nodes.filter(n=>n.kind==='agent').length,1);assert.equal(v.events.length,2);assert.equal(v.nodes.find(n=>n.id==='reported').event,report);});
test('synced on-chain faucet transactions appear in Transaction Flow with wallet/asset entities, never Decision History',()=>{const faucet=event('faucet-1','chain.transaction.observed',{txHash:'0x'+'a'.repeat(64),from:other,recipient:wallet,amountBaseUnits:'10000000000000000000',direction:'incoming',asset:'native-USDC',decimals:18,chainId:5042002,blockNumber:'12',source:'rpc-native-tx'});const flowOnly=projectJournal([faucet],{wallet,transactionFlow:true,decisionHistory:false});assert.equal(flowOnly.events.length,1);assert.ok(flowOnly.nodes.some(n=>n.id==='faucet-1'&&n.kind==='receipt'));assert.ok(flowOnly.nodes.some(n=>n.id==='wallet:5042002:'+other));assert.ok(flowOnly.nodes.some(n=>n.id==='wallet:5042002:'+wallet));assert.ok(flowOnly.nodes.some(n=>n.id==='asset:5042002:native-USDC'));assert.equal(flowOnly.edges.filter(e=>e.source==='faucet-1'||e.target==='faucet-1').length,3);const decisionsOnly=projectJournal([faucet],{wallet,transactionFlow:false,decisionHistory:true});assert.equal(decisionsOnly.events.length,0);assert.equal(decisionsOnly.nodes.length,0);});
test('compact mode condenses internal steps into explorable clusters while keeping core story connected',()=>{
  const rich=[
    event('u1','chat.user.submitted',{},[]),
    event('t1','agent.tool.requested',{tool:'chat.read'},['u1']),
    event('t2','tool.result.observed',{tool:'chat.read'},['t1']),
    event('pl1','agent.plan.reported',{},['t2']),
    event('p1','payment.proposed',{from:wallet,recipient:other,initiator:'agent'},['pl1']),
    event('v1','payment.validated',{},['p1']),
    event('pol1','policy.evaluated',{decision:'HOLD'},['v1']),
    event('ci1','countersign.intent.created',{},['pol1']),
    event('cr1','countersign.resolution.verified',{decision:'approve'},['ci1'])
  ];
  const compactView=projectJournal(rich,{wallet,compact:true});
  assert.equal(compactView.events.length,rich.length);
  assert.equal(compactView.condensedCount,5);
  const clusters=compactView.nodes.filter(n=>n.kind==='cluster');
  assert.equal(clusters.length,2);
  assert.equal(clusters[0].label,'+2 details');
  assert.equal(clusters[1].label,'+3 details');
  assert.ok(compactView.edges.some(e=>e.source==='u1'&&e.target===clusters[0].id));
  assert.ok(compactView.edges.some(e=>e.source===clusters[0].id&&e.target==='pl1'));
  assert.ok(compactView.edges.some(e=>e.source==='p1'&&e.target===clusters[1].id));
  assert.ok(compactView.edges.some(e=>e.source===clusters[1].id&&e.target==='cr1'));
});
test('pure-JS STORE zip roundtrip validates CRC-32 and rejects tampered archives',()=>{
  const rawZip=createZip([{name:'manifest.json',data:'{"ok":true}'},{name:'journal.enc',data:new Uint8Array([1,2,3,4,5])}]);
  const parsed=parseZip(rawZip);
  assert.equal(new TextDecoder().decode(parsed.get('manifest.json')),'{"ok":true}');
  assert.deepEqual([...parsed.get('journal.enc')],[1,2,3,4,5]);
  const corrupted=new Uint8Array(rawZip);corrupted[45]^=0xff;
  assert.throws(()=>parseZip(corrupted),/CRC-32|Corrupted|Truncated/);
});
