import {getAddress, isAddress, formatUnits, parseUnits} from 'viem';

// Native Arc USDC, not the 6-decimal ERC-20 interface. Source: Arc Connect to Arc docs.
export const ARC = Object.freeze({chainId:5042002,hexChainId:'0x4cef52',name:'Arc Testnet',rpcUrl:'https://rpc.testnet.arc.io',explorer:'https://explorer.testnet.arc.io',decimals:18});
export const MAX_USDC = '100'; // Product limit for manually approved testnet transfers.
export function address(value) {
  if(typeof value!=='string' || (!/^0x[0-9a-fA-F]{40}$/.test(value)||!isAddress(value,{strict:true}))) throw new Error('Enter a complete 0x recipient address (42 characters).');
  const result=getAddress(value); // Normalize after strict mixed-case checksum validation.
  if(result.toLowerCase()==='0x'+'0'.repeat(40))throw new Error('The zero address cannot receive this payment.');
  return result;
}
export function amount(value) {
  if(typeof value!=='string'||! /^(0|[1-9][0-9]{0,2})(\.[0-9]{1,6})?$/.test(value))throw new Error('Enter a positive amount with up to 6 decimal places.');
  const units=parseUnits(value,ARC.decimals);
  if(units<=0n||units>parseUnits(MAX_USDC,18))throw new Error(`Send between 0.000001 and ${MAX_USDC} test USDC per payment.`);
  return units;
}
export const displayUSDC = units => formatUnits(BigInt(units),18);
export function transfer(input){
  if(!input || Object.keys(input).some(k=>!['from','to','amount'].includes(k)))throw new Error('Unexpected payment fields.');
  return {from:address(input.from),to:address(input.to),value:'0x'+amount(input.amount).toString(16),chainId:ARC.hexChainId,data:'0x'};
}
export function validHash(hash){return typeof hash==='string'&&/^0x[0-9a-fA-F]{64}$/.test(hash);}
export function inspectReceipt(expected,hash,tx,receipt,block){
  if(!validHash(hash))throw new Error('Invalid transaction hash.');
  if(!tx||!receipt)return {status:'BROADCAST',detail:'Awaiting a mined receipt from Arc Testnet.'};
  if(tx.blockHash===null||tx.blockNumber===null)return {status:'BROADCAST',detail:'Transaction data is still pending. Waiting for matching mined records.'};
  const matches=tx.hash?.toLowerCase()===hash.toLowerCase()&&receipt.transactionHash?.toLowerCase()===hash.toLowerCase()
    &&tx.from?.toLowerCase()===expected.from.toLowerCase()&&tx.to?.toLowerCase()===expected.to.toLowerCase()
    &&receipt.from?.toLowerCase()===expected.from.toLowerCase()&&receipt.to?.toLowerCase()===expected.to.toLowerCase()
    &&BigInt(tx.value)===BigInt(expected.value)&&BigInt(tx.chainId)===BigInt(ARC.chainId)
    &&['0x','0x0'].includes(tx.input)&&tx.blockHash===receipt.blockHash&&tx.blockNumber===receipt.blockNumber;
  if(!matches)return {status:'MISMATCH',detail:'Network transaction differs from the reviewed payment. Do not treat it as paid.'};
  if(receipt.status==='0x0')return {status:'FAILED',detail:'Transaction reverted on Arc Testnet. Network fees may still apply.'};
  if(receipt.status!=='0x1'||!block||block.hash!==receipt.blockHash||block.number!==receipt.blockNumber||!block.transactions?.some(t=>typeof t==='string'&&t.toLowerCase()===hash.toLowerCase()))return {status:'BROADCAST',detail:'Waiting for a verifiable canonical block and successful receipt.'};
  return {status:'CONFIRMED',detail:'Receipt, sender, recipient, exact native USDC amount, chain and canonical block checked via the public RPC.',blockNumber:BigInt(receipt.blockNumber).toString(),feeBaseUnits:(BigInt(receipt.gasUsed)*BigInt(receipt.effectiveGasPrice)).toString()};
}
