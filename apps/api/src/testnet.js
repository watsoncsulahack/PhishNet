/** Read-only public-chain integration. No keys, signing, relaying or simulation authority. */
import {ARC,address,transfer,validHash,inspectReceipt} from '../../../packages/payments/src/transfer.js';
export const USDC_PRECOMPILE='0x3600000000000000000000000000000000000000';
export const TRANSFER_TOPIC='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const rawAddress=value=>typeof value==='string'&&/^0x[0-9a-fA-F]{40}$/.test(value)?value.toLowerCase():null;
const topicAddress=topic=>typeof topic==='string'&&/^0x0{24}[0-9a-fA-F]{40}$/.test(topic)?('0x'+topic.slice(26)).toLowerCase():null;
const DEFAULT_FALLBACK_RPCS=['https://rpc.quicknode.testnet.arc.io','https://rpc.drpc.testnet.arc.io','https://rpc.blockdaemon.testnet.arc.io'];
function safeHttpsUrl(raw,fallback){
  const v=String(raw||'').trim();
  if(!v)return fallback;
  const u=new URL(v);
  if(u.protocol!=='https:')throw new Error('Configured Arc endpoint must use HTTPS.');
  return u.origin+u.pathname.replace(/\/+$/,'');
}
export function configuredRpcUrls(env=process.env){
  const primary=safeHttpsUrl(env.PHISHNET_ARC_RPC_URL,ARC.rpcUrl);
  const rawFallbacks=env.PHISHNET_ARC_RPC_FALLBACK_URLS;
  const fallbacks=rawFallbacks!==undefined?rawFallbacks.split(',').map(s=>s.trim()).filter(Boolean).map(u=>safeHttpsUrl(u,ARC.rpcUrl)):(env.PHISHNET_ARC_RPC_URL?[]:DEFAULT_FALLBACK_RPCS);
  return [...new Set([primary,...fallbacks])];
}
export async function arcRpc(method,params=[],{urls=configuredRpcUrls(),fetchFn=fetch}={}){
  let lastError=null;
  for(const url of urls){
    for(let attempt=0;attempt<2;attempt++){
      try{
        const response=await fetchFn(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(12000)});
        if(response.status===429||response.status>=500){lastError=new Error(`Arc Testnet RPC returned HTTP ${response.status}.`);await new Promise(r=>setTimeout(r,150*(attempt+1)));continue;}
        if(!response.ok){lastError=new Error('Arc Testnet RPC is unavailable. Please retry.');break;}
        const data=await response.json();
        if(data.error?.code===-32014){lastError=new Error('Arc Testnet backend syncing block height.');await new Promise(r=>setTimeout(r,150*(attempt+1)));continue;}
        if(data.error||!Object.hasOwn(data,'result')){lastError=new Error(data.error?.message||'Arc Testnet could not complete this request. Please retry.');break;}
        return data.result;
      }catch(err){lastError=err;}
    }
  }
  if(lastError?.message==='fetch failed'||lastError?.name==='AbortError'||lastError?.name==='TimeoutError')throw new Error('Arc Testnet RPC is unavailable. Check your connection and retry.');
  throw lastError||new Error('Arc Testnet RPC is unavailable. Please retry.');
}
async function readJson(fetchFn,url){
  try{
    const res=await fetchFn(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(8000)});
    if(!res.ok)return null;
    return await res.json();
  }catch{return null;}
}
export function testnetReader(rpc=arcRpc,fetchFn=fetch){
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
    async receipt(input){if(!input||Object.keys(input).some(k=>!['from','to','amount','hash'].includes(k))||!validHash(input.hash))throw new Error('Invalid receipt request.');const {hash,...payment}=input;const txExpected=transfer(payment);await chain();const [tx,receipt]=await Promise.all([rpc('eth_getTransactionByHash',[hash]),rpc('eth_getTransactionReceipt',[hash])]);const block=receipt?.blockNumber?await rpc('eth_getBlockByNumber',[receipt.blockNumber,false]):null;return {...inspectReceipt(txExpected,hash,tx,receipt,block),chainId:ARC.chainId,checkedAt:new Date().toISOString()};},
    async transactions(account,{limit=25,explorerUrl=safeHttpsUrl(process.env.PHISHNET_ARC_EXPLORER_URL,ARC.explorer)}={}){
      const wallet=address(account).toLowerCase();await chain();
      const padded='0x'+'0'.repeat(24)+wallet.slice(2);
      const [txList,internalList,tokenList,latestHex]=await Promise.all([
        readJson(fetchFn,`${explorerUrl}/api/v2/addresses/${wallet}/transactions`),
        readJson(fetchFn,`${explorerUrl}/api/v2/addresses/${wallet}/internal-transactions`),
        readJson(fetchFn,`${explorerUrl}/api/v2/addresses/${wallet}/token-transfers`),
        rpc('eth_blockNumber').catch(()=>null)
      ]);
      const candidates=[],seen=new Set(),internalByHash=new Map();
      const addCandidate=h=>{const v=typeof h==='string'?h.toLowerCase():'';if(validHash(v)&&!seen.has(v)){seen.add(v);candidates.push(v);}};
      for(const item of txList?.items||[])addCandidate(item?.hash);
      for(const item of tokenList?.items||[])addCandidate(item?.transaction_hash||item?.tx_hash);
      for(const item of internalList?.items||[]){
        const h=(item?.transaction_hash||'').toLowerCase();
        if(!validHash(h))continue;
        addCandidate(h);
        const from=rawAddress(item?.from?.hash),to=rawAddress(item?.to?.hash);
        if((from===wallet||to===wallet)&&/^[0-9]+$/.test(String(item?.value||''))&&BigInt(item.value)>0n&&!internalByHash.has(h)){
          internalByHash.set(h,{from,recipient:to,amountBaseUnits:BigInt(item.value).toString()});
        }
      }
      if(latestHex){
        const latest=BigInt(latestHex),fromBlock='0x'+(latest>5000n?latest-5000n:0n).toString(16);
        const [inLogs,outLogs]=await Promise.all([
          rpc('eth_getLogs',[{address:USDC_PRECOMPILE,fromBlock,toBlock:'latest',topics:[TRANSFER_TOPIC,null,padded]}]).catch(()=>[]),
          rpc('eth_getLogs',[{address:USDC_PRECOMPILE,fromBlock,toBlock:'latest',topics:[TRANSFER_TOPIC,padded,null]}]).catch(()=>[])
        ]);
        for(const log of [...(inLogs||[]),...(outLogs||[])])addCandidate(log?.transactionHash);
      }
      const verified=[];
      for(let i=0;i<Math.min(candidates.length,limit);i+=5){
        const batch=candidates.slice(i,i+5);
        const results=await Promise.all(batch.map(async txHash=>{
          try{
            const [tx,receipt]=await Promise.all([rpc('eth_getTransactionByHash',[txHash]),rpc('eth_getTransactionReceipt',[txHash])]);
            if(!tx||!receipt||receipt.status!=='0x1'||!receipt.blockNumber||!receipt.blockHash||tx.blockHash!==receipt.blockHash)return null;
            if(tx.chainId!==undefined&&tx.chainId!==null&&BigInt(tx.chainId)!==BigInt(ARC.chainId))return null;
            const block=await rpc('eth_getBlockByNumber',[receipt.blockNumber,false]);
            if(!block||block.hash!==receipt.blockHash||block.number!==receipt.blockNumber)return null;
            if(Array.isArray(block.transactions)&&block.transactions.length&&typeof block.transactions[0]==='string'&&!block.transactions.some(h=>h.toLowerCase()===txHash))return null;
            let from=null,recipient=null,amountBaseUnits=null,source=null;
            const txFrom=rawAddress(tx.from),txTo=rawAddress(tx.to),txValue=tx.value?BigInt(tx.value):0n;
            if(txFrom&&txTo&&(txFrom===wallet||txTo===wallet)&&txValue>0n){
              from=txFrom;recipient=txTo;amountBaseUnits=txValue.toString();source='rpc-native-tx';
            }else if(Array.isArray(receipt.logs)){
              const usdcLog=receipt.logs.find(l=>{
                if(rawAddress(l?.address)!==USDC_PRECOMPILE||l?.topics?.[0]?.toLowerCase()!==TRANSFER_TOPIC)return false;
                const lf=topicAddress(l.topics[1]),lt=topicAddress(l.topics[2]);
                return lf&&lt&&(lf===wallet||lt===wallet)&&/^0x[0-9a-fA-F]+$/.test(l.data||'')&&BigInt(l.data)>0n;
              });
              if(usdcLog){
                from=topicAddress(usdcLog.topics[1]);recipient=topicAddress(usdcLog.topics[2]);
                amountBaseUnits=(BigInt(usdcLog.data)*1000000000000n).toString();source='rpc-usdc-log';
              }
            }
            if(!source&&internalByHash.has(txHash)){
              const internal=internalByHash.get(txHash);
              from=internal.from;recipient=internal.recipient;amountBaseUnits=internal.amountBaseUnits;source='explorer-internal-tx';
            }
            if(!source||!from||!recipient||!amountBaseUnits)return null;
            const direction=from===wallet&&recipient===wallet?'self':recipient===wallet?'incoming':'outgoing';
            const observedAt=block.timestamp?new Date(Number(BigInt(block.timestamp))*1000).toISOString():undefined;
            return {txHash,from,recipient,amountBaseUnits,direction,asset:'native-USDC',decimals:18,chainId:ARC.chainId,blockNumber:BigInt(receipt.blockNumber).toString(),...(observedAt?{observedAt}:{}),source};
          }catch{return null;}
        }));
        for(const item of results)if(item)verified.push(item);
      }
      return verified;
    }
  };
}
export const testnet=testnetReader();
