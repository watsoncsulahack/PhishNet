import './notebook.js';
import {ARC,transfer,address,displayUSDC,validHash} from '../../packages/payments/src/transfer.js';
const $=id=>document.getElementById(id);
const node=(tag,text,classes)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(classes)n.className=classes;return n;};
const short=value=>`${value.slice(0,6)}…${value.slice(-4)}`;
const storageKey='phishnet.testnet.payments.v1';
let provider=null,account=null,chainId=null,quote=null,revision=0,submitting=false,connecting=false;
let history=[];
const wallets=new Map();

function notice(message,error=false){$('app-notice').textContent=message;$('app-notice').className=`notice${error?' error':''}`;$('app-notice').hidden=!message;}
async function api(path,body){
  const response=await fetch('/v1/testnet/'+path,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Arc Testnet is temporarily unavailable. Please retry.');return data;
}
function errorText(error){
  if(error?.code===4001||error?.cause?.code===4001)return 'Request cancelled in your wallet. No new payment was submitted by PhishNet.';
  if(error?.code===-32002)return 'A wallet request is already open. Check your wallet to continue.';
  if(error?.name==='TimeoutError'||error?.name==='AbortError')return 'The network check timed out. Please retry; existing payments can be checked in Activity.';
  return String(error?.shortMessage||error?.message||'Something went wrong. Please retry.').slice(0,350);
}
function setTab(){
  let tab=location.hash.slice(1)||'payments';
  // Investigation anchors keep the Explore panel visible.
  if(['history','lineage','review','source'].includes(tab))tab='explore';
  if(!['payments','activity','explore'].includes(tab))tab=document.querySelector('[data-tab][aria-current="page"]')?.dataset.tab||'payments';
  document.querySelectorAll('[data-tab]').forEach(a=>{if(a.dataset.tab===tab)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  for(const name of ['payments','activity','explore'])$(name+'-panel').hidden=name!==tab;
  $('page-label').textContent={payments:'Payments',activity:'Activity',explore:'Explore PhishNet'}[tab];
  if(['payments','activity','explore'].includes(location.hash.slice(1)))window.scrollTo(0,0);
}
window.addEventListener('hashchange',setTab);setTab();

function invalidateQuote(){revision++;quote=null;if(!submitting)$('payment-dialog').close();}
function walletUI(){
  $('connect-wallet').textContent=connecting?'Connecting…':account?short(account):'Connect wallet';
  $('connect-wallet').disabled=connecting||submitting;
  $('disconnect-wallet').hidden=!account;
  $('disconnect-wallet').disabled=submitting;
  $('connected-wallet').textContent=account||'No wallet connected';
  $('wallet-network').textContent=account?(chainId===ARC.hexChainId?'Connected · Arc Testnet':'Wrong network · switch to Arc Testnet'):'Browser wallet · Arc Testnet';
  $('copy-wallet').disabled=!account;$('refresh-balance').disabled=!account;
}
const changedAccounts=accounts=>{invalidateQuote();account=accounts?.[0]?address(accounts[0]):null;$('real-balance').textContent='—';walletUI();if(account)refreshBalance();else $('balance-caption').textContent='Connect your wallet to view your testnet balance.';};
const changedChain=id=>{chainId=id?.toLowerCase();invalidateQuote();$('real-balance').textContent='—';walletUI();if(chainId!==ARC.hexChainId){$('balance-caption').textContent='Switch your wallet to Arc Testnet to continue.';notice('Your wallet network changed. Connect to Arc Testnet before reviewing a payment.',true);}else refreshBalance();};
function attachWallet(next){
  if(provider?.removeListener){provider.removeListener('accountsChanged',changedAccounts);provider.removeListener('chainChanged',changedChain);provider.removeListener('disconnect',disconnect);}
  provider=next;provider.on?.('accountsChanged',changedAccounts);provider.on?.('chainChanged',changedChain);provider.on?.('disconnect',disconnect);
}
async function connect(next){
  if(connecting||submitting)return;connecting=true;walletUI();notice('');$('wallet-connect-error').textContent='';
  try{
    attachWallet(next);const accounts=await provider.request({method:'eth_requestAccounts'});
    if(!accounts?.[0])throw Error('No account was shared by your wallet.');
    account=address(accounts[0]);chainId=(await provider.request({method:'eth_chainId'})).toLowerCase();
    if(chainId!==ARC.hexChainId){
      try{await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:ARC.hexChainId}]});}
      catch(error){if(error.code!==4902 && error?.data?.originalError?.code!==4902)throw error;await provider.request({method:'wallet_addEthereumChain',params:[{chainId:ARC.hexChainId,chainName:ARC.name,nativeCurrency:{name:'USDC',symbol:'USDC',decimals:18},rpcUrls:[ARC.rpcUrl],blockExplorerUrls:[ARC.explorer]}]});await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:ARC.hexChainId}]});}
    }
    chainId=(await provider.request({method:'eth_chainId'})).toLowerCase();if(chainId!==ARC.hexChainId)throw Error('Switch to Arc Testnet in your wallet to continue.');
    invalidateQuote();$('wallet-dialog').close();await refreshBalance();
  }catch(error){notice(errorText(error),true);$('wallet-connect-error').textContent=errorText(error);}
  finally{connecting=false;walletUI();}
}
function discoverWallets(){
  if(window.ethereum&&!wallets.size){const providers=window.ethereum.providers||[window.ethereum];providers.forEach((p,i)=>wallets.set(`injected-${i}`,{name:p.isMetaMask?'MetaMask':p.isCoinbaseWallet?'Coinbase Wallet':`Browser wallet${providers.length>1?' '+(i+1):''}`,provider:p}));}
  return [...wallets.values()];
}
window.addEventListener('eip6963:announceProvider',event=>{const d=event.detail;if(d?.info?.uuid&&d?.provider?.request)wallets.set(d.info.uuid,{name:String(d.info.name).slice(0,70),provider:d.provider});});
window.dispatchEvent(new Event('eip6963:requestProvider'));
$('connect-wallet').onclick=()=>{const options=discoverWallets();if(options.length===1){connect(options[0].provider);return;}$('wallet-options').replaceChildren(...options.map(w=>{const b=node('button',w.name);b.onclick=()=>connect(w.provider);return b;}));$('wallet-dialog').showModal();};
function disconnect(){invalidateQuote();account=null;chainId=null;$('real-balance').textContent='—';$('balance-caption').textContent='Connect your wallet to view your testnet balance.';walletUI();}
$('disconnect-wallet').onclick=disconnect;
$('close-wallet-dialog').onclick=()=>$('wallet-dialog').close();
$('copy-wallet').onclick=async()=>{try{await navigator.clipboard.writeText(account);notice('Wallet address copied.');}catch{notice('Select your full wallet address above to copy it.');}};
async function refreshBalance(){
  if(!account||chainId!==ARC.hexChainId)return;
  const expected=account;$('refresh-balance').disabled=true;
  try{const result=await api('balance?address='+encodeURIComponent(expected));if(account!==expected||chainId!==ARC.hexChainId)return;$('real-balance').textContent=Number(displayUSDC(result.balanceBaseUnits)).toLocaleString(undefined,{maximumFractionDigits:6});$('balance-caption').textContent='Test USDC · read from Arc’s public RPC';}
  catch(error){if(account===expected){$('real-balance').textContent='—';$('balance-caption').textContent='Balance unavailable. Try refreshing.';notice(errorText(error),true);}}
  finally{$('refresh-balance').disabled=!account;}
}
$('refresh-balance').onclick=refreshBalance;
for(const id of ['recipient','payment-amount','payment-note'])$(id).addEventListener('input',invalidateQuote);
function reviewField(parent,label,value,code=false){const row=node('div',undefined,'review-field');row.append(node('span',label),node(code?'code':'strong',value));parent.append(row);}
$('payment-form').onsubmit=async event=>{
  event.preventDefault();if(submitting)return;$('payment-error').textContent='';notice('');
  if(!provider||!account){$('payment-error').textContent='Connect your wallet before reviewing a payment.';return;}
  const r=revision;
  try{
    const input={from:account,to:$('recipient').value.trim(),amount:$('payment-amount').value.trim()};
    transfer(input); // Independent strict validation before any wallet or RPC interaction.
    const walletChain=(await provider.request({method:'eth_chainId'})).toLowerCase();
    if(walletChain!==ARC.hexChainId)throw Error('Wrong network. Connect your wallet to Arc Testnet before continuing.');
    $('review-payment').disabled=true;$('review-payment').textContent='Checking payment…';
    const result=await api('quote',input);
    if(r!==revision)throw Error('Payment or wallet changed during review. Review the updated payment again.');
    const expected=transfer(input);
    if(JSON.stringify(result.transaction)!==JSON.stringify(expected))throw Error('Payment check returned different transaction details. Please retry.');
    quote={...result,expiresAt:result.consentRequired?Date.now()+300000:result.expiresAt,input,note:$('payment-note').value.trim(),revision:r};
    $('consent-panel').hidden=!quote.consentRequired;$('download-consent').hidden=true;$('consent-receipt').value='';$('consent-status').textContent='Awaiting a human decision. Silence rejects.';
    const target=$('transfer-review');target.replaceChildren(node('div',`${input.amount} USDC`,'dialog-total'));
    reviewField(target,'From',expected.from,true);reviewField(target,'Recipient',expected.to,true);reviewField(target,'Network',`${ARC.name} · ${ARC.chainId}`);reviewField(target,'Amount',`${input.amount} test USDC`);reviewField(target,'Estimated maximum fee',`${displayUSDC(result.estimatedFeeBaseUnits)} USDC`);
    if(quote.note)reviewField(target,'Note (browser only)',quote.note);
    const checks=node('ul',undefined,'checks-list');result.checks.forEach(check=>checks.append(node('li',check)));target.append(checks,node('p','Recipient identity is unverified. Confirm the full address through a trusted channel. Your wallet will display the final transaction and network fee. For a hardware-backed account, also check its device screen; PhishNet does not attest hardware presence.','identity-warning'));
    $('signing-status').textContent='Nothing has been sent. Your wallet approval is required.';$('approve-payment').disabled=false;$('payment-dialog').showModal();
  }catch(error){$('payment-error').textContent=errorText(error);}
  finally{$('review-payment').disabled=false;$('review-payment').textContent='Review payment';}
};
function closeReview(){if(!submitting){quote=null;$('payment-dialog').close();}}
$('edit-payment').onclick=closeReview;$('close-review').onclick=closeReview;
$('payment-dialog').addEventListener('cancel',event=>{if(submitting)event.preventDefault();else quote=null;});
function signingUI(busy){submitting=busy;for(const id of ['approve-payment','edit-payment','close-review','recipient','payment-amount','payment-note','review-payment'])$(id).disabled=busy;walletUI();}
$('approve-payment').onclick=async()=>{
  if(submitting||!quote)return;const approved=quote;signingUI(true);
  try{
    if(approved.revision!==revision||Date.now()>approved.expiresAt)throw Error('This review expired or changed. Close it and review the payment again.');
    const [accounts,chain]=await Promise.all([provider.request({method:'eth_accounts'}),provider.request({method:'eth_chainId'})]);
    if(approved.revision!==revision||accounts?.[0]?.toLowerCase()!==approved.input.from.toLowerCase()||chain.toLowerCase()!==ARC.hexChainId)throw Error('Your wallet account or network changed. Review the payment again.');
    // Re-read recipient code, balance and fees immediately before asking the external wallet to sign.
    $('signing-status').textContent='Rechecking the payment before wallet approval…';
    const fresh=await api('quote',approved.input);
    if(approved.revision!==revision||Date.now()>approved.expiresAt||JSON.stringify(fresh.transaction)!==JSON.stringify(approved.transaction))throw Error('Payment changed. Close this review and try again.');
    if(BigInt(fresh.estimatedFeeBaseUnits)>BigInt(approved.estimatedFeeBaseUnits))throw Error('Estimated fees increased. Close this review and review the updated fee.');
    const finalChain=await provider.request({method:'eth_chainId'});const finalAccounts=await provider.request({method:'eth_accounts'});
    if(approved.revision!==revision||finalChain.toLowerCase()!==ARC.hexChainId||finalAccounts?.[0]?.toLowerCase()!==approved.input.from.toLowerCase())throw Error('Your wallet changed. Review the payment again.');
    if(fresh.consentRequired){
      if(!approved.consent?.intent?.intent_id)throw Error('Independent human countersignature required before wallet approval.');
      approved.consentProof=await api('consent/consume',{intentId:approved.consent.intent.intent_id,payment:approved.input});
      if(approved.consentProof.status!=='CONSUMED')throw Error('Human approval was not verified.');
      if(approved.revision!==revision)throw Error('Payment changed after human approval. Request a new review.');
    }
    $('signing-status').textContent='Approve the exact payment in your wallet. Keep this page open.';
    const submittedAt=new Date().toISOString();
    const hash=await provider.request({method:'eth_sendTransaction',params:[{...approved.transaction,gas:fresh.gas,maxFeePerGas:fresh.maxFeePerGas,maxPriorityFeePerGas:'0x0'}]});
    if(!validHash(hash))throw Error('Wallet did not return a valid transaction hash. Check your wallet history before trying again.');
    const record={hash,consentVerifiedThisSession:!!approved.consentProof,consentProof:approved.consentProof||null,input:approved.input,note:approved.note,submittedAt,status:'BROADCAST',detail:'Wallet returned a transaction hash. Awaiting public RPC verification.',reviewedAt:new Date(approved.expiresAt-60000).toISOString(),estimatedFeeBaseUnits:approved.estimatedFeeBaseUnits,checks:approved.checks};
    history=[record,...history.filter(p=>p.hash!==hash)].slice(0,50);saveHistory();renderHistory();quote=null;$('payment-dialog').close();$('payment-amount').value='';$('payment-note').value='';location.hash='activity';notice('Payment submitted to Arc Testnet. Waiting for a verified receipt.');
    pollReceipt(record);
  }catch(error){$('signing-status').textContent=errorText(error);}
  finally{signingUI(false);}
};
function saveHistory(){try{localStorage.setItem(storageKey,JSON.stringify(history.map(({status,detail,checkedAt,blockNumber,feeBaseUnits,...record})=>record)));}catch{notice('Browser storage is unavailable. Save your transaction hash from Activity before closing this page.',true);}}
try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(saved))history=saved.slice(0,50).flatMap(r=>{try{if(!validHash(r.hash)||!r.input||!Number.isFinite(Date.parse(r.submittedAt)))return [];const tx=transfer(r.input);return [{hash:r.hash,input:{...r.input,from:tx.from,to:tx.to},note:String(r.note||'').slice(0,120),consentProof:r.consentProof||null,consentVerifiedThisSession:false,submittedAt:r.submittedAt,reviewedAt:r.reviewedAt,estimatedFeeBaseUnits:r.estimatedFeeBaseUnits,status:'VERIFYING',detail:'Saved hash; checking its network receipt.'}];}catch{return [];}});}catch{notice('Saved history could not be loaded. Your wallet and explorer still have the network record.',true);}
function activityList(records){
  if(!records.length){const empty=node('div',undefined,'empty-state');empty.append(node('div','◷','empty-icon'),node('h3','Your next payment starts the story.'),node('p','Payments you send here will appear with their verification status.'));const link=node('a','Make your first payment');link.href='#payments';empty.append(link);return empty;}
  const list=node('div',undefined,'activity-list');
  for(const record of records){const row=node('article',undefined,'activity-row');row.dataset.hash=record.hash;const icon=node('span','↗','activity-icon');const body=node('div');body.append(node('h3',record.note||'USDC payment'),node('p',`To ${record.input.to}`,'activity-address'),node('p',`From ${record.input.from}`,'activity-address'),node('p',new Date(record.submittedAt).toLocaleString()));
    body.append(node('p',record.detail));const tools=node('div',undefined,'activity-tools');const explorer=node('a','View transaction');explorer.href=`${ARC.explorer}/tx/${record.hash}`;explorer.target='_blank';explorer.rel='noopener noreferrer';const copy=node('button','Copy transaction hash');copy.onclick=async()=>{try{await navigator.clipboard.writeText(record.hash);notice('Transaction hash copied.');}catch{notice(record.hash);}};const inspect=node('button','Inspect payment trail');inspect.onclick=()=>showLiveTrace(record);const recheck=node('button','Check receipt');recheck.onclick=()=>checkReceipt(record);tools.append(explorer,copy,inspect,recheck);body.append(tools);const total=node('div',undefined,'activity-sum');total.append(node('strong',`${record.input.amount} USDC`),node('span',record.status,`pill ${record.status}`));row.append(icon,body,total);list.append(row);}
  return list;
}
function renderHistory(){$('recent-activity').replaceChildren(activityList(history.filter(r=>!account||r.input.from.toLowerCase()===account.toLowerCase()).slice(0,3)));$('all-activity').replaceChildren(activityList(history.filter(r=>!account||r.input.from.toLowerCase()===account.toLowerCase())));}
async function checkReceipt(record){
  try{const result=await api('receipt',{...record.input,hash:record.hash});Object.assign(record,result);saveHistory();renderHistory();if($('live-trace')?.dataset.hash===record.hash&&!$('live-trace').hidden)showLiveTrace(record,false);if(record.status==='CONFIRMED')refreshBalance();}
  catch(error){record.status='UNVERIFIED';record.detail=errorText(error)+' Check the receipt again; do not resend solely because verification is unavailable.';renderHistory();}
}
async function pollReceipt(record){for(let attempt=0;attempt<30;attempt++){await checkReceipt(record);if(['CONFIRMED','FAILED','MISMATCH'].includes(record.status))return;await new Promise(resolve=>setTimeout(resolve,4000));}record.detail='Confirmation is taking longer than expected. Check the receipt in Activity or your wallet before sending again.';renderHistory();}
$('refresh-activity').onclick=async()=>{const b=$('refresh-activity');b.disabled=true;b.textContent='Checking…';try{for(const record of history)await checkReceipt(record);}finally{b.disabled=false;b.textContent='Check receipts';}};
function showLiveTrace(record,navigate=true){
  let panel=$('live-trace');if(!panel){panel=node('article',undefined,'card live-trace');panel.id='live-trace';$('explore-panel').insertBefore(panel,document.querySelector('.explain-strip'));}
  const step=Number(panel.querySelector('[aria-pressed="true"]')?.dataset.step||0);panel.dataset.hash=record.hash;
  panel.hidden=false;panel.replaceChildren(node('p','YOUR PAYMENT · RECORDED EVENTS','eyebrow'),node('h2',`${record.input.amount} USDC · ${record.status}`),node('p','A direct wallet payment: no agent messages or inferred claim lineage were recorded.','muted'));
  const steps=node('div',undefined,'explain-strip');const detail=node('div',undefined,'live-trace-detail');detail.id='live-trace-detail';
  const events=[['Payment review','Browser review snapshot',record.reviewedAt||'Snapshot timestamp not available',`Sender: ${record.input.from}\nRecipient: ${record.input.to}\nAmount: ${record.input.amount} USDC\nChain: ${ARC.chainId}\nRecipient identity: unverified`],['Wallet submission','Wallet provider returned hash',record.submittedAt,`Transaction hash: ${record.hash}\nWallet approval is external to PhishNet. Submission is not settlement.`],['Network verification','Arc public RPC read',record.checkedAt||'Not checked',`${record.status}: ${record.detail}\nBlock: ${record.blockNumber||'not verified'}`]];
  if(record.consentProof)events.splice(1,0,['Human countersignature',record.consentVerifiedThisSession?'counter-sign 0.2 keyed verifier':'Saved browser record; consent not reverified this session',record.consentProof.resolution?.countersignatures?.[0]?.timestamp||'Unknown',`Intent: ${record.consentProof.intentId}\nTransaction commitment: ${record.consentProof.transactionDigest}\nHuman-keyed receipt is separate from wallet signing and settlement. Hardware presence is not attested.`]);
  for(const event of events){const b=node('button',event[0]);b.dataset.step=String(events.indexOf(event));b.onclick=()=>{steps.querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));detail.replaceChildren();for(const [label,value] of [['Event',event[0]],['Source',event[1]],['Timestamp',event[2]]])reviewField(detail,label,value);detail.append(node('blockquote',event[3]));};steps.append(b);}
  const close=node('button','Close payment trail');close.onclick=()=>panel.hidden=true;panel.append(steps,detail,close);steps.querySelectorAll('button')[step].click();if(navigate){location.hash='explore';setTab();panel.scrollIntoView({block:'start'});}
}
for(const button of document.querySelectorAll('[data-story-event]'))button.onclick=()=>document.dispatchEvent(new CustomEvent('phishnet:select-event',{detail:button.dataset.storyEvent}));
walletUI();renderHistory();
// Stored hashes never restore a trusted CONFIRMED label: each is rechecked against the network.
if(history.length)$('refresh-activity').click();

$('request-consent').onclick=async()=>{if(!quote||submitting)return;const expected=quote;try{const signed=await api('consent/intent',expected.input);if(quote!==expected)throw Error('Review changed. Request a new intent.');quote.consent=signed;$('download-consent').hidden=false;$('consent-status').textContent=`${signed.status} · ${signed.intent.intent_id} · reject on timeout. Download for the independent approver.`;}catch(error){$('consent-status').textContent=errorText(error);}};
$('download-consent').onclick=()=>{if(!quote?.consent)return;const url=URL.createObjectURL(new Blob([JSON.stringify(quote.consent,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='phishnet-counter-sign-intent.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('consent-receipt').onchange=async()=>{const file=$('consent-receipt').files[0],expected=quote;if(!file||!expected?.consent)return;if(file.size>64000){$('consent-status').textContent='Receipt file is too large.';return;}try{const resolution=JSON.parse(await file.text());if(quote!==expected)throw Error('Review changed. Request a new intent.');const result=await api('consent/receipt',{intentId:expected.consent.intent.intent_id,payment:expected.input,resolution});$('consent-status').textContent=`${result.status} · Independent keyed receipt verified for this exact intent. Wallet approval is still required.`;}catch(error){$('consent-status').textContent=errorText(error);}};
