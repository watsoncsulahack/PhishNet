/** A projection of recorded observations, never a reconstruction of hidden reasoning. */
const flow=new Set(['payment.proposed','wallet.submission.observed','chain.receipt.checked','chain.transaction.observed','history.imported']);
const chainOnly=new Set(['history.imported','wallet.submission.observed','chain.receipt.checked','chain.transaction.observed']);
function fmtUsdc(units){
 try{
  const n=BigInt(units),whole=n/1000000000000000000n,frac=(n%1000000000000000000n).toString().padStart(18,'0').slice(0,6).replace(/0+$/,'');
  return frac?`${whole}.${frac}`:whole.toString();
 }catch{return '';}
}
export function eventSummaryLabel(e){
 const p=e.payload||{};
 switch(e.eventType){
  case 'chat.user.submitted': return 'Human message';
  case 'agent.tool.requested': return 'Tool: '+(p.tool||'request');
  case 'tool.result.observed': return 'Result: '+(p.tool||'tool');
  case 'agent.plan.reported': return 'Agent plan';
  case 'agent.message.reported': return 'Agent reply';
  case 'payment.proposed': return 'Proposal · '+(p.amountBaseUnits?fmtUsdc(p.amountBaseUnits)+' USDC':'draft');
  case 'payment.validated': return 'Terms validated';
  case 'policy.evaluated': return 'Policy: '+(p.decision||'CHECK');
  case 'countersign.intent.created': return 'Consent intent';
  case 'countersign.resolution.verified': return 'Consent: '+(p.decision||'checked');
  case 'wallet.authorization.requested': return 'Wallet prompt';
  case 'wallet.submission.observed': return 'Tx submitted';
  case 'wallet.rejected': return 'Wallet rejected';
  case 'chain.receipt.checked': return 'Receipt: '+(p.status||'CHECKED');
  case 'chain.transaction.observed':{const dir=p.direction==='incoming'?'↙ Incoming':p.direction==='outgoing'?'↗ Outgoing':'⇄ Self';return `${dir} · ${fmtUsdc(p.amountBaseUnits)} USDC`;}
  case 'history.imported': return 'Imported tx · '+(p.amountBaseUnits?fmtUsdc(p.amountBaseUnits)+' USDC':'untrusted');
  case 'payment.status.changed': return 'Status: '+(p.status||'UPDATED');
  case 'agent.connector.changed': return 'Connector: '+(p.action||'changed');
  default: return e.eventType;
 }
}
const coreEvents=new Set([
 'chat.user.submitted',
 'agent.plan.reported',
 'agent.message.reported',
 'payment.proposed',
 'countersign.resolution.verified',
 'wallet.submission.observed',
 'wallet.rejected',
 'chain.receipt.checked',
 'chain.transaction.observed',
 'history.imported',
 'audit.checkpoint.created',
 'audit.checkpoint.published',
 'audit.checkpoint.verified'
]);
export function projectJournal(events,{wallet,from='',through='',trace='',transactionFlow=true,decisionHistory=true,query='',compact=false}={}){
 const scoped=events.filter(e=>e.walletScope.address===wallet&&(!from||e.recordedAt>=from)&&(!through||e.recordedAt<=through)&&(!trace||e.traceId===trace));
 const visible=scoped.filter(e=>((transactionFlow&&flow.has(e.eventType))||(decisionHistory&&!chainOnly.has(e.eventType)))&&(!query||JSON.stringify(e).toLowerCase().includes(query.toLowerCase())));
 const rawNodes=visible.map(e=>({id:e.eventId,eventId:e.eventId,event:e,label:eventSummaryLabel(e),eventType:e.eventType,kind:e.eventType==='payment.proposed'?'proposal':e.eventType.startsWith('countersign.')?'consent':e.eventType.startsWith('chain.')?'receipt':e.eventType.startsWith('agent.')?'agent':'event',layers:[...(flow.has(e.eventType)?['transaction']:[]),...(!chainOnly.has(e.eventType)?['decision']:[])]}));
 if(!compact){
  const ids=new Set(rawNodes.map(n=>n.id));const edges=[];
  for(const e of visible)for(const [i,r] of e.relations.entries())if(ids.has(r.eventId))edges.push({id:'relation:'+e.eventId+':'+i,source:r.eventId,target:e.eventId,kind:r.kind,evidenceIds:r.evidenceIds,event:e});
  if(transactionFlow){for(const e of visible.filter(e=>['payment.proposed','history.imported','chain.transaction.observed'].includes(e.eventType))){for(const [role,value] of [['sender',e.payload.from],['recipient',e.payload.recipient],['asset','native-USDC']]){const id=role==='asset'?'asset:5042002:native-USDC':'wallet:5042002:'+value;const label=role==='asset'?'Native USDC (Arc)':`Wallet ${value.slice(0,6)}…${value.slice(-4)}`;const existing=rawNodes.find(n=>n.id===id);if(existing){if(!existing.evidence.includes(e.eventId))existing.evidence.push(e.eventId);}else rawNodes.push({id,label,fullLabel:value,kind:role==='asset'?'asset':'wallet',eventId:e.eventId,event:e,evidence:[e.eventId],layers:['transaction']});edges.push({id:'context:'+e.eventId+':'+role,source:role==='sender'?id:e.eventId,target:role==='sender'?e.eventId:id,kind:'RECORDED_'+role.toUpperCase(),evidenceIds:[e.eventId],event:e});}}}
  return {nodes:rawNodes,edges,events:visible,total:scoped.length,hiddenLayers:!transactionFlow&&!decisionHistory,condensedCount:0};
 }
 const nodes=[],displayId=new Map(),clusters=new Map();
 let runKey=null,runGroup=null;
 const flushRun=()=>{
  if(!runGroup)return;
  const first=runGroup[0],cid=`cluster:${first.traceId}:${first.eventId}`;
  for(const item of runGroup)displayId.set(item.eventId,cid);
  const layers=[...new Set(runGroup.flatMap(e=>[...(flow.has(e.eventType)?['transaction']:[]),...(!chainOnly.has(e.eventType)?['decision']:[])]))];
  const node={id:cid,eventId:first.eventId,event:first,label:`+${runGroup.length} ${runGroup.length===1?'detail':'details'}`,kind:'cluster',clusterEvents:runGroup,evidence:runGroup.map(e=>e.eventId),layers};
  nodes.push(node);clusters.set(cid,node);runKey=null;runGroup=null;
 };
 for(const e of visible){
  if(coreEvents.has(e.eventType)){
   flushRun();
   displayId.set(e.eventId,e.eventId);
   nodes.push(rawNodes.find(n=>n.id===e.eventId));
  }else{
   if(runKey!==e.traceId){flushRun();runKey=e.traceId;runGroup=[];}
   runGroup.push(e);
  }
 }
 flushRun();
 const edgeMap=new Map(),visibleSet=new Set(visible.map(e=>e.eventId));
 for(const e of visible){
  const target=displayId.get(e.eventId);
  for(const r of e.relations){
   if(!visibleSet.has(r.eventId))continue;
   const source=displayId.get(r.eventId);
   if(!source||!target||source===target)continue;
   const key=source+'->'+target+':'+r.kind;
   const existing=edgeMap.get(key);
   if(existing){existing.evidenceIds=[...new Set([...existing.evidenceIds,...r.evidenceIds])];}
   else edgeMap.set(key,{id:'edge:'+key,source,target,kind:r.kind,evidenceIds:[...r.evidenceIds],event:e});
  }
 }
 const edges=[...edgeMap.values()];
 if(transactionFlow){for(const e of visible.filter(e=>['payment.proposed','history.imported','chain.transaction.observed'].includes(e.eventType))){for(const [role,value] of [['sender',e.payload.from],['recipient',e.payload.recipient],['asset','native-USDC']]){const id=role==='asset'?'asset:5042002:native-USDC':'wallet:5042002:'+value;const label=role==='asset'?'Native USDC (Arc)':`Wallet ${value.slice(0,6)}…${value.slice(-4)}`;const existing=nodes.find(n=>n.id===id);if(existing){if(!existing.evidence.includes(e.eventId))existing.evidence.push(e.eventId);}else nodes.push({id,label,fullLabel:value,kind:role==='asset'?'asset':'wallet',eventId:e.eventId,event:e,evidence:[e.eventId],layers:['transaction']});edges.push({id:'context:'+e.eventId+':'+role,source:role==='sender'?id:e.eventId,target:role==='sender'?e.eventId:id,kind:'RECORDED_'+role.toUpperCase(),evidenceIds:[e.eventId],event:e});}}}
 return {nodes,edges,events:visible,total:scoped.length,hiddenLayers:!transactionFlow&&!decisionHistory,condensedCount:visible.filter(e=>!coreEvents.has(e.eventType)).length};
}
