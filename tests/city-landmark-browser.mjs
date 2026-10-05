import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist'],
  ...(process.env.MUFU_PUBLIC?{proxy:{server:'http://127.0.0.1:7890'}}:{})});
const errors=[],report={};await fs.mkdir('test-results',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1100,height:700}});
  await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await page.addInitScript(()=>localStorage.setItem('mufu-quality','smooth'));
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/fonts|ERR_CERT|PointerLock|pointer lock/i.test(m.text()))errors.push(m.text());});
  await page.goto(process.env.MUFU_TEST_URL||'http://127.0.0.1:4186',{waitUntil:'domcontentloaded',timeout:120000});
  try{await page.waitForFunction(()=>window.__mufu?.city?.active,null,{timeout:120000});}
  catch(e){report.startup=await page.evaluate(()=>({text:document.body.innerText,ready:!!window.__mufu}));report.errors=errors;await page.screenshot({path:'test-results/landmark-startup-failure.png',timeout:120000});throw e;}
  await page.evaluate(()=>{window.__mufu.paused=true;window.__mufu.step(2,.1);});
  report.art=await page.evaluate(()=>window.__mufu.city.stats().art);assert.ok(report.art.architectureReady);
  await page.screenshot({path:'test-results/landmarks-overview.png',timeout:120000});
  report.arrivalStable=await page.evaluate(()=>{
 const m=window.__mufu;m.city.enter('palace');const start=m.camera.position.clone(),q=m.camera.quaternion.clone();
 m.camera.rotation.set(1,2,1);m.city.showPlan();m.step(3,.1);m.city.enter('palace');m.step(8,.1);
 return start.distanceTo(m.camera.position)<.001&&q.angleTo(m.camera.quaternion)<.001;
 });assert.ok(report.arrivalStable,'arrival pose must not inherit orbit rotation or drift');
 report.entries=[];
  const entries=process.env.MUFU_LANDMARK_ENTRIES?.split(',')||['palace','jiming','qixia','yuejiang','zhonghua','zifeng','eye','third','niushou','xiaoling','qinhuai','mendong','zhongshan'];
  for(const id of entries){
    await page.evaluate(id=>{const m=window.__mufu;m.city.enter(id);m.step(4,.5);},id);
    assert.equal(await page.locator('#hud').isVisible(),false);
    const stats=await page.evaluate(()=>window.__mufu.city.stats());assert.ok(stats.triangles<2000000);
    assert.ok(await page.evaluate(()=>window.__mufu.camera.position.toArray().every(Number.isFinite)));
    await page.screenshot({path:`test-results/landmark-${id}.png`,timeout:120000});
    report.entries.push({id,triangles:stats.triangles});console.log('Landmark rendered',id);
  }
  for(const mood of ['sunset','storm','snow']){
    await page.evaluate(mood=>{const m=window.__mufu;m.setWeather(mood);m.step(16,.5);},mood);
    await page.screenshot({path:`test-results/landmark-${mood}.png`,timeout:120000});
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.__mufu.step(2,.1));
  await page.screenshot({path:'test-results/landmark-portrait.png',timeout:120000});
  report.errors=errors;assert.equal(errors.length,0,errors.join('\n'));console.log('Landmark materials, entrances, weather and portrait passed');
}finally{await fs.writeFile('test-results/city-landmark-browser.json',JSON.stringify(report,null,2));await browser.close();}
