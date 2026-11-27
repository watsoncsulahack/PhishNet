// Local agent runner bridge: polls PhishNet loopback jobs and dispatches to the active backend (antigravity | codex | custom).
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {BACKENDS,dispatchJob,execBackend,normalizeBackend} from '../packages/agent/src/bridge.js';

const localConfig=fileURLToPath(new URL('../.env.local',import.meta.url));
if(existsSync(localConfig))process.loadEnvFile(localConfig);

const base=new URL(process.env.PHISHNET_URL||'http://127.0.0.1:3001');
if(!['127.0.0.1','localhost','[::1]'].includes(base.hostname)||base.protocol!=='http:')throw Error('Agent bridge accepts the local loopback gateway only.');
const credential=process.env.PHISHNET_AGENT_TOKEN;
if(!credential)throw Error('Set PHISHNET_AGENT_TOKEN in .env.local from Settings.');

function parseArgs(argv){
  const opts={once:false,pollMs:2500,backend:null,model:''};
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--once')opts.once=true;
    else if(argv[i]==='--backend'&&argv[i+1])opts.backend=normalizeBackend(argv[++i]);
    else if(argv[i]==='--poll-ms'&&argv[i+1])opts.pollMs=Math.max(500,Number(argv[++i])||2500);
    else if(argv[i]==='--model'&&argv[i+1])opts.model=argv[++i];
  }
  return opts;
}

const opts=parseArgs(process.argv.slice(2));
async function api(endpoint,options={}){
  const res=await fetch(new URL(endpoint,base),{...options,headers:{...options.headers,Authorization:'Bearer '+credential},signal:AbortSignal.timeout(20000)});
  const data=await res.json();
  if(!res.ok)throw Error(data.error||'Gateway refused request.');
  return data;
}
const client={
  status:()=>api('/v1/agent/status'),
  jobs:()=>api('/v1/agent/jobs'),
  tool:(tool,argumentsObj)=>api('/v1/agent/tool',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool,arguments:argumentsObj})})
};

let lastBackend=null;
async function cycle(){
  const status=await client.status();
  const active=opts.backend||status.backend||normalizeBackend(process.env.PHISHNET_AGENT_BACKEND||'manual');
  if(active!==lastBackend){
    lastBackend=active;
    console.log(`[phishnet-bridge] Active backend: ${BACKENDS[active]?.label||active} (${active}) · wallet ${status.wallet}`);
  }
  if(active==='manual')return;
  const jobs=await client.jobs();
  for(const job of jobs){
    console.log(`[phishnet-bridge] Processing chat ${job.chatId} via ${active}...`);
    const result=await dispatchJob(client,job,{backend:active,exec:(b,prompt)=>execBackend(b,prompt,{model:opts.model})});
    console.log(`[phishnet-bridge] Recorded reply ${result.responseEventId}${result.proposalId?' and unsigned proposal '+result.proposalId:''}`);
  }
}

if(opts.once){
  await cycle();
}else{
  console.log('[phishnet-bridge] Polling local PhishNet gateway. Press Ctrl+C to stop.');
  for(;;){
    try{await cycle();}catch(err){console.error('[phishnet-bridge] Error:',err.message);}
    await new Promise(r=>setTimeout(r,opts.pollMs));
  }
}
