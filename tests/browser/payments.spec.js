import {test,expect} from '@playwright/test';
const sender='0x1111111111111111111111111111111111111111';
const recipient='0x2222222222222222222222222222222222222222';
const hash='0x'+'a'.repeat(64);
async function setup(page,options={}){
  await page.addInitScript(({sender,hash,options})=>{
    window.__chain=options.initialChain||'0x4cef52';window.__accounts=[sender];window.__calls=[];window.__reject=!!options.reject;window.__delaySend=!!options.delaySend;
    const listeners={};window.__emit=(name,value)=>listeners[name]?.forEach(fn=>fn(value));
    window.ethereum={isMetaMask:true,on:(name,fn)=>(listeners[name]??=[]).push(fn),removeListener:(name,fn)=>listeners[name]=listeners[name]?.filter(v=>v!==fn),request:async args=>{
      window.__calls.push(args);
      if(args.method==='eth_requestAccounts'||args.method==='eth_accounts')return window.__accounts;
      if(args.method==='eth_chainId')return window.__chain;
      if(args.method==='wallet_switchEthereumChain'){if(options.unknownChain&&!window.__added)throw Object.assign(Error('Unknown chain'),{code:4902});window.__chain=args.params[0].chainId;return null;}
      if(args.method==='wallet_addEthereumChain'){window.__added=args.params[0];return null;}
      if(args.method==='eth_sendTransaction'){if(window.__reject)throw Object.assign(Error('Rejected'),{code:4001});if(window.__delaySend)await new Promise(r=>window.__releaseSend=r);return hash;}
      throw Error('Unexpected method '+args.method);
    }};
  },{sender,hash,options});
  await page.route('**/v1/testnet/**',async route=>{
    const path=new URL(route.request().url()).pathname;const body=route.request().postDataJSON();
    if(path.endsWith('/balance'))return route.fulfill({json:{address:sender,chainId:5042002,balanceBaseUnits:'10000000000000000000'}});
    if(path.endsWith('/quote')){
      if(options.quoteError)return route.fulfill({status:400,json:{error:options.quoteError}});
      if(options.quoteDelay)await new Promise(r=>setTimeout(r,options.quoteDelay));
      return route.fulfill({json:{transaction:{from:body.from,to:body.to,value:'0x470de4df820000',chainId:'0x4cef52',data:'0x'},gas:'0x6270',maxFeePerGas:'0x77359400',estimatedFeeBaseUnits:'50400000000000',balanceBaseUnits:'10000000000000000000',expiresAt:Date.now()+(options.expired?-1:60000),checks:['Arc Testnet only','Complete recipient address','Balance covers amount and estimated fee']}});
    }
    if(path.endsWith('/receipt')){
      if(options.rpcOffline)return route.fulfill({status:400,json:{error:'RPC unavailable'}});
      return route.fulfill({json:{status:options.receiptStatus||'CONFIRMED',detail:options.receiptStatus==='MISMATCH'?'Network transaction differs from the reviewed payment.':'Receipt and exact payment checked via the public RPC.',blockNumber:'7',checkedAt:new Date().toISOString(),chainId:5042002}});
    }
    return route.fulfill({status:404,json:{error:'Unexpected route'}});
  });
}
async function connect(page){await page.getByRole('button',{name:'Connect wallet',exact:true}).click();await expect(page.locator('#real-balance')).toHaveText('10');}
async function review(page){await page.locator('#recipient').fill(recipient);await page.locator('#payment-amount').fill('0.02');await page.locator('#payment-note').fill('Test invoice');await page.getByRole('button',{name:'Review payment',exact:true}).click();await expect(page.locator('#payment-dialog')).toBeVisible();}
test('cohesive payment workspace and responsive tab navigation',async({page},testInfo)=>{
  await page.goto('/');await expect(page.getByRole('heading',{name:'Payments, with perspective.'})).toBeVisible();await expect(page.locator('#real-balance')).toHaveText('—');await expect(page.locator('#recent-activity')).toContainText('Your next payment starts the story.');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('payments.png'),fullPage:true});
  await page.locator('[data-tab="activity"]').click();await expect(page.locator('#activity-title')).toBeVisible();await page.locator('[data-tab="explore"]').click();await expect(page.locator('#decision')).toHaveText('DENIED');await page.locator('[data-story-event="origin"]').click();await expect(page.locator('#detail')).toContainText('Asserted vendor billing desk');
  await page.screenshot({path:testInfo.outputPath('explore.png'),fullPage:true});
});
test('wallet-approved send has exact native amount, one broadcast, verified activity and provenance',async({page})=>{
  await setup(page);await page.goto('/');await connect(page);await review(page);await expect(page.locator('#transfer-review')).toContainText(recipient);await expect(page.locator('#transfer-review')).toContainText('0.0000504 USDC');await expect(page.locator('#transfer-review')).toContainText('Recipient identity is unverified');
  await page.getByRole('button',{name:'Continue in wallet',exact:true}).click();await expect(page.locator('#activity-panel .pill')).toHaveText('CONFIRMED');
  const sends=await page.evaluate(()=>window.__calls.filter(c=>c.method==='eth_sendTransaction'));expect(sends).toHaveLength(1);expect(sends[0].params).toEqual([{from:sender,to:recipient,value:'0x470de4df820000',chainId:'0x4cef52',data:'0x',gas:'0x6270',maxFeePerGas:'0x77359400',maxPriorityFeePerGas:'0x0'}]);
  await expect(page.locator('#all-activity a')).toHaveAttribute('href',`https://explorer.testnet.arc.io/tx/${hash}`);await page.locator('#all-activity').getByRole('button',{name:'Inspect payment trail'}).click();await expect(page.locator('#live-trace')).toContainText('no agent messages');await page.locator('#live-trace').getByRole('button',{name:'Network verification',exact:true}).click();await expect(page.locator('#live-trace-detail')).toContainText('Arc public RPC read');
});
test('wallet rejection creates no submitted payment and leaves review editable',async({page})=>{await setup(page,{reject:true});await page.goto('/');await connect(page);await review(page);await page.locator('#approve-payment').click();await expect(page.locator('#signing-status')).toContainText('cancelled in your wallet');expect(await page.locator('#all-activity .pill').count()).toBe(0);await expect(page.locator('#approve-payment')).toBeEnabled();await page.locator('#edit-payment').click();await expect(page.locator('#payment-dialog')).toBeHidden();});
test('network, account and review expiry changes prevent signing',async({page})=>{
  await setup(page,{expired:true});await page.goto('/');await connect(page);await review(page);await page.locator('#approve-payment').click();await expect(page.locator('#signing-status')).toContainText('expired or changed');expect(await page.evaluate(()=>window.__calls.filter(c=>c.method==='eth_sendTransaction').length)).toBe(0);
  await page.locator('#edit-payment').click();await page.evaluate(()=>window.__chain='0x1');await page.locator('#review-payment').click();await expect(page.locator('#payment-error')).toContainText('Wrong network');
});
test('account change invalidates an open review',async({page})=>{await setup(page);await page.goto('/');await connect(page);await review(page);await page.evaluate(()=>{window.__accounts=['0x3333333333333333333333333333333333333333'];window.__emit('accountsChanged',window.__accounts);});await expect(page.locator('#payment-dialog')).toBeHidden();expect(await page.evaluate(()=>window.__calls.filter(c=>c.method==='eth_sendTransaction').length)).toBe(0);});
test('wrong amount and insufficient funds never reach wallet signing',async({page})=>{await setup(page,{quoteError:'Insufficient test USDC for the amount and estimated network fee.'});await page.goto('/');await connect(page);await page.locator('#recipient').fill(recipient);await page.locator('#payment-amount').fill('0.0000001');await page.locator('#review-payment').click();await expect(page.locator('#payment-error')).toContainText('up to 6 decimal places');await page.locator('#payment-amount').fill('0.02');await page.locator('#review-payment').click();await expect(page.locator('#payment-error')).toContainText('Insufficient');expect(await page.evaluate(()=>window.__calls.filter(c=>c.method==='eth_sendTransaction').length)).toBe(0);});
test('repeated approval cannot create duplicate submissions',async({page})=>{await setup(page,{delaySend:true});await page.goto('/');await connect(page);await review(page);await page.locator('#approve-payment').click();await expect(page.locator('#approve-payment')).toBeDisabled();await expect.poll(()=>page.evaluate(()=>window.__calls.filter(c=>c.method==='eth_sendTransaction').length)).toBe(1);await page.evaluate(()=>{document.querySelector('#approve-payment').click();window.__releaseSend();});await expect(page.locator('#all-activity .pill')).toHaveText('CONFIRMED');expect(await page.evaluate(()=>window.__calls.filter(c=>c.method==='eth_sendTransaction').length)).toBe(1);});
test('receipt mismatch never shows confirmed',async({page})=>{await setup(page,{receiptStatus:'MISMATCH'});await page.goto('/');await connect(page);await review(page);await page.locator('#approve-payment').click();await expect(page.locator('#all-activity .pill')).toHaveText('MISMATCH');await expect(page.locator('#all-activity')).toContainText('differs from the reviewed payment');});
test('stored confirmation is not trusted after reload and RPC failure',async({page})=>{await setup(page,{rpcOffline:true});await page.addInitScript(({sender,recipient,hash})=>localStorage.setItem('phishnet.testnet.payments.v1',JSON.stringify([{hash,input:{from:sender,to:recipient,amount:'0.02'},status:'CONFIRMED',submittedAt:'2026-11-26T10:00:00Z',note:'<img src=x onerror=alert(1)>'}])) ,{sender,recipient,hash});await page.goto('/#activity');await expect(page.locator('#all-activity .pill')).toHaveText('UNVERIFIED');expect(await page.locator('#all-activity img').count()).toBe(0);await expect(page.locator('#all-activity')).toContainText('do not resend');});
test('unknown Arc network is added with 18 native decimals and then switched',async({page})=>{await setup(page,{initialChain:'0x1',unknownChain:true});await page.goto('/');await connect(page);const added=await page.evaluate(()=>window.__added);expect(added).toMatchObject({chainId:'0x4cef52',nativeCurrency:{name:'USDC',symbol:'USDC',decimals:18},rpcUrls:['https://rpc.testnet.arc.io']});});
