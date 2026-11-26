// External test signer models the human; its seed is NEVER given to the API process.
import {generateKeypair,signDecision} from '@countersignlabs/counter-sign';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
const human=generateKeypair(),attacker=generateKeypair(),port=39000+Math.floor(Math.random()*3000),origin=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['apps/api/src/server.js'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1',COUNTERSIGN_APPROVER_PUBLIC_KEY:human.publicKey},stdio:['ignore','pipe','pipe']});
let errors='';server.stderr.on('data',c=>errors+=c);
const payment={from:'0x'+'1'.repeat(40),to:'0x'+'2'.repeat(40),amount:'0.02'};
async function call(path,body){const res=await fetch(origin+'/v1/testnet/consent/'+path,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(5000)});return {status:res.status,body:await res.json()};}
try{
 let ready=false;for(let i=0;i<60;i++){try{if((await call('config')).status===200){ready=true;break;}}catch{}await delay(100);}assert.ok(ready,errors);
 const config=(await call('config')).body;assert.equal(config.configured,true);assert.equal(config.approverPublicKey,human.publicKey);assert.ok(!JSON.stringify(config).includes('secretKey'));console.log('PASS configured profile exposes public identity only');
 const request=await call('intent',payment);assert.equal(request.status,200);const intent=request.body.intent;
 const resolution=key=>({decision:'approve',policy:'approver',countersignatures:[signDecision(intent,'approve','human:owner',key.secretKey)]});
 assert.equal((await call('consume',{intentId:intent.intent_id,payment})).status,400);console.log('PASS missing consent cannot be consumed');
 assert.equal((await call('receipt',{intentId:intent.intent_id,payment,resolution:resolution(attacker)})).status,400);console.log('PASS external attacker key cannot mint human approval');
 assert.equal((await call('receipt',{intentId:intent.intent_id,payment,resolution:resolution(human)})).body.status,'APPROVED');console.log('PASS real externally signed protocol receipt accepted');
 assert.equal((await call('consume',{intentId:intent.intent_id,payment:{...payment,amount:'0.03'}})).status,400);console.log('PASS changed transaction cannot consume receipt');
 assert.equal((await call('consume',{intentId:intent.intent_id,payment})).body.status,'CONSUMED');assert.equal((await call('consume',{intentId:intent.intent_id,payment})).status,400);console.log('PASS exact payment consumes once; replay fails');
 console.log('6/6 consent HTTP checks passed. Real protocol signatures; no wallet or blockchain transfer.');
}catch(error){console.error(error);process.exitCode=1;}finally{server.kill();await Promise.race([new Promise(r=>server.once('exit',r)),delay(1000)]);}
