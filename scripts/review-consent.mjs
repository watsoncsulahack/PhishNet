// Run on the human-controlled signing machine; never give the key file to PhishNet or an agent.
import fs from 'node:fs';
import {createInterface} from 'node:readline/promises';
import {verifyIntent,signDecision,publicKeyFromSecret} from '@countersignlabs/counter-sign';
const [intentPath,keyPath,pinnedRequester,decision]=process.argv.slice(2);
if(!intentPath||!keyPath||!pinnedRequester||!['approve','reject'].includes(decision))throw Error('Usage: node scripts/review-consent.mjs intent.json HUMAN_KEY_FILE PINNED_REQUESTER_PUBLIC_KEY approve|reject');
const exported=JSON.parse(fs.readFileSync(intentPath,'utf8')),intent=exported.intent||exported;
if(!verifyIntent(intent)||intent.agent.public_key!==pinnedRequester)throw Error('Untrusted requester or altered intent.');
if(intent.default!=='reject'||intent.action!=='phishnet.payment.native-usdc'||Date.now()>=Date.parse(intent.created_at)+intent.timeout*1000)throw Error('Expired or unsupported intent.');
if(!process.stdin.isTTY)throw Error('Human review requires an interactive terminal on the separate signing device.');
console.error('REVIEW THE EXACT REQUEST ON THIS HUMAN-CONTROLLED DEVICE:\n'+intent.summary);
const terminal=createInterface({input:process.stdin,output:process.stderr});
try{if(await terminal.question(`Type ${decision.toUpperCase()} to countersign this exact request: `)!==decision.toUpperCase())throw Error('Human did not confirm.');}finally{terminal.close();}
const human=JSON.parse(fs.readFileSync(keyPath,'utf8'));
const publicKey=publicKeyFromSecret(human.secretKey);
if(intent.approvers.length!==1||intent.approvers[0].mode!=='keyed'||intent.approvers[0].public_key!==publicKey)throw Error('This signing key is not the independently enrolled approver.');
const receipt=signDecision(intent,decision,intent.approvers[0].actor,human.secretKey);
process.stdout.write(JSON.stringify({decision,policy:'approver',countersignatures:[receipt]},null,2)+'\n');
