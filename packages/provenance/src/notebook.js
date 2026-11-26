/** Types describe recorded artifacts; never manufacture private reasoning from text. */
export const NOTE_TYPES={intent:{label:'Human intent',color:'#c8b5fa',symbol:'◇'},source:{label:'Source evidence',color:'#79b8f0',symbol:'▧'},interaction:{label:'Interaction',color:'#82c8bf',symbol:'○'},rationale:{label:'Recorded rationale',color:'#caa6e5',symbol:'∴'},proposal:{label:'Payment proposal',color:'#efbd80',symbol:'$'},policy:{label:'Policy decision',color:'#ea8e99',symbol:'□'},consent:{label:'Human consent',color:'#a5d596',symbol:'⊙'},settlement:{label:'Settlement',color:'#a1b6cc',symbol:'▣'}};
export function noteType(event){
  if(event.kind&&NOTE_TYPES[event.kind])return event.kind;
  return {mandate:'intent',origin:'source','agent-1':'interaction','agent-2':'interaction',rationale:'rationale',proposal:'proposal',policy:'policy',consent:'consent',verification:'consent',execution:'settlement'}[event.eventId]||'interaction';
}
export function notebookModel(record){
  const ids=new Set();
  if(!Array.isArray(record.events)||record.events.length>200||!Array.isArray(record.edges)||record.edges.length>600)throw Error('Trace exceeds notebook limits.');
  const notes=record.events.map(e=>{if(!e.eventId||ids.has(e.eventId)||!Number.isFinite(Date.parse(e.timestamp)))throw Error('Invalid note ID or timestamp.');ids.add(e.eventId);return {...e,kind:noteType(e)};}).sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
  const edges=record.edges.map((e,i)=>{if(!ids.has(e.from)||!ids.has(e.to)||e.from===e.to)throw Error('Invalid note relationship.');if(!['Observed reference','Inferred influence','Unverified relation','Unknown','Verified independence'].includes(e.kind))throw Error('Unknown relationship type.');return {...e,id:`relation-${i}`};});
  return {notes,edges};
}
export function visibleNotes(model,{query='',type='all',through=model.notes.length-1}={}){
  const q=query.trim().toLowerCase();return model.notes.slice(0,through+1).filter(n=>(type==='all'||n.kind===type)&&(!q||[n.title,n.actor,n.text,n.eventId].some(t=>String(t).toLowerCase().includes(q))));
}
