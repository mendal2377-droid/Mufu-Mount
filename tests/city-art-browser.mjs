import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {cityPoint} from '../src/city-geography.js';
const data=JSON.parse(await fs.readFile('public/city/nanjing.json','utf8'));
const lake=cityPoint(data.landmarks.find(p=>p.id==='xuanwu').coord,data);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist'],
  ...(process.env.MUFU_PUBLIC?{proxy:{server:'http://127.0.0.1:7890'}}:{})});
const errors=[],report={};await fs.mkdir('test-results',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1100,height:700}});
  await page.addInitScript(()=>localStorage.setItem('mufu-quality','smooth'));
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/fonts|ERR_CERT|PointerLock|pointer lock/i.test(m.text()))errors.push(m.text());});
  await page.goto(process.env.MUFU_TEST_URL||'http://127.0.0.1:4186');
  await page.waitForFunction(()=>window.__mufu?.city?.active,null,{timeout:120000});
  await page.evaluate(()=>{window.__mufu.paused=true;window.__mufu.step(3,.1);});
  report.art=await page.evaluate(()=>window.__mufu.city.stats().art);
  assert.ok(report.art.foliageReady&&report.art.meadowReady);
  await page.screenshot({path:'test-results/city-art-overview.png',timeout:120000});
  await page.evaluate(lake=>{const m=window.__mufu;m.city.enter('xuanwu');m.camera.lookAt(lake[0],m.camera.position.y+1,lake[2]);m.step(8,.5);},lake);
  report.landscape=await page.evaluate(()=>window.__mufu.city.stats().landscape);
  assert.ok(report.landscape.nearTrees>0&&report.landscape.paintedCanopies);
  assert.equal(await page.locator('#hud').isVisible(),false);
  for(const mood of ['morning','sunset','storm','snow']){
    await page.evaluate(mood=>{const m=window.__mufu;m.setWeather(mood);m.step(16,.5);},mood);
    await page.screenshot({path:`test-results/city-art-${mood}.png`,timeout:120000});
    console.log('Art rendering checked',mood);
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.__mufu.step(2,.1));
  await page.screenshot({path:'test-results/city-art-portrait.png',timeout:120000});
  report.errors=errors;assert.equal(errors.length,0,errors.join('\n'));console.log('City art assets, shader compilation, weather and portrait passed');
}finally{await fs.writeFile('test-results/city-art-browser.json',JSON.stringify(report,null,2));await browser.close();}
