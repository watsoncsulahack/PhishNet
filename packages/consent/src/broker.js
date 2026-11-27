/** Official counter-sign keyed profile. The human secret is never held here. */
import {createHash} from 'node:crypto';
import {generateKeypair,createIntent,verifyIntent,verifyResolution,canonicalize,isCanonicalPublicKey} from '@countersignlabs/counter-sign';
import {transfer,ARC} from '../../payments/src/transfer.js';
export function createConsentBroker({approverPublicKey='',allowDynamic=false,clock=Date.now,agent,authority,timeout=300,store=null}={}){
 agent??={id:'phishnet:requester',keypair:store?.signer('consent-requester')||generateKeypair()};authority??=store?.signer('consent-authority')||generateKeypair();
 if(approverPublicKey&&!isCanonicalPublicKey(approverPublicKey))throw Error('COUNTERSIGN_APPROVER_PUBLIC_KEY must be a canonical raw Ed25519 public key.');
 const storedKey=(!approverPublicKey&&allowDynamic&&store)?(store.db.prepare("SELECT value FROM metadata WHERE key='countersign_approver_pk'").get()?.value||''):'';
 let activeKey=approverPublicKey||storedKey;
 const checkKey=k=>{if(k&&(k===agent.keypair.publicKey||k===authority.publicKey))throw Error('The human key must be distinct from requester and runtime keys.');};
 checkKey(activeKey);
 const pending=new Map(),atomic=fn=>store?store.transaction(fn):fn();
 const config=()=>({protocol:'counter-sign 0.2',configured:!!activeKey,dynamic:!approverPublicKey&&allowDynamic,fixedByEnv:!!approverPublicKey,mode:'keyed',actor:'human:owner',approverPublicKey:activeKey||null,requesterPublicKey:agent.keypair.publicKey,default:'reject',hardwareAttested:false,durable:!!store,detail:activeKey?'Independent keyed receipt required, followed by external wallet transaction approval.':'No independent CounterSign key enrolled. Manual wallet approval in your external wallet remains mandatory.'});
 function bound(input){const tx=transfer(input);return {tx,digest:createHash('sha256').update('phishnet.native-transfer.v1\n'+canonicalize(tx)).digest('hex')};}
 function save(r){if(store)store.db.prepare('INSERT INTO consents VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,record_json=excluded.record_json').run(r.intent.intent_id,r.input.from.toLowerCase(),r.status,r.expiresAt,JSON.stringify(r));else pending.set(r.intent.intent_id,structuredClone(r));}
 function read(id){const r=store?store.db.prepare('SELECT record_json FROM consents WHERE id=?').get(id):null;return store?(r?JSON.parse(r.record_json):null):structuredClone(pending.get(id));}
 function get(id,wallet){const r=read(id);if(!r)throw Error('Unknown intent. Restarted or expired sessions require a new review.');if(r.context?.proposalId&&wallet!==r.input.from.toLowerCase())throw Error('Consent wallet scope mismatch.');if(r.intent.approvers[0]?.public_key!==activeKey)throw Error('Approver enrollment changed. Request a new intent.');if(clock()>=r.expiresAt){if(!['CONSUMED','REJECTED','EXPIRED'].includes(r.status)){r.status='EXPIRED';save(r);}throw Error('Intent expired; silence rejects. Request a new human review.');}return r;}
 function checked(r,resolution){if(!verifyIntent(r.intent)||r.intent.agent.public_key!==agent.keypair.publicKey||r.intent.action!=='phishnet.payment.native-usdc'||r.intent.default!=='reject'||!r.intent.summary.endsWith(`sha256:${r.digest}.`)||bound(r.input).digest!==r.digest)throw Error('Stored consent binding is invalid.');if(resolution?.policy!=='approver'||!Array.isArray(resolution.countersignatures)||resolution.countersignatures.length!==1)throw Error('Explicit independent human decision required.');verifyResolution(r.intent,resolution,authority.publicKey);const at=Date.parse(resolution.countersignatures[0].timestamp);if(!Number.isFinite(at)||at<Date.parse(r.intent.created_at)||at>clock()+5000||at>=r.expiresAt)throw Error('Human receipt timestamp is outside the approval window.');}
 function observe(r,eventType,payload){if(!store||!r.context?.proposalId)return;const wallet=r.input.from.toLowerCase();const events=store.events(wallet,{traceId:r.context.traceId});store.append({traceId:r.context.traceId,walletScope:{chainId:5042002,address:wallet},actor:{id:'consent-verifier',type:'service'},eventType,payload,links:{proposalId:r.context.proposalId,consentIntentId:r.intent.intent_id,parentEventIds:events.length?[events.at(-1).eventId]:[]}},'consent-verifier');}
 return {config,record:(id,wallet)=>get(id,wallet),
  enroll(publicKey){
   if(approverPublicKey)throw Error('Approver key is fixed by environment configuration.');
   if(!allowDynamic)throw Error('Dynamic approver enrollment is disabled.');
   if(!isCanonicalPublicKey(publicKey))throw Error('Public key must be a canonical raw Ed25519 key (ed25519:...).');
   checkKey(publicKey);
   activeKey=publicKey;
   if(store)store.db.prepare("INSERT INTO metadata VALUES('countersign_approver_pk',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(publicKey);
   return config();
  },
  clear(){
   if(approverPublicKey)throw Error('Approver key is fixed by environment configuration.');
   if(!allowDynamic)throw Error('Dynamic approver enrollment is disabled.');
   activeKey='';
   if(store)store.db.prepare("DELETE FROM metadata WHERE key='countersign_approver_pk'").run();
   return config();
  },
  create(input,context=null){if(!activeKey)throw Error('Independent approver is not configured.');const {tx,digest}=bound(input);return atomic(()=>{const count=store?store.db.prepare("SELECT count(*) AS n FROM consents WHERE expires>? AND status='PENDING'").get(clock()).n:pending.size;if(count>=200)throw Error('Too many pending approval records. Wait for expiry.');
   const summary=`Send ${input.amount} native test USDC on ${ARC.name} (${ARC.chainId}) from ${tx.from} to ${tx.to}. Empty calldata. Maximum payment 100 test USDC; wallet reviews network fees separately. Transaction commitment sha256:${digest}.`;
   const intent=createIntent({action:'phishnet.payment.native-usdc',summary,risk_tier:'high',approvers:[{actor:'human:owner',mode:'keyed',public_key:activeKey}],quorum:1,timeout,default:'reject'},agent);
   const r={intent,input:structuredClone(input),context,digest,status:'PENDING',expiresAt:Date.parse(intent.created_at)+timeout*1000};save(r);observe(r,'countersign.intent.created',{proposalId:context?.proposalId,consentIntentId:intent.intent_id,intentDigest:createHash('sha256').update(canonicalize(intent)).digest('hex')});return {intent,payment:tx,transactionDigest:digest,expiresAt:r.expiresAt,status:r.status};});},
  accept({intentId,resolution,payment},wallet){get(intentId,wallet);return atomic(()=>{const r=get(intentId,wallet);if(r.status!=='PENDING')throw Error('Intent already decided or consumed.');if(bound(payment).digest!==r.digest)throw Error('Payment differs from signed intent.');checked(r,resolution);r.status=resolution.decision==='approve'?'APPROVED':'REJECTED';r.resolution=structuredClone(resolution);save(r);observe(r,'countersign.resolution.verified',{proposalId:r.context?.proposalId,consentIntentId:intentId,decision:resolution.decision,signer:resolution.countersignatures[0].public_key});return {status:r.status,intentId,transactionDigest:r.digest,resolution:r.resolution};});},
  consume({intentId,payment},wallet){get(intentId,wallet);return atomic(()=>{const r=get(intentId,wallet);if(r.status!=='APPROVED')throw Error('Independent human approval is missing, rejected or already consumed.');if(bound(payment).digest!==r.digest)throw Error('Payment changed after approval.');checked(r,r.resolution);r.status='CONSUMED';save(r);return {status:r.status,intentId,transactionDigest:r.digest,resolution:r.resolution};});}
 };
}
// Compatibility instance for isolated legacy library consumers; the server injects the durable store.
export const consentBroker=createConsentBroker({approverPublicKey:process.env.COUNTERSIGN_APPROVER_PUBLIC_KEY||''});
