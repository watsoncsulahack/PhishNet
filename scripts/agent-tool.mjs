// Generic BYO local-agent client: typed reads, unsigned proposals, and backend profile switching. No model or signer.
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
import {BACKENDS,normalizeBackend} from '../packages/agent/src/bridge.js';

const localConfig=fileURLToPath(new URL('../.env.local',import.meta.url));
if(existsSync(localConfig))process.loadEnvFile(localConfig);
const base=new URL(process.env.PHISHNET_URL||'http://127.0.0.1:3001');
if(!['127.0.0.1','localhost','[::1]'].includes(base.hostname)||base.protocol!=='http:')throw Error('Agent client accepts the local loopback gateway only.');

const [command,name,args]=process.argv.slice(2);
if(command==='use'){
  const next=normalizeBackend(name);
  const existing=existsSync(localConfig)?readFileSync(localConfig,'utf8'):'# Local testing only. Never commit this file.\n';
  const updated=/^PHISHNET_AGENT_BACKEND=.*$/m.test(existing)?existing.replace(/^PHISHNET_AGENT_BACKEND=.*$/m,`PHISHNET_AGENT_BACKEND=${next}`):existing.trimEnd()+`\nPHISHNET_AGENT_BACKEND=${next}\n`;
  writeFileSync(localConfig,updated,{mode:0o600});
  const dataDir=process.env.PHISHNET_DATA_DIR||fileURLToPath(new URL('../.data',import.meta.url));
  const dbPath=path.join(dataDir,'journal.sqlite');
  if(existsSync(dbPath)){
    const db=new DatabaseSync(dbPath);
    db.exec('PRAGMA busy_timeout=5000;');
    db.prepare("INSERT INTO metadata VALUES('agent_backend',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(next);
    db.close();
  }
  process.stdout.write(JSON.stringify({backend:next,label:BACKENDS[next].label,envFile:'.env.local'},null,2)+'\n');
  process.exit(0);
}

const credential=process.env.PHISHNET_AGENT_TOKEN;
if(!credential)throw Error('Set PHISHNET_AGENT_TOKEN from Settings on the human-controlled app.');
let endpoint,options;
if(command==='status'){endpoint='/v1/agent/status';options={};}
else if(command==='jobs'){endpoint='/v1/agent/jobs';options={};}
else if(command==='tool'){endpoint='/v1/agent/tool';options={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool:name,arguments:JSON.parse(args||'{}')})};}
else throw Error('Usage: node scripts/agent-tool.mjs status | jobs | use antigravity|codex|custom|manual | tool wallet.balance|chat.read|plan.report|chat.respond|payment.propose JSON_ARGUMENTS');
const res=await fetch(new URL(endpoint,base),{...options,headers:{...options.headers,Authorization:'Bearer '+credential},signal:AbortSignal.timeout(20000)});
const data=await res.json();
if(!res.ok)throw Error(data.error||'Gateway refused request.');
process.stdout.write(JSON.stringify(data,null,2)+'\n');
