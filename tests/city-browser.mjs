import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist'],
  ...(process.env.MUFU_PUBLIC?{proxy:{server:'http://127.0.0.1:7890'}}:{})});
const errors=[],report={};await fs.mkdir('test-results',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.addInitScript(()=>localStorage.setItem('mufu-quality','smooth'));
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/fonts|ERR_CERT|PointerLock|pointer lock/i.test(m.text()))errors.push(m.text());});
  await page.goto(process.env.MUFU_TEST_URL||'http://127.0.0.1:4184');
  await page.waitForFunction(()=>window.__mufu?.city?.active,null,{timeout:120000});
  await page.evaluate(()=>{window.__mufu.paused=true;window.__mufu.step(2,.1);});
  assert.equal(await page.locator('.city-pin').count(),20);
  report.geometry=await page.evaluate(()=>window.__mufu.city.stats());console.log('City loaded',report.geometry);
  assert.ok(report.geometry.triangles<2000000);
  assert.equal(report.geometry.terrain.singleSurface,true);
  assert.ok(report.geometry.terrain.terrainTriangles<400000);
  assert.ok(report.geometry.landscape.trees>4000);
  assert.equal(report.geometry.landscape.instanced,true);
  const routeChecks=await page.evaluate(()=>window.__mufu.city.routes.map(route=>({
    finite:route.points.flat().every(Number.isFinite),
    clearance:Math.min(...route.points.map(p=>p[1]-window.__mufu.city.ground(p[0],p[2]))),name:route.name
  })));
  assert.ok(routeChecks.every(r=>r.finite&&r.clearance>-.15),JSON.stringify(routeChecks));
  await page.screenshot({path:'test-results/nanjing-central.png',timeout:60000});
  await page.mouse.move(700,300);await page.mouse.down();await page.mouse.move(770,330,{steps:3});await page.mouse.up();
  await page.evaluate(()=>window.__mufu.step(3,.1));
  const anchors=await page.evaluate(()=>Array.from(document.querySelectorAll('.city-pin:not([hidden])')).map(b=>{
    const r=b.querySelector('.city-dot').getBoundingClientRect();return Math.hypot(r.x+r.width/2-parseFloat(b.style.left),r.y+r.height/2-parseFloat(b.style.top));}));
  assert.ok(anchors.every(d=>d<1));
  for(const id of ['qinhuai','bridge','niushou','zhongshan','gaochun','zijin','qixia','xuanwu']){
    await page.evaluate(id=>{window.__mufu.city.enter(id);window.__mufu.step(2,.1);},id);
    assert.equal(await page.locator('#walk-environment').isVisible(),true);
    assert.equal(await page.locator('#hud').isVisible(),false);
    const before=await page.evaluate(()=>window.__mufu.camera.position.toArray());
    await page.keyboard.down('w');await page.evaluate(()=>window.__mufu.step(5,.1));await page.keyboard.up('w');
    const after=await page.evaluate(()=>window.__mufu.camera.position.toArray());
    assert.ok(Math.hypot(after[0]-before[0],after[2]-before[2])>.1);
    assert.ok(await page.evaluate(()=>window.__mufu.camera.position.y-window.__mufu.city.ground(window.__mufu.camera.position.x,window.__mufu.camera.position.z)>1.65),id+' player terrain clearance');
    assert.ok((await page.evaluate(()=>window.__mufu.city.stats())).triangles<2000000);
    await page.screenshot({path:`test-results/nanjing-${id}.png`,timeout:60000});console.log('Walk checked',id);
  }
  report.walkLandscape=await page.evaluate(()=>window.__mufu.city.stats().landscape);
  assert.ok(report.walkLandscape.visibleGrass>0);
  assert.ok(report.walkLandscape.nearTrees<=660);
  assert.ok(report.walkLandscape.visibleGrass<=1100&&report.walkLandscape.visibleFlowers<=650);
  await page.evaluate(()=>{window.__mufu.city.enter('zijin');window.__mufu.city.toggleFlight();const m=window.__mufu.city.places.find(p=>p.id==='zijin');window.__mufu.camera.position.set(m.position[0]-210,m.position[1]+190,m.position[2]+180);window.__mufu.camera.lookAt(...m.position);window.__mufu.step(2,.1);});
  await page.screenshot({path:'test-results/nanjing-ridge-flight.png',timeout:60000});
  await page.evaluate(()=>window.__mufu.city.toggleFlight());
  await page.keyboard.press('k');const y=await page.evaluate(()=>window.__mufu.camera.position.y);
  await page.keyboard.down('e');await page.evaluate(()=>window.__mufu.step(4,.1));await page.keyboard.up('e');
  assert.ok(await page.evaluate(y=>window.__mufu.camera.position.y>y+5,y));await page.keyboard.press('k');
  assert.equal(await page.evaluate(()=>window.__mufu.state.flying),false);
  await page.locator('#walk-weather').selectOption('snow');await page.evaluate(()=>window.__mufu.step(10,.5));
  assert.ok(await page.evaluate(()=>window.__mufu.weather.snow>.9));
  await page.locator('#walk-menu').click();await page.locator('#city-sound').click();
  await page.waitForFunction(()=>window.__mufu.getStats().audioReady,null,{timeout:20000});
  assert.equal(await page.evaluate(()=>window.__mufu.getStats().audioEnabled),true);
  await page.evaluate(()=>{window.__mufu.setWeather('morning');window.__mufu.step(14,.5);});
  await page.locator('#walk-menu').click();await page.locator('#city-map-return').click();
  await page.locator('#city-scope').selectOption('all');await page.evaluate(()=>window.__mufu.step(2,.1));
  await page.screenshot({path:'test-results/nanjing-municipal.png',timeout:60000});
  await page.evaluate(()=>window.__mufu.city.enter('mufu'));assert.equal(await page.evaluate(()=>window.__mufu.city.active),false);
  assert.equal(await page.locator('.plan-card').isVisible(),true);assert.equal(await page.locator('.access-pin').count(),6);
  await page.locator('#nanjing-return').click();assert.equal(await page.evaluate(()=>window.__mufu.city.active),true);
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.__mufu.step(2,.1));
  await page.locator('#city-list summary').click();await page.locator('#city-destinations button[data-city="qinhuai"]').click();
  assert.equal(await page.evaluate(()=>window.__mufu.city.selected.id),'qinhuai');
  await page.evaluate(()=>window.__mufu.city.showPlan('central'));await page.screenshot({path:'test-results/nanjing-mobile.png',timeout:60000});
  report.errors=errors;assert.equal(errors.length,0,errors.join('\n'));console.log('Map, walking, kite, weather, Mufu portal and mobile checks passed');
}finally{await fs.writeFile('test-results/city-browser.json',JSON.stringify(report,null,2));await browser.close();}
