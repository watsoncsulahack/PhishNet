import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
export const VERSION='phishnet.event.v1';
export const PROFILE='phishnet.sorted-json.v1';
const id={type:'string',minLength:1,maxLength:160,pattern:'^[A-Za-z0-9:._-]+$'};
const digest={type:'string',pattern:'^[a-f0-9]{64}$'};
const address={type:'string',pattern:'^0x[0-9a-f]{40}$'};
const hash={type:'string',pattern:'^0x[0-9a-fA-F]{64}$'};
const uint={type:'string',pattern:'^(0|[1-9][0-9]{0,59})$'};
const text={type:'string',maxLength:500};
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const refs={type:'array',items:id,maxItems:32,uniqueItems:true};
const content={contentRef:id,contentDigest:digest};
const proposal={proposalId:id};
const payloads={
 'chat.user.submitted':object(content),
 'agent.tool.requested':object({toolCallId:id,tool:{enum:['wallet.balance','chat.read','payment.propose','plan.report']}}),
 'tool.result.observed':object({toolCallId:id,tool:text,resultRef:id}),
 'agent.plan.reported':object({...content,sourceEventIds:refs}),
 'payment.proposed':object({...proposal,from:address,recipient:address,amountBaseUnits:uint,asset:{const:'native-USDC'},decimals:{const:18},chainId:{const:5042002},initiator:{enum:['human','agent']},purposeRef:id},['proposalId','from','recipient','amountBaseUnits','asset','decimals','chainId','initiator']),
 'payment.validated':object({...proposal,transactionDigest:digest,feeBaseUnits:uint},['proposalId','transactionDigest']),
 'policy.evaluated':object({...proposal,decision:{enum:['ALLOW','HOLD','DENY']},reasonCodes:{type:'array',items:id,minItems:1,maxItems:20}}),
 'countersign.intent.created':object({...proposal,consentIntentId:id,intentDigest:digest}),
 'countersign.resolution.verified':object({...proposal,consentIntentId:id,decision:{enum:['approve','reject']},signer:text}),
 'wallet.authorization.requested':object({...proposal,consentIntentId:id},['proposalId']),
 'wallet.submission.observed':object({...proposal,txHash:hash}),
 'wallet.rejected':object({...proposal,reasonCode:{enum:['USER_REJECTED','CANCELLED','REQUEST_FAILED']}}),
 'chain.receipt.checked':object({...proposal,txHash:hash,status:{enum:['BROADCAST','CONFIRMED','FAILED','MISMATCH','UNVERIFIED']},blockNumber:uint,feeBaseUnits:uint,verificationRef:id},['proposalId','txHash','status']),
 'history.imported':object({txHash:hash,from:address,recipient:address,amountBaseUnits:uint}),
 'payment.status.changed':object({...proposal,status:{enum:['PROPOSED','PENDING_APPROVAL','APPROVED','AUTHORIZATION_REQUESTED','REJECTED','EXPIRED','WALLET_REJECTED','BROADCAST','CONFIRMED','FAILED','UNVERIFIED']},reasonCode:id}),
 'agent.connector.changed':object({agentId:id,action:{enum:['issued','revoked']}}),
 'audit.checkpoint.created':object({checkpointId:id,firstSequence:{type:'integer',minimum:1},lastSequence:{type:'integer',minimum:1},root:digest,checkpointDigest:digest}),
 'audit.checkpoint.published':object({checkpointId:id,txHash:hash,status:{const:'BROADCAST'}}),
 'audit.checkpoint.checked':object({checkpointId:id,txHash:hash,status:{const:'UNVERIFIED'},reasonCode:id}),
 'audit.checkpoint.verified':object({checkpointId:id,txHash:hash,blockNumber:uint,status:{const:'ANCHORED'}}),
};
export const eventSchema={
 $schema:'https://json-schema.org/draft/2020-12/schema', $id:'https://phishnet.local/schema/event-trace-v1',
 ...object({schemaVersion:{const:VERSION},eventId:id,traceId:id,sequence:{type:'integer',minimum:1},eventType:{enum:Object.keys(payloads)},observedAt:{type:'string',format:'date-time',pattern:'Z$'},recordedAt:{type:'string',format:'date-time',pattern:'Z$'},recordedBy:{enum:['ui-gateway','agent-gateway','payment-gateway','consent-verifier','wallet-observer','chain-verifier','audit-publisher','import-gateway']},actor:object({id,type:{enum:['human','agent','service']}}),origin:{enum:['user-ui','agent-runtime','payment-gateway','consent-verifier','wallet-provider','chain-rpc','audit-publisher','browser-import']},walletScope:object({chainId:{const:5042002},address}),links:object({proposalId:id,consentIntentId:id,txHash:hash,toolCallId:id,parentEventIds:refs},['parentEventIds']),relations:{type:'array',items:object({eventId:id,kind:{enum:['OBSERVED_REFERENCE','INFERRED_DEPENDENCY']},evidenceIds:refs}),maxItems:32},privacy:{enum:['private-reference','wallet-record','public-commitment']},verification:object({state:{enum:['LOCAL_OBSERVATION','AGENT_REPORTED','WALLET_REPORTED','CRYPTOGRAPHICALLY_VERIFIED','RPC_VERIFIED','UNTRUSTED_IMPORT','UNKNOWN']},method:text,confidence:{enum:['not_applicable','unknown','low','medium','high']}}),payload:{type:'object'},integrity:object({profile:{const:PROFILE},previousDigest:digest,eventDigest:digest,authentication:{const:'unsigned-local'}})}),
 allOf:Object.entries(payloads).map(([type,payload])=>({if:{properties:{eventType:{const:type}},required:['eventType']},then:{properties:{payload}}}))
};
const ajv=new Ajv2020({allErrors:true,strict:false});addFormats(ajv);const validate=ajv.compile(eventSchema);
export function assertEvent(event){if(!validate(event))throw Error('Invalid EventTraceV1: '+ajv.errorsText(validate.errors));return event;}
export function canonical(value){
 if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
 if(typeof value==='number'){if(!Number.isSafeInteger(value))throw Error('Only safe integer JSON numbers are canonical.');return JSON.stringify(value);}
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&Object.getPrototypeOf(value)===Object.prototype)return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 throw Error('Non-JSON canonical value.');
}
