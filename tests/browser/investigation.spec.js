import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('#decision')).toHaveText('DENIED');});
test('VC-01/06/07 transaction is legible, exact and explicitly simulated',async({page,context})=>{
  await expect(page.locator('.amount')).toHaveText('250.00 USDC');await expect(page.locator('#change')).toContainText('Recipient changed');
  await expect(page.locator('#decision')).toBeInViewport();await expect(page.locator('.amount')).toBeInViewport();await expect(page.locator('#change')).toBeInViewport();
  const full='0x1111111111111111111112111111111111111111';await expect(page.locator('.address').nth(1)).toHaveText(full);
  await context.grantPermissions(['clipboard-read','clipboard-write']);await page.getByRole('button',{name:'Copy proposed payment address'}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(full);
  await expect(page.locator('#settlement')).toContainText('SIMULATED');expect(await page.locator('a[href*="explorer"]').count()).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('VC-02/03/04/08 shared selection and source detail with typed relationships',async({page})=>{
  await page.locator('#timeline [data-event="agent-2"]').click();await expect(page.locator('#graph [data-event="agent-2"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#detail')).toContainText('Payment agent');
  await page.locator('#graph [data-event="origin"]').click();await expect(page.locator('#timeline [data-event="origin"]')).toHaveAttribute('aria-pressed','true');
  for(const text of ['origin','Asserted vendor billing desk','2026-11-26T09:02:00Z','Unverified assertion'])await expect(page.locator('#detail')).toContainText(text);
  await expect(page.locator('#convergence')).toContainText('1 source · 2 agent repetitions');
  await page.getByRole('button',{name:'agent-1 → agent-2 · Inferred influence',exact:true}).click();await expect(page.locator('#detail')).toContainText('Temporal proximity only');await expect(page.locator('#detail')).toContainText('Low; heuristic hypothesis');
  expect(await page.locator('#graph path[stroke-dasharray="7 5"]').count()).toBeGreaterThan(0);expect(await page.locator('#graph path:not([stroke-dasharray])').count()).toBeGreaterThan(0);
});
test('VC-05 signed benign counterexample differs without live execution',async({page})=>{
  await page.locator('#case').selectOption('authorized-update');await expect(page.locator('#decision')).toHaveText('PERMITTED IN SIMULATION');await expect(page.locator('#review')).toContainText('New signed fixture mandate');
  await page.locator('#timeline [data-event="verification"]').click();await expect(page.locator('#detail')).toContainText('fixture-directory-callback');await expect(page.locator('#detail')).toContainText('synthetic identities');
  await page.locator('#case').selectOption('vendor-substitution');await expect(page.locator('#decision')).toHaveText('DENIED');expect(await page.locator('[data-event="verification"]').count()).toBe(0);
});
test('VC-09 keyboard/touch, reduced motion and inert untrusted text',async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:'reduce',forcedColors:'active'});
  const b=page.locator('#timeline [data-event="agent-1"]');await b.focus();await page.keyboard.press('Enter');await expect(page.locator('#source-title')).toBeFocused();await expect(page.locator('#detail')).toContainText('agent-1');await page.getByRole('button',{name:'Back to selected timeline event'}).click();await expect(b).toBeFocused();
  const origin=page.locator('#graph [data-event="origin"]');if(testInfo.project.use.hasTouch)await origin.tap();else await origin.click();await expect(page.locator('#detail blockquote')).toContainText('<img src=x');expect(await page.locator('#detail img').count()).toBe(0);expect(await page.evaluate(()=>window.injected)).toBeUndefined();
  const size=await origin.boundingBox();expect(size.height).toBeGreaterThanOrEqual(44);await expect(page.locator('#source-title')).toBeFocused();
});
test('VC-10 recording infrastructure measures input, not fabricated study outcomes',async({page})=>{
  await page.locator('#study summary').click();await expect(page.locator('#task-result')).toHaveText('No reviewer observations recorded for this case.');await page.locator('#study-mode').selectOption('timeline');await expect(page.locator('#lineage')).toBeHidden();
  await page.locator('#start-task').click();await page.locator('#answer').selectOption('ALLOW');await page.locator('#source-answer').fill('agent-2');await page.locator('#confidence').fill('95');await page.locator('#errors').fill('2');
  await page.getByRole('button',{name:'Record response',exact:true}).click();await expect(page.locator('#task-result')).toContainText('Decision incorrect; source incorrect');
  const downloadPromise=page.waitForEvent('download');await page.locator('#download-study').click();const download=await downloadPromise;const stream=await download.createReadStream();const chunks=[];for await(const c of stream)chunks.push(c);const rows=JSON.parse(Buffer.concat(chunks).toString());expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({decisionCorrect:false,sourceCorrect:false,confidencePercent:95,incorrectConfidencePercent:95,inputErrors:2,condition:'timeline'});expect(rows[0].elapsedMs).toBeGreaterThan(0);
});
test('failed case loading is visible and does not present stale authorization',async({page})=>{await page.route('**/v1/investigations',route=>route.fulfill({status:503,body:'unavailable'}));await page.reload();await expect(page.locator('#error')).toContainText('Cases could not be loaded');await expect(page.locator('#case')).toBeDisabled();expect(await page.locator('#decision').count()).toBe(0);});
