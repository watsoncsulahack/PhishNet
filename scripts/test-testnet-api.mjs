import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {request as httpRequest} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
const port=35000+Math.floor(Math.random()*5000),origin=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['apps/api/src/server.js'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
let stderr='';server.stderr.on('data',chunk=>stderr+=chunk);let passed=0;
const request=(path,init={})=>fetch(origin+path,{...init,signal:AbortSignal.timeout(5000)});
async function check(name,fn){await fn();console.log('PASS '+name);passed++;}
const post=(path,body,headers={})=>request(path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
try{
  let ready=false;for(let i=0;i<60;i++){try{if((await request('/v1/health')).ok){ready=true;break;}}catch{}await delay(100);}assert.ok(ready,'Server startup: '+stderr);
  await check('invalid balance address rejected before network read',async()=>assert.equal((await request('/v1/testnet/balance?address=bad')).status,400));
  await check('malformed amount rejected before quote',async()=>assert.equal((await post('/v1/testnet/quote',{from:'0x'+'1'.repeat(40),to:'0x'+'2'.repeat(40),amount:'1e2'})).status,400));
  await check('extra chain/calldata cannot enter payment',async()=>assert.equal((await post('/v1/testnet/quote',{from:'0x'+'1'.repeat(40),to:'0x'+'2'.repeat(40),amount:'0.02',chainId:1,data:'0xabcd'})).status,400));
  await check('fabricated receipt hash rejected',async()=>assert.equal((await post('/v1/testnet/receipt',{hash:'fake'})).status,400));
  await check('foreign Origin rejected without wildcard CORS',async()=>{const res=await request('/v1/testnet/network',{headers:{Origin:'https://attacker.invalid'}});assert.equal(res.status,403);assert.equal(res.headers.get('Access-Control-Allow-Origin'),null);});
  await check('unexpected Host rejected',async()=>assert.equal(await new Promise((resolve,reject)=>{const req=httpRequest(origin+'/v1/testnet/network',{headers:{Host:'attacker.invalid'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();}),403));
  await check('non-JSON quote rejected',async()=>assert.equal((await request('/v1/testnet/quote',{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'})).status,415));
  await check('no testnet signing/broadcast endpoint',async()=>assert.equal((await post('/v1/testnet/send',{})).status,404));
  await check('security headers on app and read-only API',async()=>{for(const path of ['/','/v1/testnet/balance?address=bad']){const res=await request(path);assert.equal(res.headers.get('X-Content-Type-Options'),'nosniff');assert.equal(res.headers.get('X-Frame-Options'),'DENY');assert.ok(res.headers.get('Content-Security-Policy').includes("connect-src 'self'"));}});
  console.log(`${passed}/9 actual HTTP testnet boundary checks passed. No network payment sent.`);
}catch(error){console.error(error);process.exitCode=1;}
finally{server.kill();await Promise.race([new Promise(r=>server.once('exit',r)),delay(1000)]);}
