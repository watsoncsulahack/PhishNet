import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';import path from 'node:path';
import {createHash,randomBytes,randomUUID,createCipheriv,createDecipheriv} from 'node:crypto';
import {generateKeypair} from '@countersignlabs/counter-sign';
import {assertEvent,canonical,VERSION,PROFILE} from './contract.js';
import {sha,eventDigest} from './digest.js';
export {sha,eventDigest} from './digest.js';
const rules={
 'chat.user.submitted':['ui-gateway','user-ui','LOCAL_OBSERVATION'],
 'agent.tool.requested':['agent-gateway','agent-runtime','AGENT_REPORTED'],
 'tool.result.observed':['agent-gateway','agent-runtime','LOCAL_OBSERVATION'],
 'agent.plan.reported':['agent-gateway','agent-runtime','AGENT_REPORTED'],
 'payment.proposed':['payment-gateway','payment-gateway','LOCAL_OBSERVATION'],
 'payment.validated':['payment-gateway','payment-gateway','LOCAL_OBSERVATION'],
 'policy.evaluated':['payment-gateway','payment-gateway','LOCAL_OBSERVATION'],
 'countersign.intent.created':['consent-verifier','consent-verifier','CRYPTOGRAPHICALLY_VERIFIED'],
 'countersign.resolution.verified':['consent-verifier','consent-verifier','CRYPTOGRAPHICALLY_VERIFIED'],
 'wallet.authorization.requested':['wallet-observer','user-ui','LOCAL_OBSERVATION'],
 'wallet.submission.observed':['wallet-observer','wallet-provider','WALLET_REPORTED'],
 'wallet.rejected':['wallet-observer','wallet-provider','WALLET_REPORTED'],
 'chain.receipt.checked':['chain-verifier','chain-rpc','RPC_VERIFIED'],
 'history.imported':['import-gateway','browser-import','UNTRUSTED_IMPORT'],
 'payment.status.changed':['payment-gateway','payment-gateway','LOCAL_OBSERVATION'],
 'agent.connector.changed':['ui-gateway','user-ui','LOCAL_OBSERVATION'],
 'audit.checkpoint.created':['audit-publisher','audit-publisher','LOCAL_OBSERVATION'],
 'audit.checkpoint.published':['audit-publisher','wallet-provider','WALLET_REPORTED'],
 'audit.checkpoint.checked':['audit-publisher','chain-rpc','UNKNOWN'],
 'audit.checkpoint.verified':['audit-publisher','chain-rpc','RPC_VERIFIED']
};
export class Journal{
 constructor(directory){
  this.directory=directory;fs.mkdirSync(directory,{recursive:true,mode:0o700});fs.chmodSync(directory,0o700);
  this.keysDirectory=path.join(directory,'keys');fs.mkdirSync(this.keysDirectory,{recursive:true,mode:0o700});
  const file=path.join(directory,'journal.sqlite');this.db=new DatabaseSync(file);fs.chmodSync(file,0o600);
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS events(sequence INTEGER PRIMARY KEY,event_id TEXT UNIQUE NOT NULL,trace_id TEXT NOT NULL,wallet TEXT NOT NULL,event_type TEXT NOT NULL,event_json TEXT NOT NULL,digest TEXT UNIQUE NOT NULL);
   CREATE INDEX IF NOT EXISTS events_wallet_trace ON events(wallet,trace_id,sequence);
   CREATE TABLE IF NOT EXISTS relations(source_id TEXT NOT NULL REFERENCES events(event_id),target_id TEXT NOT NULL REFERENCES events(event_id),kind TEXT NOT NULL,evidence_json TEXT NOT NULL,PRIMARY KEY(source_id,target_id,kind));
   CREATE TABLE IF NOT EXISTS contents(ref TEXT PRIMARY KEY,wallet TEXT NOT NULL,iv TEXT NOT NULL,tag TEXT NOT NULL,ciphertext TEXT NOT NULL,digest TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS proposals(id TEXT PRIMARY KEY,wallet TEXT NOT NULL,trace_id TEXT NOT NULL,status TEXT NOT NULL,record_json TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS consents(id TEXT PRIMARY KEY,wallet TEXT NOT NULL,status TEXT NOT NULL,expires INTEGER NOT NULL,record_json TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,wallet TEXT NOT NULL,expires INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY,wallet TEXT NOT NULL,message TEXT NOT NULL,expires INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS agents(id TEXT PRIMARY KEY,wallet TEXT NOT NULL,token_hash TEXT UNIQUE NOT NULL,record_json TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS chat_jobs(id TEXT PRIMARY KEY,wallet TEXT NOT NULL,trace_id TEXT NOT NULL,agent_id TEXT,content_ref TEXT NOT NULL,event_id TEXT NOT NULL REFERENCES events(event_id),status TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS checkpoints(id TEXT PRIMARY KEY,record_json TEXT NOT NULL);
   CREATE TRIGGER IF NOT EXISTS events_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'Journal events are append-only'); END;
   CREATE TRIGGER IF NOT EXISTS events_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'Journal events are append-only'); END;
   CREATE TRIGGER IF NOT EXISTS relations_no_update BEFORE UPDATE ON relations BEGIN SELECT RAISE(ABORT,'Journal relations are append-only'); END;
   CREATE TRIGGER IF NOT EXISTS relations_no_delete BEFORE DELETE ON relations BEGIN SELECT RAISE(ABORT,'Journal relations are append-only'); END;
   PRAGMA user_version=1;`);
  for(const suffix of ['-wal','-shm']){try{fs.chmodSync(file+suffix,0o600);}catch{}}
  this.depth=0;this.contentKey=this.secret('content-aes256',()=>randomBytes(32).toString('hex'));this.verifyLocal();
 }
 close(){this.db.close();}
 transaction(fn){const depth=this.depth++;const save=`nested_${depth}`;try{this.db.exec(depth?`SAVEPOINT ${save}`:'BEGIN IMMEDIATE');const result=fn();if(result?.then)throw Error('Journal transactions must be synchronous.');this.db.exec(depth?`RELEASE SAVEPOINT ${save}`:'COMMIT');return result;}catch(error){try{this.db.exec(depth?`ROLLBACK TO SAVEPOINT ${save}; RELEASE SAVEPOINT ${save}`:'ROLLBACK');}catch{}throw error;}finally{this.depth--;}}
 secret(name,create){if(!/^[a-z0-9-]+$/.test(name))throw Error('Invalid key name');const file=path.join(this.keysDirectory,name+'.json');try{fs.writeFileSync(file,JSON.stringify(create()),{flag:'wx',mode:0o600});}catch(error){if(error.code!=='EEXIST')throw error;}return JSON.parse(fs.readFileSync(file,'utf8'));}
 signer(name){return this.secret(name,generateKeypair);}
 putContent(wallet,value){if(typeof value!=='string'||Buffer.byteLength(value)>32000)throw Error('Private content exceeds 32KB.');const ref='content-'+randomUUID(),iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',Buffer.from(this.contentKey,'hex'),iv);cipher.setAAD(Buffer.from(wallet));const ciphertext=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);const digest=sha(Buffer.concat([iv,cipher.getAuthTag(),ciphertext]));this.db.prepare('INSERT INTO contents VALUES(?,?,?,?,?,?)').run(ref,wallet,iv.toString('hex'),cipher.getAuthTag().toString('hex'),ciphertext.toString('hex'),digest);return {contentRef:ref,contentDigest:digest};}
 content(wallet,ref){const row=this.db.prepare('SELECT * FROM contents WHERE ref=? AND wallet=?').get(ref,wallet);if(!row)throw Error('Private source not found in wallet scope.');const decipher=createDecipheriv('aes-256-gcm',Buffer.from(this.contentKey,'hex'),Buffer.from(row.iv,'hex'));decipher.setAAD(Buffer.from(wallet));decipher.setAuthTag(Buffer.from(row.tag,'hex'));return Buffer.concat([decipher.update(Buffer.from(row.ciphertext,'hex')),decipher.final()]).toString('utf8');}
 append(draft,component){return this.transaction(()=>{
   const rule=rules[draft.eventType];if(!rule||rule[0]!==component)throw Error('Component cannot assign this event or verification state.');
   const head=this.db.prepare('SELECT sequence,digest FROM events ORDER BY sequence DESC LIMIT 1').get();const sequence=(head?.sequence||0)+1;
   const now=new Date().toISOString(),parents=[...new Set(draft.links?.parentEventIds||[])];
   for(const parent of parents){const row=this.db.prepare('SELECT wallet,trace_id FROM events WHERE event_id=?').get(parent);if(!row||row.wallet!==draft.walletScope.address||row.trace_id!==draft.traceId)throw Error('Missing, cross-trace or cross-wallet parent reference.');}
   const event={schemaVersion:VERSION,eventId:'evt-'+randomUUID(),traceId:draft.traceId,sequence,eventType:draft.eventType,observedAt:now,recordedAt:now,recordedBy:component,actor:structuredClone(draft.actor),origin:rule[1],walletScope:structuredClone(draft.walletScope),links:{...draft.links,parentEventIds:parents},relations:parents.map(eventId=>({eventId,kind:'OBSERVED_REFERENCE',evidenceIds:[eventId]})),privacy:draft.eventType.startsWith('audit.')?'public-commitment':draft.eventType==='agent.plan.reported'||draft.eventType==='chat.user.submitted'?'private-reference':'wallet-record',verification:{state:rule[2],method:component+'-v1',confidence:rule[2]==='AGENT_REPORTED'?'unknown':'not_applicable'},payload:structuredClone(draft.payload),integrity:{profile:PROFILE,previousDigest:head?.digest||'0'.repeat(64),eventDigest:'0'.repeat(64),authentication:'unsigned-local'}};
   if(draft.verification||draft.sequence||draft.recordedBy||draft.eventId||draft.integrity)throw Error('Recorder fields cannot be supplied by a caller.');
   if(draft.eventType==='chain.receipt.checked'&&['UNVERIFIED','BROADCAST','MISMATCH'].includes(draft.payload.status))event.verification={state:'UNKNOWN',method:component+'-v1',confidence:'unknown'};
   event.integrity.eventDigest=eventDigest(event);assertEvent(event);
   this.db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?,?)').run(sequence,event.eventId,event.traceId,event.walletScope.address,event.eventType,canonical(event),event.integrity.eventDigest);
   for(const relation of event.relations)this.db.prepare('INSERT INTO relations VALUES(?,?,?,?)').run(relation.eventId,event.eventId,relation.kind,canonical(relation.evidenceIds));return event;
 });}
 events(wallet,{traceId=null,after=0,limit=1000}={}){if(!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(limit)||limit<1||limit>5000)throw Error('Invalid journal range.');return this.db.prepare('SELECT event_json FROM events WHERE wallet=? AND sequence>? AND (? IS NULL OR trace_id=?) ORDER BY sequence LIMIT ?').all(wallet,after,traceId,traceId,limit).map(r=>JSON.parse(r.event_json));}
 verifyLocal(){const rows=this.db.prepare('SELECT * FROM events ORDER BY sequence').all();let previous='0'.repeat(64),sequence=0;for(const row of rows){const e=JSON.parse(row.event_json);assertEvent(e);if(e.sequence!==++sequence||row.sequence!==sequence||row.wallet!==e.walletScope.address||row.trace_id!==e.traceId||row.event_id!==e.eventId||row.event_type!==e.eventType||row.digest!==e.integrity.eventDigest||e.integrity.previousDigest!==previous||eventDigest(e)!==row.digest)throw Error('Local journal integrity check failed. External checkpoint verification is required for tamper/rollback assurance.');previous=row.digest;}return {count:sequence,head:previous,authentication:'unsigned-local',independentlyAnchored:false};}
}
