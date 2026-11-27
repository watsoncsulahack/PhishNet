import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ARC,amount,address,transfer,inspectReceipt} from '../packages/payments/src/transfer.js';
import {testnetReader,USDC_PRECOMPILE,TRANSFER_TOPIC,configuredRpcUrls,arcRpc} from '../apps/api/src/testnet.js';
const from='0x1111111111111111111111111111111111111111';
const to='0x2222222222222222222222222222222222222222';
const input={from,to,amount:'0.02'};
const hash='0x'+'a'.repeat(64),blockHash='0x'+'b'.repeat(64);
const expected=transfer(input);
const tx={...expected,hash,input:'0x',blockHash,blockNumber:'0x7'};
const receipt={transactionHash:hash,from,to,status:'0x1',blockNumber:'0x7',blockHash,gasUsed:'0x5208',effectiveGasPrice:'0x3b9aca00'};
const block={number:'0x7',hash:blockHash,transactions:[hash]};
function mockRpc(overrides={}){const methods={eth_chainId:ARC.hexChainId,eth_blockNumber:'0x7',eth_getBalance:'0x56bc75e2d63100000',eth_getCode:'0x',eth_gasPrice:'0x3b9aca00',eth_estimateGas:'0x5208',eth_getTransactionByHash:tx,eth_getTransactionReceipt:receipt,eth_getBlockByNumber:block,...overrides};return async(method)=>{if(!Object.hasOwn(methods,method))throw Error('Unexpected method '+method);return methods[method];};}
test('native USDC uses exact 18 decimals; invalid/rounded/oversized amounts rejected',()=>{assert.equal(amount('0.02'),20000000000000000n);assert.equal(amount('0.000001'),1000000000000n);assert.equal(amount('100'),100000000000000000000n);for(const v of ['0','-1','1e2','01','0.0000001','100.000001','NaN','Infinity',' 1','1.',1])assert.throws(()=>amount(v));});
test('complete address/checksum and zero-address validation',()=>{assert.equal(address(to),to);for(const v of ['0x'+'0'.repeat(40),'0x22','not-an-address','0x52908400098527886E0F7030069857D2E4169Ee7'])assert.throws(()=>address(v));});
test('only reviewed transfer fields allowed; chain fixed; no contract calldata',()=>{assert.deepEqual(expected,{from,to,value:'0x470de4df820000',chainId:ARC.hexChainId,data:'0x'});assert.throws(()=>transfer({...input,data:'0xabcd'}));assert.throws(()=>transfer({...input,chainId:1}));});
test('quote validates chain, recipient code, funds plus fees',async()=>{const quote=await testnetReader(mockRpc()).quote(input);assert.deepEqual(quote.transaction,expected);assert.ok(BigInt(quote.estimatedFeeBaseUnits)>0n);await assert.rejects(()=>testnetReader(mockRpc({eth_chainId:'0x1'})).quote(input),/chain mismatch/);await assert.rejects(()=>testnetReader(mockRpc({eth_getCode:'0x6000'})).quote(input),/Contract recipients/);await assert.rejects(()=>testnetReader(mockRpc({eth_getBalance:expected.value})).quote(input),/Insufficient/);});
test('receipt is confirmed only after exact transaction and canonical block verification',async()=>{assert.equal((await testnetReader(mockRpc()).receipt({...input,hash})).status,'CONFIRMED');assert.equal(inspectReceipt(expected,hash,tx,receipt,block).feeBaseUnits,'21000000000000');for(const changed of [{...tx,to:from},{...tx,from:to},{...tx,value:'0x1'},{...tx,chainId:'0x1'},{...tx,input:'0x1234'},{...tx,hash:'0x'+'c'.repeat(64)},{...tx,blockHash:'0x'+'c'.repeat(64)}])assert.equal(inspectReceipt(expected,hash,changed,receipt,block).status,'MISMATCH');for(const changed of [{...receipt,to:from},{...receipt,from:to},{...receipt,transactionHash:'0x'+'c'.repeat(64)}])assert.equal(inspectReceipt(expected,hash,tx,changed,block).status,'MISMATCH');});
test('pending, reverted and orphaned transactions cannot appear confirmed',()=>{assert.equal(inspectReceipt(expected,hash,null,null,null).status,'BROADCAST');assert.equal(inspectReceipt(expected,hash,{...tx,blockHash:null,blockNumber:null},receipt,block).status,'BROADCAST');assert.equal(inspectReceipt(expected,hash,tx,{...receipt,status:'0x0'},block).status,'FAILED');assert.equal(inspectReceipt(expected,hash,tx,receipt,{...block,hash:'0x1234'}).status,'BROADCAST');assert.equal(inspectReceipt(expected,hash,tx,receipt,{...block,transactions:[]}).status,'BROADCAST');assert.equal(inspectReceipt(expected,hash,tx,{...receipt,status:'0x2'},block).status,'BROADCAST');});
test('network errors and malformed verification input fail closed',async()=>{await assert.rejects(()=>testnetReader(async()=>{throw Error('offline');}).receipt({...input,hash}),/offline/);await assert.rejects(()=>testnetReader(mockRpc()).receipt({...input,hash:'fake'}),/Invalid receipt/);await assert.rejects(()=>testnetReader(mockRpc()).receipt({...input,hash,extra:true}),/Invalid receipt/);});
test('transactions discovers and verifies native, USDC precompile log, and internal faucet transfers via RPC',async()=>{
  const faucet='0x9999999999999999999999999999999999999999';
  const hNative='0x'+'1'.repeat(64),hLog='0x'+'2'.repeat(64),hInternal='0x'+'3'.repeat(64),hFailed='0x'+'4'.repeat(64);
  const bHash='0x'+'e'.repeat(64);
  const padded=a=>'0x'+'0'.repeat(24)+a.slice(2);
  const txs={
    [hNative]:{hash:hNative,from:faucet,to,value:'0x8ac7230489e80000',chainId:ARC.hexChainId,blockHash:bHash,blockNumber:'0xa'},
    [hLog]:{hash:hLog,from:faucet,to:USDC_PRECOMPILE,value:'0x0',chainId:ARC.hexChainId,blockHash:bHash,blockNumber:'0xa'},
    [hInternal]:{hash:hInternal,from:faucet,to:faucet,value:'0x0',chainId:ARC.hexChainId,blockHash:bHash,blockNumber:'0xa'},
    [hFailed]:{hash:hFailed,from:faucet,to,value:'0x1',chainId:ARC.hexChainId,blockHash:bHash,blockNumber:'0xa'}
  };
  const receipts={
    [hNative]:{transactionHash:hNative,status:'0x1',blockHash:bHash,blockNumber:'0xa',logs:[]},
    [hLog]:{transactionHash:hLog,status:'0x1',blockHash:bHash,blockNumber:'0xa',logs:[{address:USDC_PRECOMPILE,topics:[TRANSFER_TOPIC,padded(faucet),padded(to)],data:'0x989680'}]},
    [hInternal]:{transactionHash:hInternal,status:'0x1',blockHash:bHash,blockNumber:'0xa',logs:[]},
    [hFailed]:{transactionHash:hFailed,status:'0x0',blockHash:bHash,blockNumber:'0xa',logs:[]}
  };
  const rpc=async(method,params=[])=>{
    if(method==='eth_chainId')return ARC.hexChainId;
    if(method==='eth_blockNumber')return '0xa';
    if(method==='eth_getLogs')return [{transactionHash:hLog}];
    if(method==='eth_getTransactionByHash')return txs[params[0]]||null;
    if(method==='eth_getTransactionReceipt')return receipts[params[0]]||null;
    if(method==='eth_getBlockByNumber')return {number:'0xa',hash:bHash,timestamp:'0x69274c00',transactions:[hNative,hLog,hInternal,hFailed]};
    throw Error('Unexpected '+method);
  };
  const fetchFn=async url=>{
    if(url.endsWith('/transactions'))return {ok:true,json:async()=>({items:[{hash:hNative},{hash:hFailed}]})};
    if(url.endsWith('/internal-transactions'))return {ok:true,json:async()=>({items:[{transaction_hash:hInternal,from:{hash:faucet},to:{hash:to},value:'5000000000000000000'}]})};
    return {ok:true,json:async()=>({items:[]})};
  };
  const found=await testnetReader(rpc,fetchFn).transactions(to);
  assert.equal(found.length,3);
  assert.deepEqual(found.map(x=>[x.txHash,x.direction,x.amountBaseUnits,x.source]),[
    [hNative,'incoming','10000000000000000000','rpc-native-tx'],
    [hInternal,'incoming','5000000000000000000','explorer-internal-tx'],
    [hLog,'incoming','10000000000000000000','rpc-usdc-log']
  ]);
});
test('configuredRpcUrls enforces HTTPS and arcRpc fails over on 429 or -32014',async()=>{
  assert.throws(()=>configuredRpcUrls({PHISHNET_ARC_RPC_URL:'http://insecure.invalid'}),/HTTPS/);
  const urls=configuredRpcUrls({});
  assert.ok(urls.includes('https://rpc.testnet.arc.io')&&urls.includes('https://rpc.quicknode.testnet.arc.io'));
  const calls=[];
  const mockFetch=async url=>{
    calls.push(url);
    if(url.includes('rpc.testnet.arc.io'))return {ok:false,status:429,json:async()=>({})};
    return {ok:true,status:200,json:async()=>({result:'0x4cef52'})};
  };
  const chainId=await arcRpc('eth_chainId',[],{urls:['https://rpc.testnet.arc.io','https://rpc.quicknode.testnet.arc.io'],fetchFn:mockFetch});
  assert.equal(chainId,'0x4cef52');
  assert.ok(calls.includes('https://rpc.quicknode.testnet.arc.io'));
});
