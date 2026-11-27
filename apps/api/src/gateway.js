import {randomBytes,randomUUID} from 'node:crypto';
import {verifyMessage} from 'viem';
import {generateKeypair} from '@countersignlabs/counter-sign';
import {Journal,sha} from '../../../packages/journal/src/journal.js';
import {canonical} from '../../../packages/journal/src/contract.js';
import {address,transfer,displayUSDC,ARC,validHash} from '../../../packages/payments/src/transfer.js';
import {createConsentBroker} from '../../../packages/consent/src/broker.js';
import {testnet} from './testnet.js';
import {assertReply,REPLY_VERSION} from '../../../packages/chat/src/reply.js';
export const strict=(value,allowed,required=[])=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k))||required.some(k=>value[k]===undefined))throw Error('Unexpected or missing typed request fields.');return value;};
const token=()=>randomBytes(32).toString('base64url');
const id=prefix=>prefix+'-'+randomUUID();
const actor=wallet=>({id:'human:'+wallet,type:'human'});
const tools=['wallet.balance','wallet.transactions','chat.read','payment.propose','plan.report','chat.respond'];
export const AGENT_BACKENDS=['antigravity','codex','custom','manual'];
// Structured responses carry the same agent-reported content authority as plan.report; wallet.balance grants read-only wallet.transactions.
const effectiveTools=config=>[...new Set([...config.capabilities,...(config.capabilities.includes('plan.report')?['chat.respond']:[]),...(config.capabilities.includes('wallet.balance')?['wallet.transactions']:[])])];
export function createGateway({journal,reader=testnet,approverPublicKey=process.env.COUNTERSIGN_APPROVER_PUBLIC_KEY||'',allowDynamicConsent=false,requireUnenrolledAgentConsent=true,clock=Date.now,localAgentToken=process.env.PHISHNET_AGENT_TOKEN||'',defaultAgentBackend=process.env.PHISHNET_AGENT_BACKEND||'manual'}={}){
 const j=journal,db=j.db;const consent=createConsentBroker({store:j,approverPublicKey,allowDynamic:allowDynamicConsent,clock});
 const subscribers=new Map();
 const notify=(wallet,payload)=>{const set=subscribers.get(wallet);if(!set?.size)return;for(const fn of set){try{fn(payload);}catch{}}};
 const getBackend=()=>{const row=db.prepare("SELECT value FROM metadata WHERE key='agent_backend'").get();const val=row?.value||defaultAgentBackend;return AGENT_BACKENDS.includes(val)?val:'manual';};
 const needsConsent=who=>consent.config().configured||(requireUnenrolledAgentConsent&&who.type==='agent');
 function emit(wallet,traceId,eventType,payload,component,who={id:component,type:'service'},links={}){const list=j.events(wallet,{traceId});const event=j.append({traceId,walletScope:{chainId:5042002,address:wallet},actor:who,eventType,payload,links:{...links,parentEventIds:links.parentEventIds|| (list.length?[list.at(-1).eventId]:[])}},component);queueMicrotask(()=>{try{if(db.prepare('SELECT 1 FROM events WHERE event_id=?').get(event.eventId))notify(wallet,{eventId:event.eventId,eventType:event.eventType,sequence:event.sequence,traceId:event.traceId});}catch{}});return event;}
 function put(p){db.prepare('INSERT INTO proposals VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,record_json=excluded.record_json').run(p.id,p.wallet,p.traceId,p.status,JSON.stringify(p));return p;}
 function get(wallet,proposalId){const row=db.prepare('SELECT record_json FROM proposals WHERE id=? AND wallet=?').get(proposalId,wallet);if(!row)throw Error('Proposal not found in selected wallet scope.');const p=JSON.parse(row.record_json);if(p.consentIntentId&&!p.txHash&&!p.authorizedAt&&!['REJECTED','EXPIRED','WALLET_REJECTED'].includes(p.status)){try{consent.record(p.consentIntentId,wallet);}catch(e){if(/expired/.test(e.message)){p.status='EXPIRED';j.transaction(()=>{put(p);emit(wallet,p.traceId,'payment.status.changed',{proposalId:p.id,status:'EXPIRED',reasonCode:'CONSENT_EXPIRED'},'payment-gateway');});}}}return p;}
 function output(p){return {...p,authorizationHash:undefined,purpose:p.purposeRef?j.content(p.wallet,p.purposeRef):'',events:j.events(p.wallet,{traceId:p.traceId})};}
 function propose(wallet,body,who=actor(wallet),traceId=null,parentIds=[]){if(api.audit?.config().publisher===wallet)throw Error('Audit publisher is reserved; use a separate payment account.');strict(body,['payment','purpose'],['payment']);const tx=transfer(body.payment);if(tx.from.toLowerCase()!==wallet)throw Error('Sender differs from selected wallet.');if(body.purpose!==undefined&&(typeof body.purpose!=='string'||body.purpose.length>2000))throw Error('Purpose exceeds 2000 characters.');return j.transaction(()=>{const purpose=body.purpose?j.putContent(wallet,body.purpose):null;const p={id:id('proposal'),traceId:traceId||id('trace'),wallet,input:{from:tx.from,to:tx.to,amount:body.payment.amount},transaction:tx,transactionDigest:sha('phishnet.native-transfer.v1\n'+canonical(tx)),initiator:who.type==='agent'?'agent':'human',agentId:who.type==='agent'?who.id:null,requiresConsent:needsConsent(who),status:'PROPOSED',createdAt:new Date(clock()).toISOString(),purposeRef:purpose?.contentRef||null};put(p);
   emit(wallet,p.traceId,'payment.proposed',{proposalId:p.id,from:wallet,recipient:tx.to.toLowerCase(),amountBaseUnits:BigInt(tx.value).toString(),asset:'native-USDC',decimals:18,chainId:5042002,initiator:p.initiator,...(p.purposeRef?{purposeRef:p.purposeRef}:{})},'payment-gateway',who,{proposalId:p.id,...(parentIds.length?{parentEventIds:parentIds}:{})});
   emit(wallet,p.traceId,'payment.validated',{proposalId:p.id,transactionDigest:p.transactionDigest},'payment-gateway');
   emit(wallet,p.traceId,'policy.evaluated',{proposalId:p.id,decision:'HOLD',reasonCodes:[p.requiresConsent?'COUNTERSIGN_REQUIRED':'MANUAL_WALLET_APPROVAL_REQUIRED']},'payment-gateway');return output(p);});}
 function selectedChatItems(wallet,traceId,refs){
  if(!Array.isArray(refs)||refs.length>3)throw Error('Select up to three recorded items.');
  const seen=new Set();return refs.map(ref=>{strict(ref,['eventId','itemId'],['eventId','itemId']);if(typeof ref.eventId!=='string'||typeof ref.itemId!=='string'||! /^[A-Za-z0-9:._-]{1,160}$/.test(ref.itemId))throw Error('Invalid item selection.');const key=ref.eventId+':'+ref.itemId;if(seen.has(key))throw Error('Duplicate item selection.');seen.add(key);
   const row=db.prepare("SELECT event_json FROM events WHERE wallet=? AND trace_id=? AND event_id=? AND event_type='agent.message.reported'").get(wallet,traceId,ref.eventId);if(!row)throw Error('Selected source is outside this conversation.');const e=JSON.parse(row.event_json),item=assertReply(JSON.parse(j.content(wallet,e.payload.contentRef))).items.find(i=>i.id===ref.itemId);if(!item)throw Error('Selected item is not in the recorded source.');return {sourceEventId:e.eventId,item};
  });
 }
 function walletActivitySummary(wallet){
  const txRows=db.prepare("SELECT event_json FROM events WHERE wallet=? AND event_type IN ('chain.transaction.observed','history.imported') ORDER BY sequence DESC LIMIT 25").all(wallet);
  const recentTransactions=txRows.map(r=>JSON.parse(r.event_json)).map(e=>({
   eventId:e.eventId,
   eventType:e.eventType,
   direction:e.payload.direction||(e.payload.from===wallet?'outgoing':'incoming'),
   from:e.payload.from,
   recipient:e.payload.recipient,
   amountUSDC:displayUSDC(e.payload.amountBaseUnits),
   amountBaseUnits:e.payload.amountBaseUnits,
   txHash:e.payload.txHash,
   blockNumber:e.payload.blockNumber||null,
   observedAt:e.payload.observedAt||e.recordedAt,
   source:e.payload.source||e.origin,
   verification:e.verification.state
  }));
  const propRows=db.prepare('SELECT record_json FROM proposals WHERE wallet=? ORDER BY rowid DESC LIMIT 10').all(wallet);
  const recentProposals=propRows.map(r=>JSON.parse(r.record_json)).map(p=>({
   proposalId:p.id,
   status:p.status,
   initiator:p.initiator,
   to:p.input.to,
   amount:p.input.amount,
   txHash:p.txHash||null,
   createdAt:p.createdAt
  }));
  return {wallet,chainId:5042002,recentTransactions,recentProposals};
 }
 function chatJob(agent,job){
  const head=db.prepare('SELECT sequence,event_json FROM events WHERE event_id=? AND wallet=?').get(job.event_id,agent.wallet),event=JSON.parse(head.event_json);
  const rows=db.prepare("SELECT event_json FROM events WHERE wallet=? AND trace_id=? AND sequence<=? AND event_type IN ('chat.user.submitted','agent.message.reported','agent.plan.reported') ORDER BY sequence DESC LIMIT 20").all(agent.wallet,job.trace_id,head.sequence);
  const context=rows.reverse().map(r=>JSON.parse(r.event_json)).map(e=>({eventId:e.eventId,type:e.eventType,recordedAt:e.recordedAt,verification:e.verification.state,text:j.content(agent.wallet,e.payload.contentRef),...(e.payload.selectedItemRefs?{selectedItemRefs:e.payload.selectedItemRefs}:{})}));
  while(context.length>1&&Buffer.byteLength(JSON.stringify(context))>20000)context.shift();
  return {chatId:job.id,traceId:job.trace_id,eventId:job.event_id,text:j.content(agent.wallet,job.content_ref),context,selectedItems:selectedChatItems(agent.wallet,job.trace_id,event.payload.selectedItemRefs||[]),walletSnapshot:walletActivitySummary(agent.wallet)};
 }
 const api={journal:j,consent,emit,proposal:get,walletActivitySummary,
  emitAgentStatus(wallet,status){notify(address(wallet).toLowerCase(),{type:'agent_status',...status});},
  enrollConsent(wallet,body){
   address(wallet);
   strict(body,['publicKey','generate']);
   if(body.generate){const kp=generateKeypair();const cfg=consent.enroll(kp.publicKey);return {config:cfg,generatedKeypair:{actor:'human:owner',publicKey:kp.publicKey,secretKey:kp.secretKey}};}
   if(!body.publicKey)throw Error('publicKey required.');
   return {config:consent.enroll(body.publicKey),generatedKeypair:null};
  },
  clearConsent(){return {config:consent.clear()};},
  subscribe(wallet,fn){const w=address(wallet).toLowerCase();let set=subscribers.get(w);if(!set){set=new Set();subscribers.set(w,set);}set.add(fn);return ()=>{set.delete(fn);if(!set.size)subscribers.delete(w);};},
  challenge(wallet,origin){wallet=address(wallet).toLowerCase();const challengeId=id('challenge'),expires=clock()+120000;const message=`Sign in to local PhishNet. This is not a payment approval.\nOrigin: ${origin}\nWallet: ${wallet}\nChain: 5042002\nNonce: ${token()}\nExpires: ${new Date(expires).toISOString()}`;db.prepare('INSERT INTO challenges(id,wallet,message,expires) VALUES(?,?,?,?)').run(challengeId,wallet,message,expires);return {challengeId,message};},
  async login(body,origin){strict(body,['challengeId','wallet','signature'],['challengeId','wallet','signature']);const wallet=address(body.wallet).toLowerCase();const c=db.prepare('SELECT * FROM challenges WHERE id=? AND wallet=?').get(body.challengeId,wallet);if(!c||c.used||clock()>=c.expires||!c.message.includes(`\nOrigin: ${origin}\n`))throw Error('Wallet challenge invalid, expired or already used.');if(typeof body.signature!=='string'||body.signature.length>2000||!await verifyMessage({address:wallet,message:c.message,signature:body.signature}))throw Error('Wallet ownership signature is invalid.');return j.transaction(()=>{const used=db.prepare('UPDATE challenges SET used=1 WHERE id=? AND used=0').run(c.id);if(used.changes!==1)throw Error('Wallet challenge already consumed.');const session=token();db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(sha(session),wallet,clock()+8*3600000);return {wallet,session};});},
  session(raw,wallet){if(!raw||!wallet)throw Error('Wallet sign-in required.');const row=db.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires>?').get(sha(raw),clock());if(!row||row.wallet!==address(wallet).toLowerCase())throw Error('Wallet session scope mismatch.');return row.wallet;},
  logout(raw){if(raw)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha(raw));},
  list(wallet){return db.prepare('SELECT id FROM proposals WHERE wallet=? ORDER BY rowid DESC LIMIT 200').all(wallet).map(row=>output(get(wallet,row.id)));},
  events(wallet,query={}){return j.events(wallet,query);},
  exportJournal(wallet){return j.exportWallet(address(wallet).toLowerCase());},
  importJournal(wallet,bundle){
   const w=address(wallet).toLowerCase();
   const res=j.importWallet(w,bundle);
   for(const e of res.events)notify(w,{eventId:e.eventId,eventType:e.eventType,sequence:e.sequence,traceId:e.traceId});
   return {imported:res.imported,skipped:res.skipped};
  },
  createProposal:propose,
  async quote(wallet,proposalId){const p=get(wallet,proposalId);if(p.authorizedAt||p.txHash||['REJECTED','EXPIRED','AUTHORIZATION_REQUESTED','CONFIRMED'].includes(p.status))throw Error('This proposal cannot be sent again. Check its existing records.');const quote=await reader.quote(p.input);return j.transaction(()=>{const fresh=get(wallet,proposalId);if(fresh.authorizedAt||fresh.txHash||fresh.status==='AUTHORIZATION_REQUESTED')throw Error('Proposal already submitted for wallet authorization.');fresh.quote={...quote,expiresAt:clock()+(fresh.requiresConsent?300000:60000)};put(fresh);emit(wallet,p.traceId,'payment.validated',{proposalId:p.id,transactionDigest:p.transactionDigest,feeBaseUnits:quote.estimatedFeeBaseUnits},'payment-gateway');return {...quote,expiresAt:fresh.quote.expiresAt,consentRequired:fresh.requiresConsent,proposalId:p.id,traceId:p.traceId,purpose:p.purposeRef?j.content(wallet,p.purposeRef):'',initiator:p.initiator};});},
  intent(wallet,proposalId){return j.transaction(()=>{const p=get(wallet,proposalId);if(p.authorizedAt||p.txHash||p.status==='REJECTED')throw Error('Proposal already finalized or sent for wallet authorization.');if(!p.requiresConsent)throw Error('This manual proposal does not use CounterSign.');if(p.consentIntentId){try{const existing=consent.record(p.consentIntentId,wallet);if(['PENDING','APPROVED'].includes(existing.status))return {intent:existing.intent,payment:p.transaction,transactionDigest:p.transactionDigest,expiresAt:existing.expiresAt,status:existing.status};}catch{}}
    const result=consent.create(p.input,{proposalId:p.id,traceId:p.traceId});p.consentIntentId=result.intent.intent_id;p.status='PENDING_APPROVAL';put(p);return result;});},
  resolve(wallet,proposalId,resolution){const p=get(wallet,proposalId);if(!p.consentIntentId)throw Error('No CounterSign intent exists.');return j.transaction(()=>{const result=consent.accept({intentId:p.consentIntentId,resolution,payment:p.input},wallet);p.status=result.status==='APPROVED'?'APPROVED':'REJECTED';put(p);return result;});},
  async authorize(wallet,proposalId){const snapshot=get(wallet,proposalId);if(snapshot.txHash)throw Error('Payment already has a submitted hash. Do not resend.');if(!snapshot.quote||clock()>=snapshot.quote.expiresAt)throw Error('Payment review expired. Review it again.');const quote=await reader.quote(snapshot.input);return j.transaction(()=>{const p=get(wallet,proposalId);if(p.authorizedAt||p.txHash||['AUTHORIZATION_REQUESTED','REJECTED','EXPIRED','WALLET_REJECTED'].includes(p.status))throw Error('Proposal already authorized, rejected or expired.');if(!p.quote||clock()>=p.quote.expiresAt||BigInt(quote.estimatedFeeBaseUnits)>BigInt(p.quote.estimatedFeeBaseUnits))throw Error('Review expired or fees increased. Review again.');let proof=null;if(p.requiresConsent){if(!p.consentIntentId)throw Error('Independent CounterSign human approval required.');proof=consent.consume({intentId:p.consentIntentId,payment:p.input},wallet);}const executionToken=token();p.authorizationHash=sha(executionToken);p.status='AUTHORIZATION_REQUESTED';p.authorizedAt=new Date(clock()).toISOString();put(p);emit(wallet,p.traceId,'wallet.authorization.requested',{proposalId:p.id,...(p.consentIntentId?{consentIntentId:p.consentIntentId}:{})},'wallet-observer',actor(wallet));return {...quote,executionToken,consentProof:proof};});},
  submitted(wallet,proposalId,body){strict(body,['hash','executionToken'],['hash']);if(!validHash(body.hash))throw Error('Invalid transaction hash.');return j.transaction(()=>{const p=get(wallet,proposalId);if(p.txHash===body.hash)return output(p);if(p.status!=='AUTHORIZATION_REQUESTED'||!p.authorizationHash||sha(body.executionToken||'')!==p.authorizationHash)throw Error('No matching wallet authorization request.');const used=db.prepare("SELECT id FROM proposals WHERE json_extract(record_json,'$.txHash')=? AND id<>?").get(body.hash,proposalId);if(used)throw Error('Transaction hash is already associated with another proposal.');p.txHash=body.hash;p.status='BROADCAST';p.submittedAt=new Date(clock()).toISOString();delete p.authorizationHash;put(p);emit(wallet,p.traceId,'wallet.submission.observed',{proposalId:p.id,txHash:body.hash},'wallet-observer',actor(wallet),{proposalId:p.id,txHash:body.hash});return output(p);});},
  reject(wallet,proposalId,body){strict(body,['reasonCode','executionToken'],['reasonCode']);if(!['USER_REJECTED','CANCELLED','REQUEST_FAILED'].includes(body.reasonCode))throw Error('Invalid rejection reason.');return j.transaction(()=>{const p=get(wallet,proposalId);if(p.txHash)throw Error('Submitted transaction cannot be cancelled locally.');if(['REJECTED','WALLET_REJECTED','EXPIRED'].includes(p.status))return output(p);if(p.status==='AUTHORIZATION_REQUESTED'){if(sha(body.executionToken||'')!==p.authorizationHash)throw Error('Wallet request does not match.');p.status='WALLET_REJECTED';emit(wallet,p.traceId,'wallet.rejected',{proposalId:p.id,reasonCode:body.reasonCode},'wallet-observer',actor(wallet));}else{p.status='REJECTED';emit(wallet,p.traceId,'payment.status.changed',{proposalId:p.id,status:'REJECTED',reasonCode:'USER_CANCELLED'},'payment-gateway',actor(wallet));}delete p.authorizationHash;put(p);return output(p);});},
  async check(wallet,proposalId){const p=get(wallet,proposalId);if(!p.txHash)throw Error('No submitted transaction to verify.');let result;try{result=await reader.receipt({...p.input,hash:p.txHash});}catch{result={status:'UNVERIFIED',detail:'Network verification unavailable. Check again; do not automatically resend.'};}return j.transaction(()=>{const fresh=get(wallet,proposalId);fresh.status=result.status==='MISMATCH'?'UNVERIFIED':result.status;fresh.verification=result;put(fresh);const ref=j.putContent(wallet,JSON.stringify(result));emit(wallet,p.traceId,'chain.receipt.checked',{proposalId:p.id,txHash:p.txHash,status:result.status,...(result.blockNumber?{blockNumber:result.blockNumber}:{}),...(result.feeBaseUnits?{feeBaseUnits:result.feeBaseUnits}:{}),verificationRef:ref.contentRef},'chain-verifier');return output(fresh);});},
  importHistory(wallet,records){if(!Array.isArray(records)||records.length>50)throw Error('Import at most 50 browser records.');return j.transaction(()=>records.map(r=>{strict(r,['hash','input','note','submittedAt'],['hash','input']);if(!validHash(r.hash))throw Error('Invalid imported hash.');const tx=transfer(r.input);if(tx.from.toLowerCase()!==wallet)throw Error('Imported record is outside selected wallet.');const existing=db.prepare("SELECT id FROM proposals WHERE wallet=? AND json_extract(record_json,'$.txHash')=?").get(wallet,r.hash);if(existing)return existing.id;const p={id:id('import'),traceId:id('trace'),wallet,input:r.input,transaction:tx,transactionDigest:sha('phishnet.native-transfer.v1\n'+canonical(tx)),initiator:'import',requiresConsent:false,status:'UNVERIFIED',txHash:r.hash,createdAt:new Date(clock()).toISOString(),source:'UNTRUSTED_BROWSER_IMPORT'};put(p);emit(wallet,p.traceId,'history.imported',{txHash:r.hash,from:wallet,recipient:tx.to.toLowerCase(),amountBaseUnits:BigInt(tx.value).toString()},'import-gateway');return p.id;}));},
  async syncChainTransactions(wallet){
   wallet=address(wallet).toLowerCase();
   if(typeof reader.transactions!=='function')return {added:0,events:[]};
   const observed=await reader.transactions(wallet);
   return j.transaction(()=>{
    const known=new Set([
     ...db.prepare("SELECT lower(json_extract(record_json,'$.txHash')) AS h FROM proposals WHERE wallet=? AND json_extract(record_json,'$.txHash') IS NOT NULL").all(wallet).map(r=>r.h),
     ...db.prepare("SELECT lower(json_extract(event_json,'$.payload.txHash')) AS h FROM events WHERE wallet=? AND event_type='chain.transaction.observed'").all(wallet).map(r=>r.h)
    ]);
    const created=[];
    for(const item of observed){
     const hash=String(item.txHash||'').toLowerCase();
     if(!validHash(hash)||known.has(hash))continue;
     known.add(hash);
     const traceId='chain-'+hash.slice(2,18);
     const event=emit(wallet,traceId,'chain.transaction.observed',{txHash:hash,from:item.from.toLowerCase(),recipient:item.recipient.toLowerCase(),amountBaseUnits:String(item.amountBaseUnits),direction:item.direction,asset:'native-USDC',decimals:18,chainId:5042002,blockNumber:String(item.blockNumber),...(item.observedAt?{observedAt:item.observedAt}:{}),source:item.source},'chain-verifier',{id:'chain-rpc',type:'service'},{txHash:hash});
     created.push(event);
    }
    return {added:created.length,events:created};
   });
  },
  backend:getBackend,
  setBackend(wallet,backend){
   wallet=address(wallet).toLowerCase();
   if(!AGENT_BACKENDS.includes(backend))throw Error('Unsupported agent backend. Use antigravity, codex, custom, or manual.');
   return j.transaction(()=>{
    db.prepare("INSERT INTO metadata VALUES('agent_backend',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(backend);
    emit(wallet,id('trace'),'agent.connector.changed',{agentId:'backend:'+backend,action:'backend_switched',backend},'ui-gateway',actor(wallet));
    return {backend,signingCapability:false};
   });
  },
  chat(wallet,body){strict(body,['text','traceId','selectedItems'],['text']);if(typeof body.text!=='string'||!body.text.trim()||body.text.length>8000)throw Error('Enter a message of 1–8000 characters.');if(body.traceId!==undefined&&(typeof body.traceId!=='string'||!/^[a-z0-9-]{1,160}$/.test(body.traceId)||!j.events(wallet,{traceId:body.traceId}).some(e=>e.eventType==='chat.user.submitted')))throw Error('Conversation is outside the selected wallet.');return j.transaction(()=>{const traceId=body.traceId||id('trace'),refs=body.selectedItems===undefined?[]:body.selectedItems;selectedChatItems(wallet,traceId,refs);const content=j.putContent(wallet,body.text);const event=emit(wallet,traceId,'chat.user.submitted',{...content,...(refs.length?{selectedItemRefs:refs}:{})},'ui-gateway',actor(wallet),refs.length?{parentEventIds:[...new Set(refs.map(r=>r.eventId))]}:{});const chatId=id('chat');db.prepare('INSERT INTO chat_jobs VALUES(?,?,?,?,?,?,?)').run(chatId,wallet,traceId,null,content.contentRef,event.eventId,'QUEUED');return {chatId,traceId,eventId:event.eventId,status:'QUEUED'};});},
  issueAgent(wallet){return j.transaction(()=>{const value=token(),agentId=id('agent');db.prepare('INSERT INTO agents VALUES(?,?,?,?,0)').run(agentId,wallet,sha(value),JSON.stringify({capabilities:tools,issuedAt:new Date(clock()).toISOString(),lastSeen:null}));emit(wallet,id('trace'),'agent.connector.changed',{agentId,action:'issued'},'ui-gateway',actor(wallet));return {agentId,token:value,capabilities:tools,wallet};});},
  agent(raw){const row=db.prepare('SELECT * FROM agents WHERE token_hash=? AND revoked=0').get(sha(raw||''));if(!row)throw Error('Agent capability invalid or revoked.');return {...row,config:JSON.parse(row.record_json)};},
  localAgentConnection(wallet){try{const a=api.agent(localAgentToken);if(a.wallet!==wallet)throw Error('scope');return {...api.agentConnection(a),recentlyActive:!!a.config.lastSeen&&clock()-Date.parse(a.config.lastSeen)<30000};}catch{return {status:'UNAVAILABLE',backend:getBackend(),signingCapability:false};}},
  agentConnection(agent){return {agentId:agent.id,wallet:agent.wallet,capabilities:effectiveTools(agent.config),backend:getBackend(),status:'CAPABILITY_VALID',signingCapability:false};},
  agentStatus(wallet){return db.prepare('SELECT id,record_json FROM agents WHERE wallet=? AND revoked=0 ORDER BY rowid DESC').all(wallet).map(r=>({agentId:r.id,...JSON.parse(r.record_json)}));},
  revokeAgent(wallet,agentId){return j.transaction(()=>{const changed=db.prepare('UPDATE agents SET revoked=1 WHERE id=? AND wallet=? AND revoked=0').run(agentId,wallet);if(changed.changes)emit(wallet,id('trace'),'agent.connector.changed',{agentId,action:'revoked'},'ui-gateway',actor(wallet));return {revoked:!!changed.changes};});},
  jobs(agent){return j.transaction(()=>{const newly=db.prepare("SELECT * FROM chat_jobs WHERE wallet=? AND agent_id IS NULL").all(agent.wallet);for(const job of newly){const toolCallId=id('tool');emit(agent.wallet,job.trace_id,'agent.tool.requested',{toolCallId,tool:'chat.read'},'agent-gateway',{id:agent.id,type:'agent'},{toolCallId,parentEventIds:[job.event_id]});const result=j.putContent(agent.wallet,JSON.stringify({chatId:job.id,messageEventId:job.event_id,contextEventIds:chatJob(agent,job).context.map(e=>e.eventId)}));emit(agent.wallet,job.trace_id,'tool.result.observed',{toolCallId,tool:'chat.read',resultRef:result.contentRef},'agent-gateway');}db.prepare("UPDATE chat_jobs SET agent_id=?,status='DELIVERED' WHERE wallet=? AND agent_id IS NULL").run(agent.id,agent.wallet);const config={...agent.config,lastSeen:new Date(clock()).toISOString()};db.prepare('UPDATE agents SET record_json=? WHERE id=?').run(JSON.stringify(config),agent.id);return db.prepare("SELECT * FROM chat_jobs WHERE wallet=? AND agent_id=? AND status<>'COMPLETED'").all(agent.wallet,agent.id).map(job=>chatJob(agent,job));});},
  async tool(agent,body){strict(body,['tool','arguments'],['tool','arguments']);if(!tools.includes(body.tool)||!effectiveTools(agent.config).includes(body.tool))throw Error('Agent tool is not permitted. No signing or approval tools exist.');const args=body.arguments;strict(args,body.tool==='payment.propose'?['chatId','to','amount','purpose']:body.tool==='plan.report'?['chatId','text','sourceEventIds']:body.tool==='chat.respond'?['chatId','replyId','text','items']:[],body.tool==='payment.propose'?['to','amount']:body.tool==='plan.report'?['chatId','text']:body.tool==='chat.respond'?['chatId','replyId']:[]);
   if(body.tool==='chat.read')return api.jobs(agent);
   if(args.chatId!==undefined&&(typeof args.chatId!=='string'||! /^[A-Za-z0-9:._-]{1,160}$/.test(args.chatId)))throw Error('Invalid chat reference.');
   let job=null;if(args.chatId){job=db.prepare('SELECT * FROM chat_jobs WHERE id=? AND agent_id=? AND wallet=?').get(args.chatId,agent.id,agent.wallet);if(!job)throw Error('Chat source is not assigned to this agent.');}
   const traceId=job?.trace_id||id('trace'),toolCallId=id('tool');const requested=emit(agent.wallet,traceId,'agent.tool.requested',{toolCallId,tool:body.tool},'agent-gateway',{id:agent.id,type:'agent'});
   if(body.tool==='wallet.balance'){const result=await reader.balance(agent.wallet);j.transaction(()=>{const ref=j.putContent(agent.wallet,JSON.stringify(result));emit(agent.wallet,traceId,'tool.result.observed',{toolCallId,tool:body.tool,resultRef:ref.contentRef},'agent-gateway');});return {...result,balanceUSDC:displayUSDC(result.balanceBaseUnits)};}
   if(body.tool==='wallet.transactions'){try{await api.syncChainTransactions(agent.wallet);}catch{}const result=walletActivitySummary(agent.wallet);j.transaction(()=>{const ref=j.putContent(agent.wallet,JSON.stringify(result).slice(0,31000));emit(agent.wallet,traceId,'tool.result.observed',{toolCallId,tool:body.tool,resultRef:ref.contentRef},'agent-gateway');});return result;}
   if(body.tool==='chat.respond'){
    if(typeof args.replyId!=='string'||! /^[A-Za-z0-9:._-]{1,160}$/.test(args.replyId))throw Error('A stable replyId is required.');
    const reply=assertReply({version:REPLY_VERSION,text:args.text===undefined?'':args.text,items:args.items===undefined?[]:args.items});
    return j.transaction(()=>{
     for(const item of reply.items)if(item.proposalId){const p=get(agent.wallet,item.proposalId);if(p.traceId!==job.trace_id||p.agentId!==agent.id)throw Error('Item proposal must belong to this agent and conversation.');}
     const existing=db.prepare("SELECT event_json FROM events WHERE wallet=? AND trace_id=? AND event_type='agent.message.reported' AND json_extract(event_json,'$.actor.id')=? AND json_extract(event_json,'$.payload.replyId')=?").get(agent.wallet,traceId,agent.id,args.replyId),prior=existing?JSON.parse(existing.event_json):null;
     if(prior){if(j.content(agent.wallet,prior.payload.contentRef)!==JSON.stringify(reply)||prior.payload.chatId!==job.id)throw Error('replyId already binds a different response.');return {eventId:prior.eventId,traceId,status:'RECORDED',signingCapability:false};}
     if(db.prepare("SELECT 1 FROM events WHERE wallet=? AND trace_id=? AND event_type='agent.message.reported' AND json_extract(event_json,'$.payload.chatId')=?").get(agent.wallet,traceId,job.id))throw Error('A response is already recorded for this chat turn.');
     const content=j.putContent(agent.wallet,JSON.stringify(reply));const result=emit(agent.wallet,traceId,'agent.message.reported',{...content,chatId:job.id,replyId:args.replyId,format:REPLY_VERSION},'agent-gateway',{id:agent.id,type:'agent'},{toolCallId,parentEventIds:[requested.eventId,job.event_id]});
     db.prepare("UPDATE chat_jobs SET status='COMPLETED' WHERE id=?").run(job.id);return {eventId:result.eventId,traceId,status:'RECORDED',signingCapability:false};
    });
   }
   if(body.tool==='plan.report'){const refs=args.sourceEventIds||[job.event_id];if(!Array.isArray(refs)||refs.length>32)throw Error('Invalid source references.');return j.transaction(()=>{const content=j.putContent(agent.wallet,args.text);return emit(agent.wallet,traceId,'agent.plan.reported',{...content,sourceEventIds:refs},'agent-gateway',{id:agent.id,type:'agent'},{toolCallId,parentEventIds:[requested.eventId,...refs]});});}
   const result=propose(agent.wallet,{payment:{from:agent.wallet,to:args.to,amount:args.amount},...(args.purpose?{purpose:args.purpose}:{})},{id:agent.id,type:'agent'},traceId,[requested.eventId]);if(job)db.prepare("UPDATE chat_jobs SET status='COMPLETED' WHERE id=?").run(job.id);return {proposalId:result.id,traceId:result.traceId,status:result.status,transaction:result.transaction,requiresConsent:!!result.requiresConsent,signingCapability:false};
  }
 };
 return api;
}
