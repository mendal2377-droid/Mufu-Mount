import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const browser = await chromium.launch({ headless: true, channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const errors = [];
const report = { entrances: [], mobileEntrances: [], errors };
await fs.mkdir("test-results", { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  // Use the app's local font fallbacks so network font loading cannot block
  // screenshot capture or make interaction checks depend on Google Fonts.
  await page.route("**/fonts.googleapis.com/**", route => route.fulfill({contentType:"text/css",body:""}));
  await page.addInitScript(() => localStorage.setItem("mufu-quality", "smooth"));
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if(m.type() === "error" && !/fonts.googleapis|ERR_CERT|pointer lock|PointerLock/i.test(m.text())) errors.push(m.text()); });
  await page.goto(process.env.MUFU_TEST_URL || "http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__mufu?.state.ready, null, { timeout: 120000 });
  console.log("Landscape loaded");
  await page.evaluate(() => window.__mufu.step(16, .1));
  const initial = await page.evaluate(() => window.__mufu.getStats());
  assert.equal(initial.overview, true);
  assert.equal(initial.playing, false);
  assert.equal(await page.locator(".access-pin:visible").count(), 6);
  assert.equal(await page.locator("#welcome").isVisible(), false);
  assert.equal(await page.locator("#hud").isVisible(), false);
  assert.equal(await page.locator("#enter").isVisible(), false);
  await page.screenshot({ path: "test-results/plan-desktop.png", timeout: 60000 });

  const pinBefore = await page.locator("#access-0").boundingBox();
  await page.mouse.move(700, 230);
  await page.mouse.down();
  await page.mouse.move(825, 260, { steps: 8 });
  await page.mouse.up();
  await page.evaluate(() => window.__mufu.step(12, .1));
  const rotated = await page.evaluate(() => window.__mufu.camera.position.toArray());
  assert.ok(rotated.some((v,i) => Math.abs(v - initial.position[i]) > 10), "Drag did not orbit the plan");
  const pinAfter = await page.locator("#access-0").boundingBox();
  assert.ok(Math.abs(pinAfter.x-pinBefore.x)+Math.abs(pinAfter.y-pinBefore.y) > 5, "Pin did not follow the orbit");
  await page.mouse.wheel(0,-240);
  await page.evaluate(() => window.__mufu.step(4,.1));
  const zoomed = await page.evaluate(() => window.__mufu.camera.position.toArray());
  assert.ok(zoomed.some((v,i) => Math.abs(v-rotated[i]) > 10), "Scroll did not zoom");
  await page.locator("#plan-reset").click();
  await page.locator("#plan-weather").click();
  assert.equal(await page.evaluate(() => window.__mufu.state.weather), "sunset");

  for (let i=0;i<6;i++) {
    await page.locator(`#plan-destinations button`).nth(i).click();
    await page.evaluate(() => document.exitPointerLock());
    const stats = await page.evaluate(() => window.__mufu.getStats());
    assert.equal(stats.playing,true);
    assert.equal(stats.overview,false);
    assert.equal(stats.place,i<5?i:3);
    assert.equal(stats.weather,"sunset", "The plan's weather did not carry into the walk");
    assert.equal(await page.locator("#plan-home").isVisible(),false);
    assert.equal(await page.locator("#memory-strip .memory-chip").count(),20);
    const before = stats.distance;
    await page.keyboard.down("w");
    await page.evaluate(() => window.__mufu.step(6,.1));
    await page.keyboard.up("w");
    const travelled = await page.evaluate(() => window.__mufu.state.distance);
    assert.ok(travelled > before + .3, `Entrance ${i} did not start on a walkable path`);
    report.entrances.push({index:i, name: await page.locator("#place-title").textContent(),route:stats.route,walkingMetres:travelled-before});
    if(i===0) await page.screenshot({path:"test-results/plan-entered-walk.png",timeout:60000});
    await page.locator("#walk-menu").click(); await page.locator("#menu-map").click();
  }
  console.log("All six desktop entrances walk correctly");
  await page.locator("#access-0").focus();
  await page.keyboard.press("Enter");
  await page.evaluate(() => document.exitPointerLock());
  assert.equal(await page.evaluate(() => window.__mufu.state.playing),true);
  await page.locator("#walk-menu").click(); await page.locator("#tour-button").click();
  await page.evaluate(() => window.__mufu.step(8,.1));
  assert.equal(await page.evaluate(() => window.__mufu.state.tour),true);
  await page.locator("#walk-menu").click(); await page.locator("#menu-map").click();
  assert.equal(await page.evaluate(() => window.__mufu.state.tour),false);

  await page.setViewportSize({width:390,height:844});
  await page.evaluate(() => window.__mufu.step(3,.1));
  await page.screenshot({path:"test-results/plan-mobile.png",timeout:60000});
  for(let i=0;i<6;i++) {
    await page.locator("#plan-entrances summary").click();
    await page.locator("#mobile-destinations button").nth(i).click();
    await page.evaluate(() => document.exitPointerLock());
    assert.equal(await page.evaluate(() => window.__mufu.state.place),i<5?i:3);
    report.mobileEntrances.push(i);
    await page.locator("#walk-menu").click(); await page.locator("#menu-map").click();
  }
  report.orbit=true; report.zoom=true; report.keyboardEntry=true; report.weatherPersists=true;
  assert.equal(errors.length,0,errors.join("\n"));
  console.log("Mobile entrances, keyboard entry and tour return passed");
} finally {
  await fs.writeFile("test-results/plan-browser.json",JSON.stringify(report,null,2));
  await browser.close();
}
