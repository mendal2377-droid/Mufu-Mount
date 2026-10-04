import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser=await chromium.launch({headless:true,channel:"chrome",args:["--use-angle=swiftshader","--enable-webgl","--ignore-gpu-blocklist"],
  ...(process.env.MUFU_PUBLIC ? {proxy:{server:"http://127.0.0.1:7890"}} : {})});
const report={errors:[],entrances:[],flight:{}};
await fs.mkdir("test-results",{recursive:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.route("**/fonts.googleapis.com/**",route=>route.fulfill({contentType:"text/css",body:""}));
  await page.addInitScript(()=>localStorage.setItem("mufu-quality","smooth"));
  page.on("pageerror",e=>report.errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error"&&!/fonts.googleapis|ERR_CERT|pointer lock|PointerLock/i.test(m.text())) report.errors.push(m.text());});
  await page.goto(process.env.MUFU_TEST_URL||"http://127.0.0.1:4182",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.__mufu?.state.ready,null,{timeout:120000,polling:100});
  await page.evaluate(()=>window.__mufu.paused=true);
  console.log("Loaded");
  await page.evaluate(()=>window.__mufu.step(16,.1));
  console.log("Plan render",await page.evaluate(()=>({triangles:window.__mufu.getStats().triangles,drawCalls:window.__mufu.getStats().drawCalls})));
  await page.screenshot({path:"test-results/immersion-plan.png",timeout:60000});
  assert.equal(await page.locator(".pin-leaders").count(),0);
  // Marker icon centre stays exactly at its projected ground anchor.
  async function checkPins() {
    return page.evaluate(()=>Array.from(document.querySelectorAll(".access-pin")).map(button=>{
      const r=button.querySelector(".pin-icon").getBoundingClientRect();
      return Math.hypot(r.x+r.width/2-parseFloat(button.style.left),r.y+r.height/2-parseFloat(button.style.top));
    }));
  }
  assert.ok((await checkPins()).every(d=>d<1));
  await page.mouse.move(650,200);await page.mouse.down();await page.mouse.move(750,240,{steps:3});await page.mouse.up();
  await page.evaluate(()=>window.__mufu.step(3,.1));
  assert.ok((await checkPins()).every(d=>d<1));
  await page.locator("#plan-reset").click();
  console.log("Anchors checked");
  // List access stays available even when world pins overlap at distant zoom.
  for(let i=0;i<6;i++) {
    await page.locator(`#plan-destinations button`).nth(i).click();
    await page.evaluate(()=>document.exitPointerLock());
    assert.equal(await page.evaluate(()=>window.__mufu.state.overview),false);
    for(const selector of [".trail-card",".map-card",".bottom-panel",".memory-rail",".memory-card","header","#resume"]) {
      assert.equal(await page.locator(selector).isVisible(),false,`${selector} still obscures the walk`);
    }
    assert.equal(await page.locator("#walk-environment").isVisible(),true);
    const before=await page.evaluate(()=>window.__mufu.state.distance);
    await page.keyboard.down("w");await page.evaluate(()=>window.__mufu.step(4,.1));await page.keyboard.up("w");
    assert.ok(await page.evaluate(b=>window.__mufu.state.distance>b+.2,before));
    report.entrances.push(i);
    if(i===3) {
      await page.evaluate(()=>window.__mufu.step(6,.1));
      await page.screenshot({path:"test-results/immersion-river.png",timeout:60000});
    }
    await page.locator("#walk-menu").click();await page.locator("#menu-map").click();
  }
  console.log("Six quiet walking entrances checked");
  await page.locator("#plan-destinations button").first().click();
  await page.evaluate(()=>document.exitPointerLock());
  await page.locator("#walk-menu").click();
  await page.locator("#photo-album summary").click();
  assert.equal(await page.locator("#memory-strip .memory-chip").count(),20);
  await page.locator("#tour-button").click();
  await page.evaluate(()=>window.__mufu.step(2,.1));
  assert.equal(await page.evaluate(()=>window.__mufu.state.tour),true);
  await page.locator("#walk-menu").click();await page.locator("#menu-map").click();
  assert.equal(await page.evaluate(()=>window.__mufu.state.tour),false);
  await page.evaluate(()=>{window.__mufu.setWeather("morning");window.__mufu.step(8,.5);});
  await page.locator("#kite-toggle").click();
  assert.equal(await page.evaluate(()=>window.__mufu.state.flying),true);
  const before=await page.evaluate(()=>window.__mufu.camera.position.toArray());
  await page.keyboard.down("w");await page.keyboard.down("e");
  await page.evaluate(()=>window.__mufu.step(10,.1));
  await page.keyboard.up("w");await page.keyboard.up("e");
  const after=await page.evaluate(()=>window.__mufu.camera.position.toArray());
  assert.ok(Math.hypot(after[0]-before[0],after[2]-before[2])>20);
  assert.ok(after[1]>before[1]+15);
  report.flight={before,after};
  await page.evaluate(()=>document.querySelector("#toast").classList.remove("show"));
  await page.screenshot({path:"test-results/immersion-kite.png",timeout:60000});
  await page.keyboard.press("k");
  assert.equal(await page.evaluate(()=>window.__mufu.state.flying),false);
  const land=await page.evaluate(()=>({route:window.__mufu.state.route,position:window.__mufu.camera.position.toArray()}));
  report.flight.landed=land;
  await page.keyboard.press("k");assert.equal(await page.evaluate(()=>window.__mufu.state.flying),true);
  await page.locator("#walk-weather").selectOption("storm");
  await page.evaluate(()=>window.__mufu.step(10,.5));
  assert.equal(await page.evaluate(()=>window.__mufu.state.weather),"storm");
  assert.equal(await page.evaluate(()=>window.__mufu.getStats().river.geometricWaves),true);
  await page.locator("#walk-menu").click();await page.locator("#menu-map").click();
  assert.equal(await page.evaluate(()=>window.__mufu.state.flying),false);
  console.log("Flight, weather and landing checked");
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>window.__mufu.step(2,.1));
  await page.screenshot({path:"test-results/immersion-mobile-plan.png",timeout:60000});
  // Touch input is a separate context: a resized desktop does not emulate it.
  const phone=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await phone.route("**/fonts.googleapis.com/**",route=>route.fulfill({contentType:"text/css",body:""}));
  await phone.addInitScript(()=>localStorage.setItem("mufu-quality","smooth"));
  phone.on("pageerror",e=>report.errors.push(e.message));
  await phone.goto(process.env.MUFU_TEST_URL||"http://127.0.0.1:4182",{waitUntil:"domcontentloaded"});
  await phone.waitForFunction(()=>window.__mufu?.state.ready,null,{timeout:120000,polling:100});
  await phone.evaluate(()=>window.__mufu.paused=true);
  for(let i=0;i<6;i++) {
    await phone.locator("#plan-entrances summary").tap();
    await phone.locator("#mobile-destinations button").nth(i).tap();
    assert.equal(await phone.evaluate(()=>window.__mufu.state.place),i<5?i:3);
    await phone.locator("#walk-menu").tap();await phone.locator("#menu-map").tap();
  }
  await phone.locator("#kite-toggle").tap();
  assert.equal(await phone.locator("#flight-touch").isVisible(),true);
  const touchBefore=await phone.evaluate(()=>window.__mufu.camera.position.y);
  const touchBox=await phone.locator('[data-move="up"]').boundingBox();
  const cdp=await phone.context().newCDPSession(phone);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:touchBox.x+touchBox.width/2,y:touchBox.y+touchBox.height/2}]});
  await phone.evaluate(()=>window.__mufu.step(4,.1));
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  assert.ok(await phone.evaluate(y=>window.__mufu.camera.position.y>y+5,touchBefore));
  await phone.evaluate(()=>window.__mufu.step(14,.1));
  await phone.screenshot({path:"test-results/immersion-mobile-kite.png",timeout:60000});
  await phone.locator("#kite-toggle").tap();
  assert.equal(await phone.evaluate(()=>window.__mufu.state.flying),false);
  report.touch=true;
  assert.equal(report.errors.length,0,report.errors.join("\n"));
  console.log("Touch flight checked; no browser errors");
} finally {
  await fs.writeFile("test-results/immersion-browser.json",JSON.stringify(report,null,2));
  await browser.close();
}
