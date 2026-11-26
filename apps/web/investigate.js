const $ = id => document.getElementById(id);
const el = (tag, text, attrs={}) => {const n=document.createElement(tag); if(text!==null)n.textContent=text; for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n;};
let cases=[], current, selected='origin', started=null, observations=[];
const money = v => {const n=BigInt(v);return `${n/1000000n}.${(n%1000000n).toString().padStart(6,'0').slice(0,2)} USDC`;};
function fields(parent, pairs){const dl=el('dl',null); for(const [k,v] of pairs){dl.append(el('dt',k),el('dd',v));}parent.append(dl);}
function selectEvent(id, focus=false){
  selected=id;
  document.querySelectorAll('[data-event]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.event===id)));
  const e=current.events.find(e=>e.eventId===id); const detail=$('detail');detail.replaceChildren();
  fields(detail,[['Event ID',e.eventId],['Actor',e.actor],['Timestamp (UTC)',e.timestamp],['Channel',e.channel],['Source / verification state',e.trust],['Data provenance',current.dataOrigin]]);
  detail.append(el('blockquote',e.text));
  document.dispatchEvent(new CustomEvent('phishnet:selection',{detail:{eventId:id}}));
  if(e.claimId){fields(detail,[['Shared claim ID',e.claimId],['Source convergence',current.claim.summary]]); const b=el('button','Open originating source');b.onclick=()=>selectEvent(current.claim.originEventId,true);detail.append(b);}
  const back=el('button','Back to selected timeline event');back.onclick=()=>{const target=document.querySelector(`#timeline [data-event="${id}"]`);target.focus();target.scrollIntoView({block:'center'});};detail.append(back);
  if(focus){$('source-title').focus();$('source').scrollIntoView({block:'start'});}
  requestAnimationFrame(drawEdges);
}
function drawEdges(){
  const g=$('graph'), svg=g.querySelector('svg');if(!svg)return;svg.replaceChildren();
  const bounds=g.getBoundingClientRect();
  for(const edge of current.edges){const a=g.querySelector(`[data-event="${edge.from}"]`).getBoundingClientRect(),b=g.querySelector(`[data-event="${edge.to}"]`).getBoundingClientRect();const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',`M ${a.x+a.width/2-bounds.x} ${a.y+a.height/2-bounds.y} L ${b.x+b.width/2-bounds.x} ${b.y+b.height/2-bounds.y}`);path.setAttribute('stroke',edge.from===selected||edge.to===selected?'#17594c':'#657c72');path.setAttribute('stroke-width','2');if(edge.kind!=='Observed reference'&&edge.kind!=='Verified independence')path.setAttribute('stroke-dasharray',edge.kind==='Inferred influence'?'7 5':'2 5');svg.append(path);}
}
function render(){
  current=cases.find(c=>c.id===$('case').value); selected='origin'; started=null;$('task-form').hidden=true;$('task-result').textContent='No reviewer observations recorded for this case.';
  const r=$('review');r.replaceChildren();
  const head=el('div',null,{class:'review-head'});const title=el('div',null);title.append(el('p','EXACT PAYMENT REVIEW',{class:'eyebrow'}),el('h2',current.title,{id:'review-title'}));head.append(title,el('span',current.decision.decision==='ALLOW'?'PERMITTED IN SIMULATION':'DENIED',{class:`status ${current.decision.decision==='ALLOW'?'allow':'deny'}`,id:'decision'}));r.append(head,el('div',money(current.proposal.amountBaseUnits),{class:'amount'}),el('p',`Recipient changed from original mandate · ${current.authorization.verified?'New signed fixture mandate authorizes change':'No updated authorization'}`,{id:'change'}));
  r.append(el('p',current.decision.decision==='ALLOW'?'Separate fixture verification, new mandate and exact-payment signature checked.':'Recipient differs from the governing mandate. Agent repetition grants no authority.',{class:'next'}));
  r.append(el('p','SIMULATED · No broadcast or confirmed settlement',{class:'small',id:'settlement'}));
  const comparison=el('div',null,{class:'comparison'});
  for(const [name,m,address] of [['Original mandate',current.originalMandate,current.originalMandate.allowedRecipient],['Proposed payment',current.proposal,current.proposal.recipient]]){const col=el('div',null);col.append(el('h3',name),el('code',address,{class:'address',tabindex:'0'}));const copy=el('button',`Copy ${name.toLowerCase()} address`);copy.onclick=async()=>{try{await navigator.clipboard.writeText(address);copy.textContent='Address copied';}catch{copy.textContent='Select full address above to copy';}};col.append(copy);fields(col,[['Amount',money(m.amountBaseUnits||m.amountMaxBaseUnits)],['Asset / chain',`${m.assetContract} / ${m.chainId} (simulated Arc)`],['Purpose',m.purposeCode],['Validity',m.validUntil||`Governing mandate until ${current.mandate.validUntil}`]]);comparison.append(col);}
  const terms=el('details',null,{id:'payment-comparison'});terms.append(el('summary','Exact payment terms and policy'));r.append(terms);
  terms.append(comparison,el('p',`Policy ${current.decision.policyVersion} · ${current.decision.reasonCodes.join(', ')} · replay clock 2026-11-26 09:10 UTC`,{class:'small'}),el('p',`${current.authorization.method}. ${current.authorization.limitation}`,{class:'note'}),el('p',current.decision.decision==='DENY'?'Next safe action: independently verify the vendor and obtain a new signed mandate.':'Next safe action: inspect the independent evidence. Live execution remains unavailable.',{class:'next'}));
  $('timeline').replaceChildren();$('graph').replaceChildren();$('relations').replaceChildren();
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-hidden','true');$('graph').append(svg);
  for(const e of [...current.events].sort((a,b)=>a.timestamp.localeCompare(b.timestamp))){const li=el('li',null);const b=el('button',null,{'data-event':e.eventId,'aria-pressed':'false'});b.append(el('span',`${e.timestamp.slice(11,16)} UTC · ${e.actor}`),el('strong',e.title),el('span',`${e.eventId} · ${e.trust}`));b.onclick=()=>selectEvent(e.eventId,true);li.append(b);$('timeline').append(li);const node=el('button',`${e.eventId} · ${e.title}`,{'data-event':e.eventId,'aria-pressed':'false'});node.onclick=()=>selectEvent(e.eventId,true);$('graph').append(node);}
  $('convergence').textContent=current.claim.summary;
  for(const edge of current.edges){const b=el('button',`${edge.from} → ${edge.to} · ${edge.kind}`,{class:edge.kind==='Inferred influence'?'inferred':edge.kind==='Unknown'?'unknown':''});b.onclick=()=>{selectEvent(edge.to);fields($('detail'),[['Relationship',edge.kind],['Evidence / limitation',edge.why],['Confidence',edge.confidence||'No quantitative confidence assigned'],['Method',edge.method||'Explicit fixture reference']]);$('source-title').focus();$('source').scrollIntoView({block:'start'});};$('relations').append(b);}
  document.dispatchEvent(new CustomEvent('phishnet:case',{detail:current}));
  selectEvent('origin'); applyCondition();
}
function applyCondition(){$('lineage').hidden=$('study-mode').value==='timeline';}
$('study-mode').onchange=applyCondition;
$('origin-link').onclick=()=>selectEvent('origin',true);
$('case').onchange=render;
$('start-task').onclick=()=>{started=performance.now();$('task-form').hidden=false;$('answer').value='';$('source-answer').value='';$('confidence').value='';$('errors').value='0';$('answer').focus();};
$('task-form').onsubmit=e=>{e.preventDefault();if(started===null||!$('answer').value)return;const confidence=Number($('confidence').value);const correct=$('answer').value===current.decision.decision;const observation={caseId:current.id,condition:$('study-mode').value,recordedAt:new Date().toISOString(),dataOrigin:'Human-entered local observation; not independently validated',decision:$('answer').value,source:$('source-answer').value.trim(),decisionCorrect:correct,sourceCorrect:$('source-answer').value.trim()===current.claim.originEventId,elapsedMs:Math.round(performance.now()-started),confidencePercent:confidence,incorrectConfidencePercent:correct?null:confidence,inputErrors:Number($('errors').value)};observations.push(observation);started=null;$('task-form').hidden=true;$('task-result').textContent=`Recorded ${observations.length} observation(s) locally. Decision ${correct?'correct':'incorrect'}; source ${observation.sourceCorrect?'correct':'incorrect'}; ${observation.elapsedMs} ms. This is not an efficacy result.`;$('download-study').disabled=false;};
$('download-study').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(observations,null,2)],{type:'application/json'}));const a=el('a',null,{href:url,download:'phishnet-review-observations.json'});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
new ResizeObserver(drawEdges).observe($('graph'));
try{const res=await fetch('/v1/investigations');if(!res.ok)throw Error('Unable to load cases');cases=await res.json();$('case').replaceChildren(...cases.map(c=>el('option',c.title,{value:c.id})));$('case').disabled=false;render();}catch(e){$('error').textContent='Cases could not be loaded. Reload to retry. '+e.message;}

document.addEventListener('phishnet:select-event',event=>{if(current?.events.some(e=>e.eventId===event.detail))selectEvent(event.detail,true);});

document.addEventListener('phishnet:notebook-ready',()=>{if(current){document.dispatchEvent(new CustomEvent('phishnet:case',{detail:current}));document.dispatchEvent(new CustomEvent('phishnet:selection',{detail:{eventId:selected}}));}});
