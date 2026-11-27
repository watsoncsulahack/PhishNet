import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {Journal} from '../packages/journal/src/journal.js';
const wallet='0x'+'1'.repeat(40),other='0x'+'2'.repeat(40),scope={chainId:5042002,address:wallet};
function temporary(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'phishnet-journal-'));return {dir,j:new Journal(dir),cleanup:()=>fs.rmSync(dir,{recursive:true,force:true})};}
function chat(j,trace='trace-test'){const content=j.putContent(wallet,'private@example.invalid: pay my invoice');return j.append({traceId:trace,eventType:'chat.user.submitted',walletScope:scope,actor:{id:'human:test',type:'human'},payload:content},'ui-gateway');}
test('journal survives restart with stable event identity, sequence, source and key',()=>{const t=temporary();const e=chat(t.j),key=t.j.signer('recorder').publicKey;t.j.close();t.j=new Journal(t.dir);assert.equal(t.j.events(wallet)[0].eventId,e.eventId);assert.equal(t.j.signer('recorder').publicKey,key);assert.equal(chat(t.j).sequence,2);assert.equal(t.j.verifyLocal().count,2);t.j.close();t.cleanup();});
test('private source is encrypted separately and inaccessible across wallet scope',()=>{const t=temporary(),e=chat(t.j);assert.equal(t.j.content(wallet,e.payload.contentRef),'private@example.invalid: pay my invoice');assert.throws(()=>t.j.content(other,e.payload.contentRef));const row=t.j.db.prepare('SELECT ciphertext FROM contents').get();assert.ok(!JSON.stringify(row).includes('private@example'));assert.ok(!JSON.stringify(e).includes('private@example'));assert.equal(t.j.events(other).length,0);t.j.close();t.cleanup();});
test('invalid/cross-wallet parent, self-assigned approval and schema failure leave no records',()=>{const t=temporary(),e=chat(t.j);const draft={traceId:'trace-test',eventType:'agent.plan.reported',walletScope:scope,actor:{id:'agent:test',type:'agent'},payload:{...t.j.putContent(wallet,'agent report'),sourceEventIds:[e.eventId]},links:{parentEventIds:[e.eventId]}};const accepted=t.j.append(draft,'agent-gateway');assert.equal(accepted.verification.state,'AGENT_REPORTED');assert.throws(()=>t.j.append({...draft,verification:{state:'RPC_VERIFIED'}},'agent-gateway'));assert.throws(()=>t.j.append({...draft,walletScope:{...scope,address:other}},'agent-gateway'));assert.throws(()=>t.j.append({...draft,links:{parentEventIds:['future']}},'agent-gateway'));assert.throws(()=>t.j.append({...draft,eventType:'countersign.resolution.verified'},'agent-gateway'));assert.equal(t.j.verifyLocal().count,2);t.j.close();t.cleanup();});
test('SQL append-only protections and atomic rollback prevent partial observations',()=>{const t=temporary();chat(t.j);assert.throws(()=>t.j.db.exec('DELETE FROM events'));assert.throws(()=>t.j.transaction(()=>{chat(t.j);throw Error('fail');}));assert.equal(t.j.verifyLocal().count,1);t.j.close();t.cleanup();});
test('naive offline alteration is detected; no external-anchoring claim is made',()=>{const t=temporary();chat(t.j);t.j.db.exec('DROP TRIGGER events_no_update');t.j.db.prepare('UPDATE events SET digest=?').run('f'.repeat(64));assert.throws(()=>t.j.verifyLocal(),/integrity/);t.j.close();assert.throws(()=>new Journal(t.dir),/integrity/);t.cleanup();});
test('wallet journal export and import preserve content, digests and append-only chain idempotently',()=>{
  const a=temporary(),b=temporary();
  try{
    const c1=chat(a.j,'trace-export');
    const plan={traceId:'trace-export',eventType:'agent.plan.reported',walletScope:scope,actor:{id:'agent:test',type:'agent'},payload:{...a.j.putContent(wallet,'secret plan'),sourceEventIds:[c1.eventId]},links:{parentEventIds:[c1.eventId]}};
    a.j.append(plan,'agent-gateway');
    const bundle=a.j.exportWallet(wallet);
    assert.equal(bundle.events.length,2);
    assert.equal(Object.keys(bundle.contents).length,2);
    assert.throws(()=>b.j.importWallet(other,bundle),/another wallet/);
    const tampered=structuredClone(bundle);tampered.events[0].traceId='tampered';
    assert.throws(()=>b.j.importWallet(wallet,tampered),/Invalid EventTraceV1|digest/);
    const first=b.j.importWallet(wallet,bundle);
    assert.equal(first.imported,2);assert.equal(first.skipped,0);
    assert.equal(b.j.content(wallet,c1.payload.contentRef),'private@example.invalid: pay my invoice');
    assert.equal(b.j.verifyLocal().count,2);
    const second=b.j.importWallet(wallet,bundle);
    assert.equal(second.imported,0);assert.equal(second.skipped,2);
    assert.equal(b.j.verifyLocal().count,2);
  }finally{a.j.close();a.cleanup();b.j.close();b.cleanup();}
});
