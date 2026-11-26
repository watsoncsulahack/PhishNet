import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('/#explore');await page.locator('#graph-source').selectOption('demo');await expect(page.locator('#note-title')).toHaveText('Recipient change introduced');await expect(page.locator('#knowledge-map canvas').first()).toBeAttached();});
test('typed notes, backlinks, search and chronological replay share one record model',async({page})=>{
  await page.locator('#node-type').selectOption('rationale');await expect(page.locator('#note-kind')).toContainText('RECORDED RATIONALE');await expect(page.locator('#detail')).toContainText('not a transcript of private model reasoning');await expect(page.locator('#map-summary')).toContainText('1 of');
  await page.locator('#node-type').selectOption('all');await page.locator('#node-search').fill('nothing-matches-this');await expect(page.locator('#map-summary')).toContainText('No notes match');await expect(page.locator('#note-title')).toHaveText('No matching note');
  await page.locator('#node-search').fill('');await page.locator('#replay-step').fill('0');await expect(page.locator('#map-summary')).toContainText('1 of');await expect(page.locator('#note-title')).toHaveText('Original financial intent');
  await page.locator('#replay-step').fill(await page.locator('#replay-step').getAttribute('max'));await page.locator('#node-type').selectOption('proposal');await expect(page.locator('#note-title')).toHaveText('Exact payment proposed');await expect(page.locator('#note-links')).toContainText('Linked notes & backlinks');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('canvas node selection, map zoom and native keyboard index work together',async({page})=>{
  await page.locator('#knowledge-map').scrollIntoViewIfNeeded();await page.locator('#fit-map').click();
  const pos=await page.locator('#knowledge-map').evaluate(el=>el._cyreg.cy.getElementById('rationale').renderedPosition());const bounds=await page.locator('#knowledge-map').boundingBox();await page.mouse.click(bounds.x+pos.x,bounds.y+pos.y);await expect(page.locator('#note-title')).toHaveText('Proposed rationale');
  const before=await page.locator('#knowledge-map').evaluate(el=>el._cyreg.cy.zoom());await page.locator('#zoom-in').click();expect(await page.locator('#knowledge-map').evaluate(el=>el._cyreg.cy.zoom())).toBeGreaterThan(before);
  await page.locator('#map-index summary').click();await page.locator('#graph [data-event="consent"]').focus();await page.keyboard.press('Enter');await expect(page.locator('#note-kind')).toContainText('HUMAN CONSENT');await expect(page.locator('#detail')).toContainText('No approval');
});
test('consent profile and device boundary are visible without pretending hardware is attested',async({page},testInfo)=>{
  await page.locator('#consent-profile').click();await expect(page.locator('.consent-overview')).toContainText('hardware presence is not attested');await expect(page.locator('.reasoning-boundary')).toContainText('Private model reasoning is not exposed');await page.locator('#knowledge-map').scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('notebook.png'),fullPage:true});
});
