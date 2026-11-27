/** Local agent backend selector & structured PhishNet job dispatcher. No signing capability. */
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';

const execFileAsync=promisify(execFile);

export const BACKENDS=Object.freeze({
  antigravity:{id:'antigravity',label:'Antigravity (Gemini)',aliases:['agy','gemini']},
  codex:{id:'codex',label:'Codex',aliases:['openai-codex']},
  custom:{id:'custom',label:'Custom local command',aliases:[]},
  manual:{id:'manual',label:'Manual / interactive CLI',aliases:['cli']}
});

export function normalizeBackend(value){
  const v=String(value||'').trim().toLowerCase();
  for(const entry of Object.values(BACKENDS)){
    if(entry.id===v||entry.aliases.includes(v))return entry.id;
  }
  throw Error('Unknown agent backend. Choose antigravity, codex, custom, or manual.');
}

export function buildPrompt(job){
  const snap=job.walletSnapshot||{};
  const walletLine=snap.wallet?`Connected wallet: ${snap.wallet} (Arc Testnet chainId 5042002)`:'';
  const balanceLine=snap.balanceUSDC?`Current native USDC balance: ${snap.balanceUSDC} USDC`:'';
  const txLines=(snap.recentTransactions||[]).slice(0,15).map(t=>`- [${t.direction}] ${t.amountUSDC} USDC | from: ${t.from} | to: ${t.recipient} | block: ${t.blockNumber||'?'} | tx: ${t.txHash} | source: ${t.source} (${t.verification})`).join('\n');
  const propLines=(snap.recentProposals||[]).slice(0,8).map(p=>`- ${p.proposalId} [${p.status}] ${p.amount} USDC -> ${p.to}${p.txHash?' tx:'+p.txHash:''}`).join('\n');
  const contextText=(job.context||[]).map(c=>`[${c.recordedAt}] ${c.type} (${c.eventId}): ${c.text}`).join('\n');
  const selectedText=(job.selectedItems||[]).length?`\nSelected items:\n${JSON.stringify(job.selectedItems,null,2)}`:'';
  return [
    'You are acting as a local PhishNet wallet assistant behind a strict capability boundary.',
    'Rules:',
    '- You have NO signing authority, NO approval authority, and CANNOT execute transactions.',
    '- Use the Wallet context below directly. When the user asks about their balance, faucet sender, or recent deposits/transfers, look up the exact 0x address and amount from Observed transfers below.',
    '- When the user asks to test or prepare sending a payment (including sending back to a faucet address or recent sender), populate "proposal": { "to": "<exact 0x address>", "amount": "<USDC amount>", "purpose": "<short reason>" } so the user gets an interactive Review & Sign card.',
    '- Never invent balances, confirmations, or verified merchant claims.',
    '- Output ONLY a single JSON object with keys: "plan", "replyText", "items", "proposal".',
    '- "plan": short string explaining what input/context/addresses you observed (recorded as AGENT_REPORTED).',
    '- "replyText": helpful plain-text reply to show the user in Chat (1-4000 chars).',
    '- "items": optional array of up to 6 comparison cards ({id,title,merchant,url,description,price:{amount,currency},features}).',
    '- "proposal": null, or { "to": "0x...", "amount": "0.02", "purpose": "..." } for an unsigned Arc Testnet USDC proposal.',
    '',
    `Chat ID: ${job.chatId}`,
    `Trace ID: ${job.traceId}`,
    `Message Event ID: ${job.eventId}`,
    walletLine,
    balanceLine,
    txLines?`Observed transfers (most recent first, including faucet inflows):\n${txLines}`:'',
    propLines?`Recent proposals:\n${propLines}`:'',
    contextText?`Recent conversation context:\n${contextText}`:'',
    selectedText,
    `User message:\n${job.text}`
  ].filter(Boolean).join('\n');
}

function extractJsonObject(text){
  const trimmed=String(text||'').trim();
  if(!trimmed)return null;
  const fenced=trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate=fenced?fenced[1].trim():trimmed;
  try{
    const parsed=JSON.parse(candidate);
    if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return parsed;
  }catch{}
  const start=candidate.indexOf('{'),end=candidate.lastIndexOf('}');
  if(start>=0&&end>start){
    try{
      const parsed=JSON.parse(candidate.slice(start,end+1));
      if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return parsed;
    }catch{}
  }
  return null;
}

export function parseBackendOutput(raw,backendId='antigravity'){
  const text=String(raw||'').trim();
  if(!text)throw Error(`Backend ${backendId} returned empty output.`);
  let extracted=text;
  try{
    const envelope=JSON.parse(text);
    if(envelope&&typeof envelope==='object'&&!Array.isArray(envelope)){
      if(typeof envelope.replyText==='string')return normalizeParsed(envelope,backendId);
      if(envelope.item?.type==='agent_message'&&typeof envelope.item.text==='string')extracted=envelope.item.text.trim();
      else if(envelope.msg?.type==='agent_message'&&typeof envelope.msg.message==='string')extracted=envelope.msg.message.trim();
      else for(const k of ['result','response','text','message','output']){
        if(typeof envelope[k]==='string'&&envelope[k].trim()){extracted=envelope[k].trim();break;}
      }
    }
  }catch{
    const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    const messages=[];
    for(const line of lines){
      try{
        const row=JSON.parse(line);
        if(row?.item?.type==='agent_message'&&typeof row.item.text==='string')messages.push(row.item.text);
        else if(row?.msg?.type==='agent_message'&&typeof row.msg.message==='string')messages.push(row.msg.message);
      }catch{}
    }
    if(messages.length)extracted=messages.at(-1);
  }
  const obj=extractJsonObject(extracted);
  if(obj&&(typeof obj.replyText==='string'||typeof obj.text==='string'||typeof obj.plan==='string')){
    return normalizeParsed(obj,backendId);
  }
  return {
    plan:`Reported response generated by ${BACKENDS[backendId]?.label||backendId} for the submitted message.`,
    replyText:extracted.slice(0,8000),
    items:[],
    proposal:null
  };
}

function normalizeParsed(obj,backendId){
  const replyText=String(obj.replyText||obj.text||obj.plan||'').trim().slice(0,8000);
  const plan=String(obj.plan||`Reported response generated by ${BACKENDS[backendId]?.label||backendId}.`).trim().slice(0,8000);
  const items=Array.isArray(obj.items)?obj.items.slice(0,6):[];
  let proposal=null;
  if(obj.proposal&&typeof obj.proposal==='object'&&typeof obj.proposal.to==='string'&&typeof obj.proposal.amount==='string'){
    proposal={to:obj.proposal.to.trim(),amount:obj.proposal.amount.trim(),...(obj.proposal.purpose?{purpose:String(obj.proposal.purpose).slice(0,2000)}:{})};
  }
  return {plan,replyText:replyText||'See recorded agent note.',items,proposal};
}

function runStdin(bin,args,stdinText,timeoutMs=120000){
  return new Promise((resolve,reject)=>{
    const child=spawn(bin,args,{stdio:['pipe','pipe','pipe'],shell:false});
    let out='',err='';
    const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error(`${bin} timed out after ${timeoutMs}ms.`));},timeoutMs);
    child.stdout.on('data',d=>{out+=d;});
    child.stderr.on('data',d=>{err+=d;});
    child.on('error',e=>{clearTimeout(timer);reject(e);});
    child.on('close',code=>{clearTimeout(timer);if(code!==0)reject(Error(`${bin} exited with code ${code}: ${err.trim()||out.trim()}`));else resolve(out);});
    child.stdin.end(stdinText);
  });
}

export async function execBackend(backend,prompt,{env=process.env,model=''}={}){
  const id=normalizeBackend(backend);
  if(id==='manual')throw Error('Backend is set to manual; switch to antigravity, codex, or custom to run automated replies.');
  if(id==='antigravity'){
    const bin=env.PHISHNET_AGY_BIN||'agy';
    const selectedModel=model||env.PHISHNET_AGY_MODEL||'';
    const args=['-p',prompt,'--output-format','json','--disable-slash-commands',...(selectedModel?['--model',selectedModel]:[])];
    const {stdout}=await execFileAsync(bin,args,{maxBuffer:4*1024*1024,timeout:120000,env});
    return stdout;
  }
  if(id==='codex'){
    const bin=env.PHISHNET_CODEX_BIN||'codex';
    const selectedModel=model||env.PHISHNET_CODEX_MODEL||'';
    const args=['exec','--skip-git-repo-check',...(selectedModel?['--model',selectedModel]:[]),'-'];
    return await runStdin(bin,args,prompt,120000);
  }
  const rawCmd=(env.PHISHNET_AGENT_CMD||'').trim();
  if(!rawCmd)throw Error('Set PHISHNET_AGENT_CMD in .env.local to use the custom agent backend.');
  const parts=rawCmd.split(/\s+/);
  return await runStdin(parts[0],parts.slice(1),prompt,120000);
}

export async function dispatchJob(client,job,{backend,exec=execBackend}={}){
  const prompt=buildPrompt(job);
  const raw=await exec(backend,prompt,job);
  const parsed=parseBackendOutput(raw,backend);
  if(parsed.plan){
    await client.tool('plan.report',{chatId:job.chatId,text:parsed.plan,sourceEventIds:[job.eventId]});
  }
  let proposalId=null;
  if(parsed.proposal){
    const proposed=await client.tool('payment.propose',{chatId:job.chatId,...parsed.proposal});
    proposalId=proposed.proposalId||null;
  }
  const items=parsed.items.map(item=>proposalId&&!item.proposalId?{...item,proposalId}:item);
  const response=await client.tool('chat.respond',{chatId:job.chatId,replyId:'bridge-'+job.chatId,text:parsed.replyText,items});
  return {chatId:job.chatId,backend,proposalId,responseEventId:response.eventId};
}
