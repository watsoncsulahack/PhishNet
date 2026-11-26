#!/usr/bin/env node
// Documentation-only verification. Not a security certification.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'design-reset');
const files = ['README.md','research-context.md','research-references.md','requirements.md','dfd-level-0.mmd','erd-1nf.mmd','erd-2nf.mmd','erd-3nf.mmd','normalization.md','schema-implementation-checklist.md','testing.md','implementation-plan.md','diagrams.md'];
let failed=0;
const test = (name,ok)=>{console.log((ok?'PASS ':'FAIL ')+name);if(!ok)failed++;};
for (const f of files)test('file '+f,fs.existsSync(path.join(dir,f)));
if(failed)process.exit(1);
const read = f=>fs.readFileSync(path.join(dir,f),'utf8');
const r=read('requirements.md');
const ur=[...r.matchAll(/\| UR-\d{2} \|/g)],sr=[...r.matchAll(/\| SR-\d{3} \|/g)];
test('26 user requirements',ur.length===26);
test('50 system requirements',sr.length===50);
const erds=['erd-1nf.mmd','erd-2nf.mmd','erd-3nf.mmd'].map(read);
const getEntities=s=>[...s.matchAll(/^\s{4}([A-Z][A-Z0-9_]*)\s*\{/gm)].map(x=>x[1]);
const getLinks=s=>[...s.matchAll(/^\s{4}([A-Z][A-Z0-9_]*)\s+\|\|--o\{\s+([A-Z][A-Z0-9_]*)\s*:/gm)].map(x=>[x[1],x[2]]);
const coreNames=new Set(getEntities(erds[1]));
for(let i=0;i<3;i++){
  let names=new Set(getEntities(erds[i])); let edges=getLinks(erds[i]);
  if(i===0){names=new Set(edges.flat());}
  test('diagram '+(i+1)+' has 14 entities',names.size===14);
  test('diagram '+(i+1)+' has 20 crow-foot links',edges.length===20);
  test('diagram '+(i+1)+' known entity references',edges.every(([a,b])=>coreNames.has(a)&&coreNames.has(b)));
}
test('relationships consistent',getLinks(erds).length===0 ? false : JSON.stringify(getLinks(erds[0]))===JSON.stringify(getLinks(erds[1]))&&JSON.stringify(getLinks(erds[1]))===JSON.stringify(getLinks(erds[2])));
test('1NF has no attribute blocks',getEntities(erds[0]).length===0);
test('2NF has PK/FK notation',erds[1].includes(' PK')&&erds[1].includes(' FK'));
test('2NF omits typed attributes',!/^\s+(uuid|bigint|datetime|string|text)\s+/m.test(erds[1]));
test('3NF typed entities',erds[2].includes('uuid ')&&erds[2].includes('bigint ')&&erds[2].includes(' PK'));
const d=read('dfd-level-0.mmd');
test('DFD context system',d.includes('S(("0:')&&d.includes('Financial AI agent'));
test('four Mermaid previews',(read('diagrams.md').match(/```mermaid/g)||[]).length===4);
test('research and testing linked',read('README.md').includes('research-context.md')&&read('README.md').includes('testing.md'));
console.log('Documentation verification finished. This does not prove payment or agent security.');
if(failed)process.exit(1);
