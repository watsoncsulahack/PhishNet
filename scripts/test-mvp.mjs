import {spawnSync} from 'node:child_process';
const suites=['event-contract','journal','gateway','live-graph','chat','audit','mvp-http'];
for(const name of suites){const result=spawnSync(process.execPath,['tests/'+name+'.test.js'],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
console.log(`${suites.length}/${suites.length} MVP suites passed. Controlled credentials/RPC are not live settlement or isolation evidence.`);
