import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
// External test signer models the human; its seed is NEVER given to the API process.
import {generateKeypair,signDecision} from '@countersignlabs/counter-sign';
import {privateKeyToAccount} from 'viem/accounts';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
const human=generateKeypair(),attacker=generateKeypair(),owner=privateKeyToAccount('0x'+'6'.repeat(64)),other=privateKeyToAccount('0x'+'7'.repeat(64));
const port=39000+Math.floor(Math.random()*3000),origin=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['apps/api/src/server.js'],{env:{PHISHNET_DATA_DIR:mkdtempSync(tmpdir()+'/phishnet-http-'),...process.env,PORT:String(port),HOST:'127.0.0.1',COUNTERSIGN_APPROVER_PUBLIC_KEY:human.publicKey},stdio:['ignore','pipe','pipe']});
let errors='';server.stderr.on('data',c=>errors+=c);
const payment={from:owner.address,to:other.address,amount:'0.02'};
async function call(path,body,{cookie='',wallet=''}={}){const headers={...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...(wallet?{'X-PhishNet-Wallet':wallet}:{})};const res=await fetch(origin+path,{...(body?{method:'POST',headers,body:JSON.stringify(body)}:{headers}),signal:AbortSignal.timeout(5000)});return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};}
async function login(account){const c=await call('/v1/gateway/auth/challenge',{wallet:account.address});const r=await call('/v1/gateway/auth/login',{challengeId:c.body.challengeId,wallet:account.address,signature:await account.signMessage({message:c.body.message})});assert.equal(r.status,200);return {cookie:r.cookie,wallet:account.address};}
try{
 let ready=false;for(let i=0;i<60;i++){try{if((await call('/v1/testnet/consent/config')).status===200){ready=true;break;}}catch{}await delay(100);}assert.ok(ready,errors);
 const config=(await call('/v1/testnet/consent/config')).body;assert.equal(config.configured,true);assert.equal(config.approverPublicKey,human.publicKey);assert.ok(!JSON.stringify(config).includes('secretKey'));console.log('PASS configured profile exposes public identity only');
 assert.equal((await call('/v1/testnet/consent/intent',payment)).status,401);console.log('PASS unauthenticated consent intent mutation refused');
 const scope=await login(owner),foreign=await login(other);
 assert.equal((await call('/v1/testnet/consent/intent',payment,foreign)).status,403);console.log('PASS cross-wallet consent intent creation refused');
 const request=await call('/v1/testnet/consent/intent',payment,scope);assert.equal(request.status,200);const intent=request.body.intent;
 const resolution=key=>({decision:'approve',policy:'approver',countersignatures:[signDecision(intent,'approve','human:owner',key.secretKey)]});
 assert.equal((await call('/v1/testnet/consent/consume',{intentId:intent.intent_id,payment},scope)).status,400);console.log('PASS missing consent cannot be consumed');
 assert.equal((await call('/v1/testnet/consent/receipt',{intentId:intent.intent_id,payment,resolution:resolution(attacker)},scope)).status,400);console.log('PASS external attacker key cannot mint human approval');
 assert.equal((await call('/v1/testnet/consent/receipt',{intentId:intent.intent_id,payment,resolution:resolution(human)},scope)).body.status,'APPROVED');console.log('PASS real externally signed protocol receipt accepted');
 assert.equal((await call('/v1/testnet/consent/consume',{intentId:intent.intent_id,payment:{...payment,amount:'0.03'}},scope)).status,400);console.log('PASS changed transaction cannot consume receipt');
 assert.equal((await call('/v1/testnet/consent/consume',{intentId:intent.intent_id,payment},scope)).body.status,'CONSUMED');assert.equal((await call('/v1/testnet/consent/consume',{intentId:intent.intent_id,payment},scope)).status,400);console.log('PASS exact payment consumes once; replay fails');
 console.log('8/8 authenticated consent HTTP checks passed. Real protocol signatures; no wallet or blockchain transfer.');
}catch(error){console.error(error);process.exitCode=1;}finally{server.kill();await Promise.race([new Promise(r=>server.once('exit',r)),delay(1000)]);}
