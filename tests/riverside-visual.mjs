import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const browser=await chromium.launch({headless:true,channel:"chrome",
  args:["--use-angle=swiftshader","--enable-webgl","--ignore-gpu-blocklist"],
  ...(process.env.MUFU_PUBLIC?{proxy:{server:"http://127.0.0.1:7890"}}:{})});
const report={errors:[],moods:[]};
await fs.mkdir("test-results",{recursive:true});
try {
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.route("**/fonts.googleapis.com/**",r=>r.fulfill({contentType:"text/css",body:""}));
  await page.addInitScript(()=>localStorage.setItem("mufu-quality","balanced"));
  page.on("pageerror",e=>report.errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error"&&!/fonts.googleapis|ERR_CERT/.test(m.text()))report.errors.push(m.text());});
  await page.goto(process.env.MUFU_TEST_URL||"http://127.0.0.1:4182",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.__mufu?.state.ready,null,{timeout:120000,polling:100});
  await page.evaluate(()=>{window.__mufu.paused=true;window.__mufu.step(12,.5);});
  await page.screenshot({path:"test-results/riverside-plan.png",timeout:90000});
  await page.evaluate(()=>window.__mufu.goTo(3,false));
  console.log("Riverside ready");
  for(const mood of ["morning","sunset","storm","snow"]) {
    await page.evaluate(m=>{
      window.__mufu.setWeather(m);window.__mufu.step(12,.5);
      document.querySelector("#toast").classList.remove("show");
    },mood);
    assert.equal(await page.locator("#walk-weather").inputValue(),mood);
    const stats=await page.evaluate(()=>window.__mufu.getStats());
    assert.equal(report.errors.length,0,report.errors.join("\n"));
    assert.equal(stats.river.waveBands,12);
    assert.equal(stats.river.foamLace,true);
    await page.screenshot({path:`test-results/riverside-${mood}.png`,timeout:90000});
    report.moods.push(mood);console.log("Rendered",mood);
  }
  await page.evaluate(()=>{window.__mufu.goTo(3,false);window.__mufu.setWeather("morning");window.__mufu.step(12,.5);});
  await page.locator("#walk-menu").click();await page.locator("#river-watch").click();
  await page.evaluate(()=>{window.__mufu.camera.rotation.x-=.14;window.__mufu.step(2,.1);document.querySelector("#toast").classList.remove("show");});
  const before=await page.evaluate(()=>window.__mufu.getStats().river);
  await page.screenshot({path:"test-results/riverside-water.png",timeout:90000});
  await page.evaluate(()=>window.__mufu.step(8,.5));
  const after=await page.evaluate(()=>window.__mufu.getStats().river);
  assert.ok(after.riverTime>before.riverTime+3);
  assert.ok(after.ships.every((p,i)=>Math.hypot(p[0]-before.ships[i][0],p[2]-before.ships[i][2])>2));
  assert.notEqual(after.beaconRotation,before.beaconRotation);
  await page.screenshot({path:"test-results/riverside-water-moving.png",timeout:90000});
  await page.evaluate(()=>{window.__mufu.setWeather("storm");window.__mufu.step(12,.5);});
  await page.screenshot({path:"test-results/riverside-water-storm.png",timeout:90000});
  await page.evaluate(()=>{window.__mufu.setWeather("morning");window.__mufu.step(12,.5);});
  await page.evaluate(()=>{window.__mufu.goTo(1,false);window.__mufu.step(2,.5);});
  await page.screenshot({path:"test-results/riverside-forest.png",timeout:90000});
  // The reference's richer surface must compile on both water meshes, the
  // foliage instancing path, and the weather variants, not just pass a build.
  assert.equal(report.errors.length,0,report.errors.join("\n"));
  report.shipsMoved=true;report.beaconRotated=true;console.log("Riverside visual check passed");
} finally {
  await fs.writeFile("test-results/riverside-visual.json",JSON.stringify(report,null,2));
  await browser.close();
}
