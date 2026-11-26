import cytoscape from 'cytoscape';
import {NOTE_TYPES,notebookModel,visibleNotes} from '../../packages/provenance/src/notebook.js';
const $=id=>document.getElementById(id);
const text=(tag,value,cls)=>{const n=document.createElement(tag);n.textContent=value;if(cls)n.className=cls;return n;};
let model=null,cy=null,selected='origin',record=null;
function choose(id){
  $('node-search').value='';$('node-type').value='all';
  const position=model.notes.findIndex(n=>n.eventId===id);if(Number($('replay-step').value)<position)$('replay-step').value=String(position);
  filter();document.dispatchEvent(new CustomEvent('phishnet:select-event',{detail:id}));
}
function filter(){
  if(!model||!cy)return;
  const through=Number($('replay-step').value),notes=visibleNotes(model,{query:$('node-search').value,type:$('node-type').value,through});const ids=new Set(notes.map(n=>n.eventId));
  cy.nodes().forEach(n=>n.style('display',ids.has(n.id())?'element':'none'));
  cy.edges().forEach(e=>e.style('display',ids.has(e.source().id())&&ids.has(e.target().id())?'element':'none'));
  document.querySelectorAll('#timeline [data-event],#graph [data-event]').forEach(b=>{b.hidden=!ids.has(b.dataset.event);if(b.closest('li'))b.closest('li').hidden=b.hidden;});
  if(!ids.has(selected)){if(notes.length)document.dispatchEvent(new CustomEvent('phishnet:select-event',{detail:notes[0].eventId}));else{$('note-title').textContent='No matching note';$('note-kind').textContent='FILTERED VIEW';$('detail').replaceChildren();$('note-links').replaceChildren();}}
  const time=model.notes[through]?.timestamp?.slice(11,19)||'—';$('replay-position').textContent=`${through+1}/${model.notes.length} · ${time} UTC`;
  $('map-summary').textContent=`${notes.length} of ${model.notes.length} notes shown. ${notes.length?'Drag nodes, pan the map or zoom.':'No notes match. Clear search or change the type/replay filter.'}`;
}
function select(id){
  if(!model||!cy)return;selected=id;
  cy.elements().removeClass('selected-note linked-note');const target=cy.getElementById(id);target.addClass('selected-note');target.connectedEdges().addClass('linked-note');target.neighborhood('node').addClass('linked-note');
  const n=model.notes.find(n=>n.eventId===id);if(!n)return;
  $('note-kind').textContent=`${NOTE_TYPES[n.kind].symbol} ${NOTE_TYPES[n.kind].label.toUpperCase()} · ${n.eventId}`;$('note-title').textContent=n.title;
  const links=$('note-links');links.replaceChildren(text('h4','Linked notes & backlinks'));
  const related=model.edges.filter(e=>e.from===id||e.to===id);
  if(!related.length)links.append(text('p','No recorded links. Absence of a link is not evidence of independence.'));
  for(const e of related){const other=e.from===id?e.to:e.from;const note=model.notes.find(n=>n.eventId===other);const b=text('button',`[[${note.title}]]`);b.onclick=()=>choose(other);links.append(b,text('small',`${e.from===id?'Outgoing':'Backlink'} · ${e.kind} · ${e.why}`));}
}
function mount(data){
  record=data;model=notebookModel(data);if(cy)cy.destroy();
  const categories=Object.keys(NOTE_TYPES);const groups=new Map();
  const elements=model.notes.map(n=>{const type=NOTE_TYPES[n.kind];const group=categories.indexOf(n.kind);const offset=groups.get(group)||0;groups.set(group,offset+1);const angle=-Math.PI*.85+group*Math.PI*.25;const radius=170+offset*90;return {data:{id:n.eventId,label:`${type.symbol} ${type.label}\n${n.title}`,kind:n.kind,color:type.color},position:{x:400+Math.cos(angle)*radius,y:290+Math.sin(angle)*radius}};});
  elements.push(...model.edges.map(e=>({data:{id:e.id,source:e.from,target:e.to,kind:e.kind,dashed:e.kind==='Inferred influence'?'dashed':['Unknown','Unverified relation'].includes(e.kind)?'dotted':'solid'}})));
  cy=cytoscape({container:$('knowledge-map'),elements,layout:{name:'preset',fit:true,padding:65},minZoom:.25,maxZoom:3,wheelSensitivity:.25,style:[
    {selector:'node',style:{width:20,height:20,'background-color':'data(color)',label:'data(label)',color:'#d4d3de','font-size':15,'text-valign':'bottom','text-margin-y':9,'text-wrap':'wrap','text-max-width':140,'border-width':1,'border-color':'#24222c'}},
    {selector:'node[kind="proposal"]',style:{shape:'diamond',width:32,height:32}},
    {selector:'node[kind="consent"]',style:{shape:'hexagon',width:28,height:28}},
    {selector:'edge',style:{width:1.3,'line-color':'#77718f','line-opacity':.55,'curve-style':'bezier','line-style':'data(dashed)','target-arrow-shape':'triangle','target-arrow-color':'#77718f','arrow-scale':.7}},
    {selector:'.selected-note',style:{width:34,height:34,'border-width':3,'border-color':'#e2d8ff','background-color':'#9774e0','font-weight':'bold',color:'#f5edff','z-index':20}},
    {selector:'edge.linked-note',style:{width:2,'line-color':'#bc9ef5','line-opacity':1,'target-arrow-color':'#bc9ef5'}},
    {selector:'node.linked-note',style:{'border-color':'#c4acef','border-width':2}}
  ]});
  cy.on('tap','node',event=>choose(event.target.id()));
  cy.on('tap','edge',event=>{const edge=model.edges.find(e=>e.id===event.target.id());choose(edge.to);const p=text('p',`${edge.kind}: ${edge.why}${edge.confidence?' Confidence: '+edge.confidence:''}`);$('note-links').prepend(p);});
  $('replay-step').max=String(model.notes.length-1);$('replay-step').value=String(model.notes.length-1);
  $('node-search').value='';$('node-type').value='all';
  const legend=$('map-legend');legend.replaceChildren(...Object.entries(NOTE_TYPES).map(([id,t])=>{const b=text('button',`${t.symbol} ${t.label}`);b.dataset.kind=id;b.onclick=()=>{$('node-type').value=$('node-type').value===id?'all':id;filter();};return b;}));
  filter();select('origin');requestAnimationFrame(()=>{cy.resize();cy.fit(undefined,65);});
}
document.addEventListener('phishnet:case',event=>mount(event.detail));
document.addEventListener('phishnet:selection',event=>select(event.detail.eventId));
$('node-search').oninput=filter;$('node-type').onchange=filter;$('replay-step').oninput=filter;
$('fit-map').onclick=()=>{cy?.resize();cy?.fit(cy.elements(':visible'),65);};
$('zoom-in').onclick=()=>cy?.zoom(Math.min(cy.maxZoom(),cy.zoom()*1.25));$('zoom-out').onclick=()=>cy?.zoom(Math.max(cy.minZoom(),cy.zoom()/1.25));
$('knowledge-map').onkeydown=event=>{if(event.key==='+'||event.key==='='){$('zoom-in').click();event.preventDefault();}if(event.key==='-'){$('zoom-out').click();event.preventDefault();}if(event.key==='Home'){$('fit-map').click();event.preventDefault();}};
new ResizeObserver(()=>{if(cy&&$('knowledge-map').clientWidth){cy.resize();cy.fit(cy.elements(':visible'),65);}}).observe($('knowledge-map'));
document.dispatchEvent(new Event('phishnet:notebook-ready'));

fetch('/v1/testnet/consent/config').then(r=>{if(!r.ok)throw Error('Unavailable');return r.json();}).then(config=>{$('consent-profile').textContent=config.configured?'counter-sign 0.2 · Independent human key enrolled':'Wallet confirmation required · counter-sign approver not enrolled';$('consent-profile-detail').textContent=config.detail;}).catch(()=>{$('consent-profile').textContent='Consent configuration unavailable';});
