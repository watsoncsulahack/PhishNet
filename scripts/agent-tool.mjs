// Generic BYO local-agent client: typed reads and unsigned proposals only. No model or signer.
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const localConfig=fileURLToPath(new URL('../.env.local',import.meta.url));
if(existsSync(localConfig))process.loadEnvFile(localConfig);
const base=new URL(process.env.PHISHNET_URL||'http://127.0.0.1:3001');
if(!['127.0.0.1','localhost','[::1]'].includes(base.hostname)||base.protocol!=='http:')throw Error('Agent client accepts the local loopback gateway only.');
const credential=process.env.PHISHNET_AGENT_TOKEN;if(!credential)throw Error('Set PHISHNET_AGENT_TOKEN from Settings on the human-controlled app.');
const [command,name,args]=process.argv.slice(2);let endpoint,options;
if(command==='status'){endpoint='/v1/agent/status';options={};}
else if(command==='jobs'){endpoint='/v1/agent/jobs';options={};}
else if(command==='tool'){endpoint='/v1/agent/tool';options={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool:name,arguments:JSON.parse(args||'{}')})};}
else throw Error('Usage: node scripts/agent-tool.mjs status | jobs | tool wallet.balance|chat.read|plan.report|chat.respond|payment.propose JSON_ARGUMENTS');
const res=await fetch(new URL(endpoint,base),{...options,headers:{...options.headers,Authorization:'Bearer '+credential},signal:AbortSignal.timeout(20000)});const data=await res.json();if(!res.ok)throw Error(data.error||'Gateway refused request.');process.stdout.write(JSON.stringify(data,null,2)+'\n');
