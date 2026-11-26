// Read-only live check. Does not create, sign or broadcast a transaction.
import {testnet,arcRpc} from '../apps/api/src/testnet.js';
console.log(JSON.stringify(await testnet.network(),null,2));
const decimals=await arcRpc('eth_call',[{to:'0x3600000000000000000000000000000000000000',data:'0x313ce567'},'latest']);
if(BigInt(decimals)!==6n)throw new Error('Unexpected USDC ERC-20 decimals');
console.log('PASS public RPC chain, block height and ERC-20 decimals read. Native payment values use 18 decimals. No payment broadcast.');

const latest=await arcRpc('eth_getBlockByNumber',['latest',true]);
const example=latest.transactions?.find(tx=>tx.from);
if(example){
  // Public sender used only for eth_estimateGas/read calls; no access to its signer.
  const code=await arcRpc('eth_getCode',[example.from,'latest']);
  if(code==='0x'){const quote=await testnet.quote({from:example.from,to:example.from,amount:'0.000001'});console.log(JSON.stringify({quoteReadOnly:true,gas:quote.gas,estimatedFeeBaseUnits:quote.estimatedFeeBaseUnits,nativeValue:quote.transaction.value},null,2));}
}
