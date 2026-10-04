import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const browser=await chromium.launch({headless:true,channel:"chrome",args:["--use-angle=swiftshader","--enable-webgl","--ignore-gpu-blocklist"],
  ...(process.env.MUFU_PUBLIC?{proxy:{server:"http://127.0.0.1:7890"}}:{})});
const report={errors:[],views:[]};
try {
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.route("**/fonts.googleapis.com/**",r=>r.fulfill({contentType:"text/css",body:""}));
  await page.addInitScript(()=>localStorage.setItem("mufu-quality","balanced"));
  page.on("pageerror",e=>report.errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error"&&!/fonts.googleapis|ERR_CERT/.test(m.text()))report.errors.push(m.text());});
  await page.goto(process.env.MUFU_TEST_URL||"http://127.0.0.1:4182",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.__mufu?.state.ready,null,{timeout:120000,polling:100});
  await page.evaluate(()=>{window.__mufu.paused=true;window.__mufu.goTo(0,false);window.__mufu.step(2,.5);});
  async function capture(label) {
    // Capture the scenery without the entry fade. Hold animation and render
    // the grade once, avoiding a large queue of redundant software-GPU frames.
    await page.evaluate(()=>{window.__mufu.postfx.grade.uniforms.uFade.value=0;window.__mufu.postfx.render();});
    const stats=await page.evaluate(()=>window.__mufu.getStats());
    assert.equal(report.errors.length,0,report.errors.join("\n"));
    assert.equal(stats.vegetation.volumetric,true);assert.ok(stats.vegetation.atlas>=1024);
    assert.ok(stats.vegetation.near>0&&stats.vegetation.near<=160);
    assert.ok(stats.vegetation.middle<=900);
    await page.screenshot({path:`test-results/forest-${label}.png`,timeout:90000});
    report.views.push({label,vegetation:stats.vegetation,ferns:stats.ferns});console.log("Forest",label,stats.vegetation);
  }
  await capture("rainbow");
  await page.evaluate(()=>{
    const app=window.__mufu;app.goTo(4,false);
    const points=app.routes[1].points,i=Math.floor(points.length*.45);
    app.camera.position.fromArray(points[i]);app.camera.position.y+=1.7;
    const target=app.camera.position.clone().fromArray(points[i+4]);target.y+=1.7;
    app.camera.lookAt(target);app.step(2,.5);document.querySelector("#toast").classList.remove("show");
  });
  await capture("woodland");
  assert.ok(report.views.at(-1).vegetation.pines>0);
  assert.ok(report.views.at(-1).ferns>0);
  await page.evaluate(()=>{window.__mufu.camera.rotation.y+=.8;window.__mufu.step(2,.5);});
  await capture("side");
  await page.evaluate(()=>{const app=window.__mufu;app.setQuality("smooth");app.setWeather("sunset");app.step(12,.5);app.setQuality("balanced");app.step(1,.1);document.querySelector("#toast").classList.remove("show");});
  await capture("sunset");
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{const app=window.__mufu;app.setQuality("smooth");app.setWeather("morning");app.step(12,.5);app.setQuality("balanced");app.step(1,.1);});
  await capture("portrait");
  console.log("Forest browser check passed");
} finally {
  await fs.writeFile("test-results/forest-browser.json",JSON.stringify(report,null,2));await browser.close();
}
