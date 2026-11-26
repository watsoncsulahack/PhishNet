/** Read-only public-chain integration. No keys, signing, relaying or simulation authority. */
import {ARC,address,transfer,validHash,inspectReceipt} from '../../../packages/payments/src/transfer.js';
export async function arcRpc(method,params=[]){
  const response=await fetch(ARC.rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error('Arc Testnet RPC is unavailable. Please retry.');
  const data=await response.json();if(data.error||!Object.hasOwn(data,'result'))throw new Error('Arc Testnet could not complete this request. Please retry.');return data.result;
}
export function testnetReader(rpc=arcRpc){
  async function chain(){if(BigInt(await rpc('eth_chainId'))!==BigInt(ARC.chainId))throw new Error('RPC chain mismatch. Testnet payments are unavailable.');}
  return {
    async network(){await chain();return {...ARC,blockNumber:BigInt(await rpc('eth_blockNumber')).toString()};},
    async balance(account){const a=address(account);await chain();return {address:a,balanceBaseUnits:BigInt(await rpc('eth_getBalance',[a,'latest'])).toString(),chainId:ARC.chainId};},
    async quote(input){const tx=transfer(input);await chain();const [code,balance,gasPrice,gas]=await Promise.all([rpc('eth_getCode',[tx.to,'latest']),rpc('eth_getBalance',[tx.from,'latest']),rpc('eth_gasPrice'),rpc('eth_estimateGas',[tx])]);
      if(code!=='0x')throw new Error('This release supports wallet-to-wallet payments only. Contract recipients are not supported.');
      // Room for changes in base fee; wallet presents the final network fee.
      const gasLimit=(BigInt(gas)*120n+99n)/100n,maxFeePerGas=BigInt(gasPrice)*2n,fee=gasLimit*maxFeePerGas;
      if(BigInt(balance)<BigInt(tx.value)+fee)throw new Error('Insufficient test USDC for the amount and estimated network fee. Add test funds from the faucet.');
      return {transaction:tx,gas:'0x'+gasLimit.toString(16),maxFeePerGas:'0x'+maxFeePerGas.toString(16),estimatedFeeBaseUnits:fee.toString(),balanceBaseUnits:BigInt(balance).toString(),expiresAt:Date.now()+60000,checks:['Arc Testnet only','Complete recipient address','Native USDC amount validated','Wallet recipient checked','Balance covers amount and estimated fee'],authorization:'Manual wallet confirmation required; recipient identity unverified'};
    },
    async receipt(input){if(!input||Object.keys(input).some(k=>!['from','to','amount','hash'].includes(k))||!validHash(input.hash))throw new Error('Invalid receipt request.');const {hash,...payment}=input;const txExpected=transfer(payment);await chain();const [tx,receipt]=await Promise.all([rpc('eth_getTransactionByHash',[hash]),rpc('eth_getTransactionReceipt',[hash])]);const block=receipt?.blockNumber?await rpc('eth_getBlockByNumber',[receipt.blockNumber,false]):null;return {...inspectReceipt(txExpected,hash,tx,receipt,block),chainId:ARC.chainId,checkedAt:new Date().toISOString()};}
  };
}
export const testnet=testnetReader();
