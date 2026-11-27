import cytoscape from 'cytoscape';
import {projectJournal,eventSummaryLabel} from '../../packages/provenance/src/live.js';
import {ARC,displayUSDC} from '../../packages/payments/src/transfer.js';
const el=(tag,text,attrs={})=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;};
export function mountLiveGraph({container,source,selectProposal,onSync}){
 container.innerHTML=`<div class="live-workspace"><div class="live-topbar"><div class="live-topbar-status"><span id="live-wallet-scope"></span><p id="live-summary" role="status"></p></div><div class="live-filters journal-filters"><label>From <input id="live-from" type="date"></label><label>Through <input id="live-through" type="date"></label><label class="wide-filter">Trace <select id="live-trace-filter"><option value="">All recorded traces</option></select></label><label class="wide-filter">Find <input id="live-search" type="search" placeholder="Event ID, actor, hash"></label><label class="layer-switch"><input id="layer-transactions" type="checkbox" checked>Transaction Flow</label><label class="layer-switch"><input id="layer-decisions" type="checkbox" checked>Decision History</label><label class="layer-switch"><input id="layer-compact" type="checkbox" checked>Core flow</label><div class="live-map-actions"><button id="live-fit" type="button">Fit</button><button id="live-zoom-in" type="button" aria-label="Zoom in live map">+</button><button id="live-zoom-out" type="button" aria-label="Zoom out live map">−</button><button id="live-sync-chain" type="button">Sync on-chain</button></div></div></div><section class="live-pane live-timeline-pane"><h2>Chronological journal</h2><ol id="live-timeline" class="live-timeline"></ol></section><section class="live-pane live-map-pane"><h2>Knowledge map</h2><div id="live-map" class="live-map" role="group" tabindex="0" aria-label="Wallet event graph. Use arrow keys to step nodes, plus and minus to zoom, or use the keyboard indexes below."></div><p class="live-legend">Solid arrow: observed reference or recorded field. Dashed: recorded inference. Small bubbles: condensed internal steps.</p><div class="live-indexes"><details><summary>Keyboard node index</summary><div id="live-node-index"></div></details><details><summary>Inspect relationships</summary><div id="live-edge-index"></div></details></div></section><section id="live-inspector" class="live-pane"><h2 id="live-note-title" tabindex="-1">Original event</h2><div id="live-detail" aria-live="polite">Sign in with the selected wallet to inspect actual records.</div></section></div>`;
 const $=id=>container.querySelector('#'+id);let events=[],wallet=null,selected=null,model={nodes:[],edges:[]},cy=null,lastNodeSignature='';
 $('live-from').value=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
 function inspect(id,focus=false,relation=null){
  let item=model.nodes.find(n=>n.id===id),targetEvent=null;
  if(!item){
   const cluster=model.nodes.find(n=>n.clusterEvents?.some(ce=>ce.eventId===id));
   if(cluster){item=cluster;targetEvent=cluster.clusterEvents.find(ce=>ce.eventId===id);}
  }
  if(!item)return;
  selected=targetEvent?targetEvent.eventId:item.id;
  cy?.elements().removeClass('chosen neighbor');
  cy?.getElementById(item.id).addClass('chosen').neighborhood().addClass('neighbor');
  container.querySelectorAll('[data-live-node]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.liveNode===selected||b.dataset.liveNode===item.id)));
  const detail=$('live-detail');detail.replaceChildren();
  if(item.kind==='cluster'&&!targetEvent){
   detail.append(el('p',`${item.clusterEvents.length} intermediate detail step(s) condensed into this bubble so the map stays focused on human messages, agent actions, proposals, consent, and on-chain transfers.`));
   const expand=el('button','Expand all detail steps on map');expand.onclick=()=>{$('layer-compact').checked=false;draw();inspect(item.clusterEvents[0].eventId,true);};detail.append(expand);
   const heading=el('h3','Steps inside this bubble');detail.append(heading);
   for(const ce of item.clusterEvents){const b=el('button',`${eventSummaryLabel(ce)} · ${ce.eventType} #${ce.sequence}`);b.onclick=()=>inspect(ce.eventId,true);detail.append(b);}
   if(relation)detail.append(el('pre',JSON.stringify({relationship:relation.kind,source:relation.source,target:relation.target,evidenceIds:relation.evidenceIds},null,2)));
   if(focus)$('live-note-title').focus();
   return;
  }
  const e=targetEvent||item.event;
  if(targetEvent){
   const back=el('button',`Showing step from condensed bubble (+${item.clusterEvents.length}) · View bubble`);
   back.onclick=()=>inspect(item.id,true);
   detail.append(back);
  }
  const dl=el('dl');for(const [name,value] of [['Summary',targetEvent?eventSummaryLabel(targetEvent):item.label],['Event ID',e.eventId],['Record type',e.eventType],['UTC time',e.recordedAt],['Actor',e.actor.type+' · '+e.actor.id],['Wallet scope',e.walletScope.address+' · '+e.walletScope.chainId],['Trace',e.traceId],['Recorder / origin',e.recordedBy+' / '+e.origin],['Verification',e.verification.state+' · '+e.verification.method],['Confidence',e.verification.confidence],['Privacy / redaction',e.privacy+' · private content stored separately'],['Local integrity',e.integrity.authentication+' · digest '+e.integrity.eventDigest],['External proof','Not established by this view. Verify an exported checkpoint with pinned external trust and Arc RPC.']])dl.append(el('dt',name),el('dd',value));detail.append(dl);if(item.kind==='wallet'||item.kind==='asset')detail.prepend(el('p',`Entity (${item.fullLabel||item.label}) projected from recorded transaction fields. Source IDs: `+item.evidence.join(', ')));if(e.eventType==='chain.transaction.observed'){const dir=e.payload.direction==='incoming'?'Incoming':e.payload.direction==='outgoing'?'Outgoing':'Self';detail.prepend(el('p',`${dir} on-chain transfer · ${displayUSDC(e.payload.amountBaseUnits)} USDC (${e.payload.from} → ${e.payload.recipient}) · Block #${e.payload.blockNumber} · Source: ${e.payload.source}`));}if(e.eventType==='agent.plan.reported')detail.prepend(el('p','Agent-reported explanation. No independent confirmation or private chain-of-thought claim.'));if(e.eventType==='history.imported')detail.prepend(el('p','UNTRUSTED_IMPORT · No agent decision or human approval was inferred.'));if(relation)detail.append(el('pre',JSON.stringify({relationship:relation.kind,source:relation.source,target:relation.target,evidenceIds:relation.evidenceIds},null,2)));const ref=e.payload.contentRef||e.payload.purposeRef||e.payload.resultRef||e.payload.verificationRef;if(ref){const b=el('button','Open protected off-chain source');b.onclick=async()=>{try{const r=await source(ref);if(selected===(targetEvent?.eventId||id)&&wallet===e.walletScope.address)detail.append(el('pre',r.text));}catch(err){if(selected===(targetEvent?.eventId||id))detail.append(el('p',err.message));}};detail.append(b);}const txHash=e.payload.txHash||e.links?.txHash;if(txHash){const a=el('a','View transaction on Arc Explorer',{href:ARC.explorer+'/tx/'+txHash,target:'_blank',rel:'noopener noreferrer'});detail.append(a);}if(e.links.proposalId){const b=el('button','Open payment review');b.onclick=()=>selectProposal(e.links.proposalId).catch(err=>detail.append(el('p',err.message)));detail.append(b);}const raw=el('details');raw.append(el('summary','Exact recorded event'),el('pre',JSON.stringify(e,null,2)));detail.append(raw,el('h3','Linked notes & backlinks'));for(const edge of model.edges.filter(x=>x.source===item.id||x.target===item.id)){const other=edge.source===item.id?edge.target:edge.source;const otherNode=model.nodes.find(n=>n.id===other);const b=el('button',edge.kind+' → '+(otherNode?.label||other));b.onclick=()=>inspect(other,true,edge);detail.append(b);}if(focus)$('live-note-title').focus();
 }
 function draw(){
  const previousVisibleCount=cy?.nodes().length||0;
  model=projectJournal(events,{wallet,from:$('live-from').value,through:$('live-through').value?$('live-through').value+'T23:59:59.999Z':'',trace:$('live-trace-filter').value,query:$('live-search').value,transactionFlow:$('layer-transactions').checked,decisionHistory:$('layer-decisions').checked,compact:$('layer-compact').checked});
  const condensedNote=model.condensedCount?` (${model.condensedCount} steps condensed)`:'';
  $('live-summary').textContent=!wallet?'Connect and sign in to view the selected wallet journal.':model.hiddenLayers?'Both layers are hidden. Records and filters are preserved.':`${model.events.length} of ${model.total} events · ${model.nodes.length} nodes · ${model.edges.length} edges${condensedNote}.`;
  const buttons=model.nodes.map(item=>{const b=el('button',item.eventType?`${item.label} (${item.eventType})`:item.fullLabel||item.label,{'data-live-node':item.id,'aria-pressed':String(item.id===selected)});b.onclick=()=>inspect(item.id,true);return b;});$('live-node-index').replaceChildren(...buttons);
  $('live-timeline').replaceChildren(...model.events.map(e=>{const li=el('li'),b=el('button',undefined,{'data-live-node':e.eventId,'aria-pressed':String(e.eventId===selected)});b.append(el('strong',eventSummaryLabel(e)),el('small',e.eventType+' · #'+e.sequence+' · '+e.recordedAt.slice(11,19)+'Z'),el('small',e.verification.state));b.onclick=()=>inspect(e.eventId,true);li.append(b);return li;}));
  $('live-edge-index').replaceChildren(...model.edges.map(edge=>{const sNode=model.nodes.find(n=>n.id===edge.source),tNode=model.nodes.find(n=>n.id===edge.target);const b=el('button',`${edge.kind} · ${sNode?.label||edge.source} → ${tNode?.label||edge.target}`);b.onclick=()=>inspect(edge.target,true,edge);return b;}));
  const elements=[...model.nodes.map(item=>({data:{id:item.id,label:item.label,kind:item.kind,color:{proposal:'#e0b879',consent:'#7ec3ae',receipt:'#80b1db',agent:'#b5a0e5',wallet:'#9aa6ce',asset:'#c5bc81',cluster:'#655c7a',event:'#aba4b5'}[item.kind]}})),...model.edges.map(e=>({data:{id:e.id,source:e.source,target:e.target,dash:e.kind==='INFERRED_DEPENDENCY'?'dashed':'solid'}}))];
  const nodeSig=model.nodes.map(n=>n.id).join('|')+'::'+model.edges.map(e=>e.id).join('|');
  const layoutConfig={name:'breadthfirst',directed:true,padding:35,spacingFactor:1.25,avoidOverlap:true,nodeDimensionsIncludeLabels:true,animate:false};
  if(!cy){
   cy=cytoscape({container:$('live-map'),elements,layout:layoutConfig,minZoom:.12,maxZoom:4,wheelSensitivity:.2,style:[{selector:'node',style:{label:'data(label)','background-color':'data(color)',color:'#f2eef9','font-size':12,'text-valign':'bottom','text-margin-y':8,'text-wrap':'wrap','text-max-width':155,'text-background-color':'#201d29','text-background-opacity':0.88,'text-background-padding':'3px','text-background-shape':'roundrectangle',width:24,height:24}},{selector:'node[kind="cluster"]',style:{shape:'ellipse',width:14,height:14,'font-size':10,color:'#bfb6cf','text-margin-y':5,'border-width':1,'border-color':'#8c80a6'}},{selector:'node[kind="proposal"]',style:{shape:'diamond',width:34,height:34}},{selector:'node[kind="consent"]',style:{shape:'hexagon',width:28,height:28}},{selector:'node[kind="wallet"]',style:{shape:'round-rectangle',width:26,height:22}},{selector:'node[kind="asset"]',style:{shape:'ellipse',width:24,height:24}},{selector:'edge',style:{'curve-style':'bezier','line-color':'#8c7ea0','target-arrow-color':'#8c7ea0','target-arrow-shape':'triangle','line-style':'data(dash)',width:1.6}},{selector:'.chosen',style:{'border-color':'#e5c7ff','border-width':4,width:32,height:32}},{selector:'.neighbor',style:{'line-color':'#c5a2ee','target-arrow-color':'#c5a2ee','border-color':'#c5a2ee','border-width':2}}]});
   cy.on('tap','node',e=>inspect(e.target.id(),true));
   cy.on('tap','edge',e=>{const edge=model.edges.find(x=>x.id===e.target.id());if(edge)inspect(edge.target,true,edge);});
   lastNodeSignature=nodeSig;
  }else if(nodeSig!==lastNodeSignature){
   lastNodeSignature=nodeSig;
   cy.elements().remove();
   cy.add(elements);
   if(elements.length)cy.layout(layoutConfig).run();
  }
  const hasSelected=selected&&(model.nodes.some(x=>x.id===selected)||model.events.some(x=>x.eventId===selected));
  if(hasSelected)inspect(selected);else{$('live-detail').textContent=selected?'Selected record is hidden by current filters. Restore its layer or filters to inspect it.':'Select an event, node or relationship to open its original record.';}
  requestAnimationFrame(()=>{if($('live-map').clientWidth){cy.resize();if(!previousVisibleCount&&cy.nodes().length){cy.fit(undefined,35);if(cy.zoom()<.75){cy.zoom(.75);const target=selected?cy.getElementById(selected):cy.nodes('[kind="proposal"]').first();cy.center(target.length?target:cy.nodes().first());}}}});
 }
 for(const id of ['live-from','live-through','live-trace-filter','layer-transactions','layer-decisions','layer-compact'])$(id).onchange=draw;$('live-search').oninput=draw;
 $('live-fit').onclick=()=>{cy?.resize();cy?.fit(undefined,45);};$('live-zoom-in').onclick=()=>cy?.zoom(Math.min(cy.maxZoom(),cy.zoom()*1.3));$('live-zoom-out').onclick=()=>cy?.zoom(Math.max(cy.minZoom(),cy.zoom()/1.3));$('live-sync-chain').onclick=async()=>{if(!onSync)return;$('live-sync-chain').disabled=true;try{await onSync();}finally{$('live-sync-chain').disabled=!wallet;}};
 $('live-map').onkeydown=e=>{
  if(['+','=','-','Home'].includes(e.key)){e.preventDefault();$(e.key==='Home'?'live-fit':e.key==='-'?'live-zoom-out':'live-zoom-in').click();return;}
  if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(e.key)&&model.nodes.length){
   e.preventDefault();
   const idx=model.nodes.findIndex(n=>n.id===selected);
   const step=(e.key==='ArrowRight'||e.key==='ArrowDown')?1:-1;
   const next=model.nodes[(idx+step+model.nodes.length)%model.nodes.length];
   if(next){inspect(next.id,false);cy?.center(cy.getElementById(next.id));}
  }
 };
 new ResizeObserver(()=>{if($('live-map').clientWidth)cy?.resize();}).observe($('live-map'));document.addEventListener('phishnet:graph-resize',()=>requestAnimationFrame(()=>cy?.resize()));
 return {update(next,scope){if(wallet!==scope){selected=null;$('live-trace-filter').value='';$('live-detail').replaceChildren();}events=next;wallet=scope;$('live-sync-chain').disabled=!scope;$('live-wallet-scope').textContent=scope?'Wallet: '+scope:'No private wallet selected';const trace=$('live-trace-filter').value;$('live-trace-filter').replaceChildren(el('option','All recorded traces',{value:''}),...[...new Set(events.map(e=>e.traceId))].map(t=>el('option',t,{value:t})));if([...$('live-trace-filter').options].some(o=>o.value===trace))$('live-trace-filter').value=trace;draw();},focusTrace(trace){$('live-trace-filter').value=trace;draw();}};
}
