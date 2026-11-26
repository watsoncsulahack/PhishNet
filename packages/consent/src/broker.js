/** counter-sign 0.2 keyed-approver integration. This service never possesses the human key. */
import {createHash} from 'node:crypto';
import {generateKeypair,createIntent,verifyResolution,canonicalize,isCanonicalPublicKey} from '@countersignlabs/counter-sign';
import {transfer,ARC} from '../../payments/src/transfer.js';
export function createConsentBroker({approverPublicKey='',clock=Date.now,agent={id:'phishnet:requester',keypair:generateKeypair()},authority=generateKeypair(),timeout=300}={}){
  if(approverPublicKey&&!isCanonicalPublicKey(approverPublicKey))throw Error('COUNTERSIGN_APPROVER_PUBLIC_KEY must be a canonical raw Ed25519 public key.');
  if(approverPublicKey===agent.keypair.publicKey||approverPublicKey===authority.publicKey)throw Error('The human key must be distinct from requester and runtime keys.');
  const pending=new Map();
  const config=()=>({protocol:'counter-sign 0.2',configured:!!approverPublicKey,mode:'keyed',actor:'human:owner',approverPublicKey:approverPublicKey||null,requesterPublicKey:agent.keypair.publicKey,default:'reject',hardwareAttested:false,detail:approverPublicKey?'Independent keyed receipt required, followed by external wallet transaction approval.':'No independent approver enrolled. Manual wallet approval remains mandatory; agent execution stays unavailable.'});
  function bound(input){const tx=transfer(input);return {tx,digest:createHash('sha256').update('phishnet.native-transfer.v1\n'+canonicalize(tx)).digest('hex')};}
  function get(id){const r=pending.get(id);if(!r)throw Error('Unknown intent. Restarted or expired sessions require a new review.');if(clock()>=r.expiresAt){r.status='EXPIRED';throw Error('Intent expired; silence rejects. Request a new human review.');}return r;}
  return {config,
    create(input){if(!approverPublicKey)throw Error('Independent approver is not configured.');for(const [id,r] of pending)if(clock()>=r.expiresAt)pending.delete(id);if(pending.size>=200)throw Error('Too many pending approval records. Wait for expiry.');
      const {tx,digest}=bound(input);const summary=`Send ${input.amount} native test USDC on ${ARC.name} (${ARC.chainId}) from ${tx.from} to ${tx.to}. Empty calldata. Maximum payment 100 test USDC; wallet reviews network fees separately. Transaction commitment sha256:${digest}.`;
      const intent=createIntent({action:'phishnet.payment.native-usdc',summary,risk_tier:'high',approvers:[{actor:'human:owner',mode:'keyed',public_key:approverPublicKey}],quorum:1,timeout,default:'reject'},agent);
      const created=Date.parse(intent.created_at);const r={intent,input:{...input},digest,status:'PENDING',expiresAt:created+timeout*1000};pending.set(intent.intent_id,r);return {intent,payment:tx,transactionDigest:digest,expiresAt:r.expiresAt,status:r.status};
    },
    accept({intentId,resolution,payment}){const r=get(intentId);if(r.status!=='PENDING')throw Error('Intent already decided or consumed.');if(bound(payment).digest!==r.digest)throw Error('Payment differs from signed intent.');
      if(resolution?.policy!=='approver'||!Array.isArray(resolution.countersignatures)||resolution.countersignatures.length!==1)throw Error('Explicit independent human decision required.');
      verifyResolution(r.intent,resolution,authority.publicKey);
      const receipt=resolution.countersignatures[0],at=Date.parse(receipt.timestamp);if(!Number.isFinite(at)||at<Date.parse(r.intent.created_at)||at>clock()+5000||at>=r.expiresAt)throw Error('Human receipt timestamp is outside the approval window.');
      r.status=resolution.decision==='approve'?'APPROVED':'REJECTED';r.resolution=structuredClone(resolution);return {status:r.status,intentId,transactionDigest:r.digest,resolution:r.resolution};
    },
    consume({intentId,payment}){const r=get(intentId);if(r.status!=='APPROVED')throw Error('Independent human approval is missing, rejected or already consumed.');if(bound(payment).digest!==r.digest)throw Error('Payment changed after approval.');r.status='CONSUMED';return {status:r.status,intentId,transactionDigest:r.digest,resolution:r.resolution};}
  };
}
export const consentBroker=createConsentBroker({approverPublicKey:process.env.COUNTERSIGN_APPROVER_PUBLIC_KEY||''});
