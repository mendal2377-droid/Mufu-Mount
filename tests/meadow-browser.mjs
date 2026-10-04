import {chromium} from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const browser=await chromium.launch({headless:true,channel:"chrome",
  args:["--use-angle=swiftshader","--enable-webgl","--ignore-gpu-blocklist"],
  ...(process.env.MUFU_PUBLIC?{proxy:{server:"http://127.0.0.1:7890"}}:{})});
const report={errors:[],views:[]};
try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.route("**/fonts.googleapis.com/**",r=>r.fulfill({contentType:"text/css",body:""}));
  await page.addInitScript(()=>localStorage.setItem("mufu-quality","smooth"));
  page.on("pageerror",e=>report.errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error"&&!/fonts.googleapis|ERR_CERT/.test(m.text()))report.errors.push(m.text());});
  await page.goto(process.env.MUFU_TEST_URL||"http://127.0.0.1:4183",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.__mufu?.state.ready,null,{timeout:120000,polling:100});
  await page.evaluate(()=>{const app=window.__mufu;app.paused=true;app.goTo(3,false);app.step(8,.5);});
  async function capture(label){
    await page.evaluate(()=>{const app=window.__mufu;app.setQuality("balanced");app.step(1,.1);
      app.postfx.grade.uniforms.uFade.value=0;app.postfx.render();});
    const stats=await page.evaluate(()=>window.__mufu.getStats());
    assert.equal(report.errors.length,0,report.errors.join("\n"));
    assert.ok(stats.meadow.atlas>=1024);assert.ok(stats.meadow.flowers>0);
    assert.ok(stats.meadow.flowers<=700&&stats.meadow.grass<=2000);
    await page.screenshot({path:`test-results/meadow-${label}.png`,timeout:90000});
    report.views.push({label,meadow:stats.meadow});console.log(label,stats.meadow);
  }
  await capture("riverbank");assert.ok(report.views.at(-1).meadow.bank>0);
  await page.evaluate(()=>{const app=window.__mufu;app.setQuality("smooth");app.camera.rotation.y-=.65;app.step(6,.5);});
  await capture("bank-side");
  await page.evaluate(()=>{const app=window.__mufu;app.setQuality("smooth");app.goTo(4,false);app.step(8,.5);});
  await capture("lower-woodland");
  await page.evaluate(()=>{const app=window.__mufu;app.setQuality("smooth");app.setWeather("storm");app.step(12,.5);});
  await capture("storm");
  await page.evaluate(()=>{const app=window.__mufu;app.setQuality("smooth");app.setWeather("snow");app.step(12,.5);});
  await capture("snow");
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{const app=window.__mufu;app.setQuality("smooth");app.setWeather("morning");app.goTo(3,false);app.step(12,.5);});
  await capture("portrait");
  await page.evaluate(()=>{const app=window.__mufu;app.showPlan();app.step(1,.5);});
  assert.equal(await page.evaluate(()=>window.__mufu.getStats().meadow.flowers),0);
  assert.equal(await page.evaluate(()=>window.__mufu.getStats().meadow.grass),0);
  assert.equal(report.errors.length,0,report.errors.join("\n"));
  console.log("Meadow browser check passed");
}finally{
  await fs.writeFile("test-results/meadow-browser.json",JSON.stringify(report,null,2));await browser.close();
}
