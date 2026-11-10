import { expect,test } from '@playwright/test';
import { resetDb } from './helpers/reset-db.js';
test('mudanza rechaza el guardado, conserva el borrador y detiene nuevas consultas de polling',async({page})=>{
 resetDb();await page.goto('/');await expect(page.locator('#board .column')).toHaveCount(5);
 await page.locator('.add-card[data-col="pendiente"]').click();await page.locator('#fTitle').fill('Mi borrador antes de mudarnos');
 await page.route('**/api/boards/*/cards',route=>route.fulfill({status:410,contentType:'application/json',body:JSON.stringify({error:'Fun TasKing se mudó a HomeSuite.',code:'tasking_migrated'})}));
 page.on('dialog',dialog=>dialog.dismiss());await page.locator('#saveBtn').click();
 await expect(page.locator('#tasking-move-notice')).toContainText('Pablitux');await expect(page.locator('#fTitle')).toHaveValue('Mi borrador antes de mudarnos');await expect(page.locator('#fTitle')).toBeVisible();
 let calls=0;page.on('request',r=>{if(r.url().includes('/version'))calls++;});
 await page.evaluate(async()=>{const polling=await import('/js/polling.js');polling.startPolling();await polling.pollTick();document.dispatchEvent(new Event('visibilitychange'));await polling.pollTick();});
 expect(calls).toBe(0);await expect(page).toHaveURL(/127.0.0.1:8787\//);
});
