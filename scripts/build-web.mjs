import {build} from 'esbuild';
import {appendFile,readFile} from 'node:fs/promises';
await build({entryPoints:['apps/web/app.js'],bundle:true,format:'esm',target:'es2022',outfile:'apps/web/build/app.js',legalComments:'linked',sourcemap:true});
// Preserve full MIT notices for the packages included in this tree-shaken browser bundle.
for(const dependency of ['viem','@noble/hashes','cytoscape']){
  const license=await readFile(`node_modules/${dependency}/LICENSE`,'utf8');
  await appendFile('apps/web/build/app.js.LEGAL.txt',`\n\n${dependency}\n${license}\n`);
}
