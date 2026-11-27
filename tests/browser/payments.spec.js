import {test,expect} from '@playwright/test';import {generateKeypair} from '@countersignlabs/counter-sign';
import {fixture,owner,sender,recipient,hash} from './gateway-fixture.js';
let t;test.afterEach(async()=>{if(t){await t.close();t=null;}});
async function setup(page,options={}){t=await fixture(page,options);await page.goto('/');}
async function connect(page){await page.getByRole('button',{name:'Connect wallet',exact:true}).click();await expect(page.locator('#session-status')).toContainText('Signed in to');await expect(page.locator('#real-balance')).toHaveText('10');}
async function review(page){await page.locator('#open-send').click();await page.locator('#recipient').fill(recipient);await page.locator('#payment-amount').fill('0.02');await page.locator('#payment-note').fill('Test invoice');await page.locator('#review-payment').click();await expect(page.locator('#payment-dialog')).toBeVisible();}
async function importReceipt(page,resolution){await page.locator('#consent-receipt').setInputFiles({name:'resolution.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(resolution))});}
async function sends(page){return page.evaluate(()=>window.__calls.filter(c=>c.method==='eth_sendTransaction'));}
test('sketch-led wallet, equal Send/Receive, generic Chat and five-tab navigation',async({page},info)=>{await setup(page);await expect(page.getByRole('heading',{name:'Your wallet.',exact:true})).toBeVisible();for(const id of ['open-send','open-receive','chat-input'])await expect(page.locator('#'+id)).toBeVisible();await expect(page.getByRole('button',{name:/Microphone unavailable/})).toBeDisabled();await page.locator('#open-send').click();await expect(page.locator('#send-sheet')).toBeVisible();await page.locator('#close-send').click();await expect(page.locator('#send-sheet')).toBeHidden();await page.locator('[data-tab=activity]').click();await expect(page.locator('#all-activity')).toContainText('sign in');await page.locator('[data-tab=explore]').click();await expect(page.locator('#live-summary')).toContainText('sign in');await expect(page.locator('#demo-notebook')).toBeHidden();await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));await page.locator('[data-tab=settings]').click();await expect(page.locator('#settings-title')).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('[data-tab=payments]').click();await page.screenshot({path:info.outputPath('wallet-mvp.png'),fullPage:true});});
test('manual external-wallet send records exact amount and real source provenance without agent events',async({page})=>{await setup(page);await connect(page);await review(page);for(const value of [recipient,'0.0000504 USDC','Recipient identity is unverified'])await expect(page.locator('#transfer-review')).toContainText(value);await page.locator('#approve-payment').click();await expect(page.locator('#all-activity .pill')).toHaveText('CONFIRMED');const calls=await sends(page);expect(calls).toHaveLength(1);expect(calls[0].params[0]).toEqual({from:owner.address,to:recipient,value:'0x470de4df820000',chainId:'0x4cef52',data:'0x',gas:'0x6270',maxFeePerGas:'0x77359400',maxPriorityFeePerGas:'0x0'});await expect(page.locator('#all-activity a')).toHaveAttribute('href','https://explorer.testnet.arc.io/tx/'+hash);expect(t.g.events(sender).some(e=>e.actor.type==='agent')).toBe(false);await page.locator('#all-activity').getByRole('button',{name:'Inspect payment trail'}).click();await expect(page.locator('#live-timeline')).toContainText('chain.receipt.checked');await page.locator('#live-timeline button').last().click();await expect(page.locator('#live-detail')).toContainText('RPC_VERIFIED');await expect(page.locator('#live-detail')).toContainText('Exact recorded event');});
test('wallet rejection is durable and cannot retry a consumed authorization',async({page})=>{await setup(page,{reject:true});await connect(page);await review(page);await page.locator('#approve-payment').click();await expect(page.locator('#signing-status')).toContainText('cancelled in your wallet');await expect(page.locator('#all-activity .pill')).toHaveText('WALLET_REJECTED');expect(t.g.events(sender).some(e=>e.eventType==='wallet.submission.observed')).toBe(false);await expect(page.locator('#approve-payment')).toBeDisabled();await page.evaluate(()=>document.querySelector('#approve-payment').click());expect(await sends(page)).toHaveLength(1);await page.locator('#edit-payment').click();await expect(page.locator('#payment-dialog')).toBeHidden();});
test('expired review and wrong network prevent signing',async({page})=>{await setup(page,{expired:true});await connect(page);await review(page);await page.locator('#approve-payment').click();await expect(page.locator('#signing-status')).toContainText('expired or changed');expect(await sends(page)).toHaveLength(0);await page.locator('#edit-payment').click();await page.evaluate(()=>window.__chain='0x1');await page.locator('#review-payment').click();await expect(page.locator('#payment-error')).toContainText('Wrong network');});
test('account switch clears private graph, chat and activity and invalidates review',async({page})=>{await setup(page);await connect(page);await review(page);await page.evaluate(()=>{window.__accounts=['0x'+'3'.repeat(40)];window.__emit('accountsChanged',window.__accounts);});await expect(page.locator('#payment-dialog')).toBeHidden();await expect(page.locator('#all-activity')).toContainText('sign in');await expect(page.locator('#live-summary')).toContainText('sign in');expect(await sends(page)).toHaveLength(0);expect(await page.locator('#live-timeline button').count()).toBe(0);});
test('invalid amount and insufficient funds prevent external wallet request',async({page})=>{await setup(page,{quoteError:'Insufficient test USDC for the amount and estimated network fee.'});await connect(page);await page.locator('#open-send').click();await page.locator('#recipient').fill(recipient);await page.locator('#payment-amount').fill('0.0000001');await page.locator('#review-payment').click();await expect(page.locator('#payment-error')).toContainText('up to 6 decimal');await page.locator('#payment-amount').fill('0.02');await page.locator('#review-payment').click();await expect(page.locator('#payment-error')).toContainText('Insufficient');expect(await sends(page)).toHaveLength(0);});
test('double approval cannot duplicate wallet requests',async({page})=>{await setup(page,{delaySend:true});await connect(page);await review(page);await page.locator('#approve-payment').click();await expect(page.locator('#approve-payment')).toBeDisabled();await expect.poll(async()=>(await sends(page)).length).toBe(1);await page.evaluate(()=>{document.querySelector('#approve-payment').click();window.__releaseSend();});await expect(page.locator('#all-activity .pill')).toHaveText('CONFIRMED');expect(await sends(page)).toHaveLength(1);});
test('receipt mismatch stays unverified',async({page})=>{await setup(page,{receiptStatus:'MISMATCH'});await connect(page);await review(page);await page.locator('#approve-payment').click();await expect(page.locator('#all-activity .pill')).toHaveText('UNVERIFIED');await expect(page.locator('#all-activity')).toContainText('differs from the reviewed');});
test('stored status is hidden until wallet proof and imported only as untrusted',async({page})=>{await setup(page,{rpcOffline:true});await page.evaluate(({sender,recipient,hash})=>localStorage.setItem('phishnet.testnet.payments.v1',JSON.stringify([{hash,input:{from:sender,to:recipient,amount:'0.02'},status:'CONFIRMED',note:'<img src=x onerror=alert(1)>'}])) ,{sender,recipient,hash});await page.reload();await expect(page.locator('#all-activity')).toContainText('sign in');await connect(page);await page.locator('[data-tab=settings]').click();await page.locator('#import-history').click();await expect(page.locator('#all-activity .pill')).toHaveText('UNVERIFIED');expect(t.g.events(sender).map(e=>e.eventType)).toEqual(['history.imported']);await page.locator('[data-tab=activity]').click();await page.locator('#refresh-activity').click();await expect(page.locator('#all-activity')).toContainText('do not resend');expect(await page.locator('#all-activity img').count()).toBe(0);});
test('unknown Arc network is added with native USDC 18 decimals',async({page})=>{await setup(page,{initialChain:'0x1',unknownChain:true});await connect(page);expect(await page.evaluate(()=>window.__added)).toMatchObject({chainId:'0x4cef52',nativeCurrency:{name:'USDC',symbol:'USDC',decimals:18}});});
test('real CounterSign receipt gates canonical manual review',async({page})=>{await setup(page,{requireConsent:true});await connect(page);await review(page);await page.locator('#approve-payment').click();await expect(page.locator('#signing-status')).toContainText('CounterSign');expect(await sends(page)).toHaveLength(0);await page.locator('#request-consent').click();await expect(page.locator('#consent-status')).toContainText('PENDING');const p=t.g.list(sender)[0];await importReceipt(page,await t.approve(p.id));await expect(page.locator('#consent-status')).toContainText('APPROVED');await page.locator('#approve-payment').click();await expect(page.locator('#all-activity .pill')).toHaveText('CONFIRMED');expect(await sends(page)).toHaveLength(1);});
test('foreign human signature cannot release wallet signing',async({page})=>{await setup(page,{requireConsent:true});await connect(page);await review(page);await page.locator('#request-consent').click();await expect(page.locator('#consent-status')).toContainText('PENDING');await importReceipt(page,await t.approve(t.g.list(sender)[0].id,generateKeypair()));await expect(page.locator('#consent-status')).not.toContainText('APPROVED');await page.locator('#approve-payment').click();await expect(page.locator('#signing-status')).toContainText('approval');expect(await sends(page)).toHaveLength(0);});
test('Receive shows full selected address and incomplete history disclosure',async({page})=>{await setup(page);await connect(page);await page.locator('#open-receive').click();await expect(page.locator('#receive-address')).toHaveText(sender);await expect(page.locator('#receive-dialog')).toContainText('not a complete incoming-payment history');await page.locator('#close-receive').click();});
test('offline agent queues generic Chat; actual tool proposal requires human review',async({page},info)=>{await setup(page,{requireConsent:true});await connect(page);await page.locator('#chat-input').fill('Prepare 0.02 test USDC');await page.locator('#send-chat').click();await expect(page.locator('#chat-status')).toContainText('QUEUED');const issued=t.g.issueAgent(sender),agent=t.g.agent(issued.token),job=t.g.jobs(agent)[0];await t.g.tool(agent,{tool:'plan.report',arguments:{chatId:job.chatId,text:'Reported plan: prepare exact unsigned terms.'}});const proposed=await t.g.tool(agent,{tool:'payment.propose',arguments:{chatId:job.chatId,to:recipient,amount:'0.02',purpose:'Agent assertion'}});expect(proposed.signingCapability).toBe(false);await page.locator('[data-tab=activity]').click();await page.locator('#refresh-activity').click();await page.locator('#all-activity').getByRole('button',{name:'Review payment'}).click();await expect(page.locator('#transfer-review')).toContainText('Agent-prepared unsigned proposal');await page.locator('#request-consent').click();await expect(page.locator('#consent-status')).toContainText('PENDING');await importReceipt(page,await t.approve(proposed.proposalId));await expect(page.locator('#consent-status')).toContainText('APPROVED');await page.locator('#approve-payment').click();await expect(page.locator('#all-activity .pill')).toHaveText('CONFIRMED');await page.locator('#all-activity').getByRole('button',{name:'Inspect payment trail'}).click();await expect(page.locator('#live-timeline')).toContainText('agent.plan.reported');await page.locator('#live-timeline').getByRole('button').filter({hasText:'agent.plan.reported'}).click();await expect(page.locator('#live-detail')).toContainText('Agent-reported explanation');await expect(page.locator('#live-detail')).toContainText('private-reference');await page.locator('#layer-decisions').uncheck();await expect(page.locator('#live-timeline')).not.toContainText('agent.plan.reported');await page.locator('#layer-transactions').uncheck();await expect(page.locator('#live-summary')).toContainText('Both layers are hidden');await page.locator('#layer-decisions').check();await expect(page.locator('#live-timeline')).toContainText('agent.plan.reported');await expect(page.locator('#live-timeline')).not.toContainText('chain.receipt.checked');await page.locator('#layer-transactions').check();await expect(page.locator('#live-timeline')).toContainText('chain.receipt.checked');await expect(page.locator('#live-detail')).toContainText('Agent-reported explanation');await page.screenshot({path:info.outputPath('live-graph.png'),fullPage:true});const overflow=await page.evaluate(()=>[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(e).position!=='absolute').map(e=>e.id||e.tagName));expect(overflow).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);});

test('checkpoint export and failed Arc verification never display an independent anchor',async({page})=>{await setup(page,{audit:true});await connect(page);await page.locator('#chat-input').fill('Private content stays off-chain');await page.locator('#send-chat').click();await expect(page.locator('#chat-status')).toContainText('QUEUED');await page.locator('[data-tab=settings]').click();await page.getByRole('button',{name:'Prepare signed checkpoint'}).click();await expect(page.locator('#audit-controls')).toContainText('UNANCHORED');const d=page.waitForEvent('download');await page.getByRole('button',{name:'Download audit-wallet transaction'}).click();const file=await d,stream=await file.createReadStream(),chunks=[];for await(const c of stream)chunks.push(c);const tx=JSON.parse(Buffer.concat(chunks));expect(tx.value).toBe('0x0');expect(tx.from).toBe('0x'+'3'.repeat(40));expect(tx.data.length).toBe(170);expect(tx.data).not.toContain('Private content');await page.getByRole('textbox',{name:'Audit publication transaction hash'}).fill(hash);await page.getByRole('button',{name:'Record publication hash'}).click();await expect(page.locator('#audit-controls .audit-record>strong')).toHaveText('BROADCAST');await page.getByRole('button',{name:'Verify Arc anchor'}).click();await expect(page.locator('#audit-controls .audit-record>strong')).toHaveText('UNVERIFIED');await expect(page.locator('#audit-controls')).toContainText('Controlled offline audit RPC');});

test('incoming faucet transactions sync into Activity and Knowledge Graph Transaction Flow',async({page})=>{
  const faucet='0x'+'9'.repeat(40),faucetHash='0x'+'f'.repeat(64);
  await setup(page,{chainTransactions:[{txHash:faucetHash,from:faucet,recipient:sender,amountBaseUnits:'10000000000000000000',direction:'incoming',asset:'native-USDC',decimals:18,chainId:5042002,blockNumber:'99',observedAt:'2026-11-26T12:00:00.000Z',source:'rpc-native-tx'}]});
  await connect(page);
  await page.locator('[data-tab=activity]').click();
  await expect(page.locator('#all-activity')).toContainText('Incoming testnet transfer');
  await expect(page.locator('#all-activity')).toContainText('10 USDC');
  await page.locator('#all-activity').getByRole('button',{name:'Inspect payment trail'}).click();
  await expect(page.locator('#live-timeline')).toContainText('chain.transaction.observed');
  await page.locator('#live-timeline').getByRole('button').filter({hasText:'chain.transaction.observed'}).click();
  await expect(page.locator('#live-detail')).toContainText('Incoming on-chain transfer · 10 USDC');
  await page.locator('#layer-decisions').uncheck();
  await expect(page.locator('#live-timeline')).toContainText('chain.transaction.observed');
  await page.locator('#layer-transactions').uncheck();
  await expect(page.locator('#live-summary')).toContainText('Both layers are hidden');
});

test('delayed chainChanged or no-op accountsChanged during sign-in does not break wallet connect',async({page})=>{
  await setup(page,{initialChain:'0x1'});
  await page.evaluate(()=>{
    const orig=window.ethereum.request;
    window.ethereum.request=async args=>{
      if(args.method==='personal_sign'){
        setTimeout(()=>{window.__emit('chainChanged','0x4cef52');window.__emit('accountsChanged',window.__accounts);},10);
        await new Promise(r=>setTimeout(r,60));
      }
      return orig(args);
    };
  });
  await connect(page);
  await expect(page.locator('#app-notice')).toContainText('Private journal unlocked');
});

test('wallet cleanup, full-viewport Chat/Graph with integrated filters, compact clusters, and encrypted zip export/import',async({page},info)=>{
  await setup(page,{requireConsent:true});
  await expect(page.locator('.wallet-card')).toHaveCount(0);
  await expect(page.locator('#settings-panel')).toContainText('Browser app');
  await connect(page);

  await page.locator('[data-tab=chat]').click();
  await expect(page.locator('body')).toHaveClass(/chat-active/);
  const chatScroll=await page.evaluate(()=>({sh:document.documentElement.scrollHeight,ih:window.innerHeight,sw:document.documentElement.scrollWidth,iw:window.innerWidth}));
  expect(chatScroll.sh).toBeLessThanOrEqual(chatScroll.ih+2);
  expect(chatScroll.sw).toBeLessThanOrEqual(chatScroll.iw);

  await page.locator('#conversation-input').fill('Draft a clean payment trace');
  await page.locator('#conversation-send').click();
  await expect(page.locator('#conversation-status')).toContainText('queued');
  const issued=t.g.issueAgent(sender),agent=t.g.agent(issued.token),job=t.g.jobs(agent)[0];
  await t.g.tool(agent,{tool:'plan.report',arguments:{chatId:job.chatId,text:'Reported plan step'}});
  await t.g.tool(agent,{tool:'payment.propose',arguments:{chatId:job.chatId,to:recipient,amount:'0.02',purpose:'Compact cluster verification'}});

  await page.locator('[data-tab=activity]').click();
  await page.locator('#refresh-activity').click();
  await page.locator('[data-tab=explore]').click();
  if((await page.evaluate(()=>window.innerWidth))>=651){
    await expect(page.locator('body')).toHaveClass(/graph-active/);
    const graphScroll=await page.evaluate(()=>({sh:document.documentElement.scrollHeight,ih:window.innerHeight,sw:document.documentElement.scrollWidth,iw:window.innerWidth}));
    expect(graphScroll.sh).toBeLessThanOrEqual(graphScroll.ih+2);
    expect(graphScroll.sw).toBeLessThanOrEqual(graphScroll.iw);
  }else{
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  }
  await expect(page.locator('.live-workspace .live-topbar #live-search')).toBeVisible();
  await expect(page.locator('#live-summary')).toContainText('steps condensed');

  const nodeSummary=page.locator('#live-node-index').locator('..').locator('summary');
  await nodeSummary.click();
  const clusterBtn=page.locator('#live-node-index button').filter({hasText:'details'}).last();
  await expect(clusterBtn).toBeVisible();
  await clusterBtn.click();
  await expect(page.locator('#live-detail')).toContainText('intermediate detail step');
  await page.locator('#live-detail button').filter({hasText:'policy.evaluated'}).click();
  await expect(page.locator('#live-detail')).toContainText('policy.evaluated');
  await page.screenshot({path:info.outputPath('compact-graph.png'),fullPage:true});

  await page.locator('[data-tab=settings]').click();
  const dlPromise=page.waitForEvent('download');
  await page.locator('#export-journal-zip').click();
  const zipDl=await dlPromise;
  const stream=await zipDl.createReadStream(),chunks=[];
  for await(const c of stream)chunks.push(c);
  const zipBuf=Buffer.concat(chunks);
  await expect(page.locator('#journal-zip-status')).toContainText('Exported');

  await page.locator('#import-journal-zip').setInputFiles({name:'backup.zip',mimeType:'application/zip',buffer:zipBuf});
  await expect(page.locator('#journal-zip-status')).toContainText('Imported');
  await expect(page.locator('.advanced-connector')).toBeVisible();
  await expect(page.locator('#issue-agent')).toBeHidden();
  await page.locator('.advanced-connector summary').click();
  await expect(page.locator('#issue-agent')).toBeVisible();
});
