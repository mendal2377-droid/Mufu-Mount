import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(process.env.MUFU_TEST_URL||'http://127.0.0.1:4173',{waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__mufu?.state.ready,{timeout:120000});
await page.screenshot({path:'test-results/welcome.png'});
await page.getByRole('button',{name:'Enter the mountain'}).click();
await page.waitForTimeout(2000);await page.keyboard.press('Escape');await page.evaluate(()=>document.exitPointerLock());
const before=await page.evaluate(()=>window.__mufu.getStats());
await page.keyboard.down('w');await page.waitForFunction(d=>window.__mufu.state.distance>d+.4,before.distance,{timeout:60000});await page.keyboard.up('w');
const after=await page.evaluate(()=>window.__mufu.getStats());
if(after.distance<=before.distance+.3)throw Error('WASD did not move the player');
await page.screenshot({path:'test-results/walking.png'});
await page.locator('#collect').click();
for(let i=1;i<5;i++){await page.locator('#destination').selectOption(String(i));await page.locator('#collect').click();}
if((await page.locator('#found').textContent())!=='5 / 5')throw Error('Notes collection failed');
await page.locator('#destination').selectOption('3');
for(const weather of ['sunset','storm','snow']){await page.locator(`[data-weather=${weather}]`).click();await page.waitForFunction(w=>window.__mufu.weather[w]>.8,weather,{timeout:120000});await page.screenshot({path:`test-results/${weather}.png`});}
await page.locator('#overview').click();await page.waitForTimeout(500);await page.screenshot({path:'test-results/overview.png'});await page.locator('#overview').click();
await page.locator('#auto').click();const autoBefore=await page.evaluate(()=>window.__mufu.state.distance);await page.waitForTimeout(2000);const autoAfter=await page.evaluate(()=>window.__mufu.state.distance);if(autoAfter<=autoBefore)throw Error('Guided walk failed');await page.locator('#auto').click();
const download=page.waitForEvent('download');await page.locator('#postcard').click();await (await download).saveAs('test-results/postcard.png');
await page.locator('#help').click();await page.screenshot({path:'test-results/help.png'});await page.locator('#close-info').click();
const report={errors,wasdDistance:after.distance-before.distance,guidedDistance:autoAfter-autoBefore,stats:await page.evaluate(()=>window.__mufu.getStats())};
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/mobile.png'});
await fs.writeFile('test-results/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
await browser.close();if(errors.some(e=>!/fonts.googleapis|ERR_CERT|pointer lock|PointerLock|pointerlock/i.test(e)))process.exitCode=1;
