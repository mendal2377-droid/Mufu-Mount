// Drives the hands-free circuit in a real browser: it starts, the camera
// actually travels, the leg caption and progress advance, the sky moves from
// first light towards evening, and any movement key hands control back.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";


const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
  proxy: process.env.MUFU_PROXY
    ? { server: process.env.MUFU_PROXY }
    : undefined,
  args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(process.env.MUFU_TEST_URL || "http://127.0.0.1:4173", {
    waitUntil: "domcontentloaded",
    timeout: 180000,
  });
  await page.waitForFunction(() => window.__mufu?.state.ready, null, {
    timeout: 180000,
  });

  // Home is now an orbitable plan; camera tours begin after choosing a pin.
  const homePlan = await page.evaluate(() => ({
    overview: window.__mufu.state.overview,
    playing: window.__mufu.state.playing,
    entrances: document.querySelectorAll('.access-pin').length,
  }));

  await page.click("#access-0", { timeout: 120000 });
  await page.evaluate(() => document.exitPointerLock());

  await page.evaluate(() => window.__mufu.startTour());
  // Settle onto the rails first: measuring from before the tour began would
  // just measure the jump to the start of leg one, not the glide along it.
  const first = await page.evaluate(() => {
    const mufu = window.__mufu;
    mufu.step(6, 0.1);
    return {
      touring: document.body.classList.contains("touring"),
      label: document.querySelector("#tour-label").textContent,
      weather: mufu.state.weather,
      pos: mufu.camera.position.toArray(),
    };
  });

  // Every stepped frame is a full render, and under SwiftShader that is far
  // too slow to simulate five real minutes. Step a little inside the first
  // leg to prove the camera glides, then jump between legs.
  await page.evaluate(() => window.__mufu.step(120, 0.1)); // ~12 s of leg one
  const later = await page.evaluate(() => ({
    label: document.querySelector("#tour-label").textContent,
    bar: document.querySelector("#tour-bar").style.width,
    pos: window.__mufu.camera.position.toArray(),
    touring: window.__mufu.state.tour,
  }));
  const travelled = Math.hypot(
    later.pos[0] - first.pos[0],
    later.pos[2] - first.pos[2],
  );

  // Every leg in turn: each should name itself and put the camera somewhere.
  const visited = await page.evaluate(() => {
    const mufu = window.__mufu;
    const legs = mufu.circuitLegs();
    const seen = [];
    for (let i = 0; i < legs.length; i++) {
      mufu.cinematic().play(legs, { from: i });
      mufu.step(12, 0.1);
      seen.push({
        label: document.querySelector("#tour-label").textContent,
        pos: mufu.camera.position.toArray().map((v) => Math.round(v)),
        weather: mufu.state.weather,
      });
    }
    return seen;
  });

  // Then run the final leg out: it should end in the evening, back on a route.
  const end = await page.evaluate(() => {
    const mufu = window.__mufu;
    const legs = mufu.circuitLegs();
    mufu.cinematic().play(legs, { from: legs.length - 1 });
    mufu.step(Math.ceil(legs.at(-1).seconds / 0.1) + 8, 0.1);
    return {
      touring: mufu.state.tour,
      weather: mufu.state.weather,
      route: mufu.state.route,
      touringClass: document.body.classList.contains("touring"),
    };
  });

  // And stepping off mid-way must hand control straight back.
  await page.evaluate(() => window.__mufu.startTour());
  await page.evaluate(() => window.__mufu.step(200, 0.05));
  await page.keyboard.press("KeyW");
  const steppedOff = await page.evaluate(() => ({
    touring: window.__mufu.state.tour,
    touringClass: document.body.classList.contains("touring"),
  }));

  const report = {
    url: page.url(),
    errors,
    homePlan,
    first,
    later: { ...later, travelledMetres: Number(travelled.toFixed(1)) },
    visited,
    end,
    steppedOff,
  };
  await fs.mkdir("test-results", { recursive: true });
  await fs.writeFile(
    "test-results/tour-browser.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));

  const failures = [];
  if (errors.length) failures.push(`console errors: ${errors.join(" | ")}`);
  if (!homePlan.overview || homePlan.playing || homePlan.entrances !== 6) failures.push("home does not open on the entrance plan");
  if (!first.touring) failures.push("the circuit did not start");
  if (first.weather !== "dawn") failures.push(`starts at ${first.weather}, not dawn`);
  // Leg one covers about 210 m in 44 s, so twelve seconds is roughly 55 m.
  if (travelled < 25 || travelled > 200) {
    failures.push(`leg one glided ${travelled.toFixed(1)} m in 12 s, which is not a walk`);
  }
  const labels = new Set(visited.map((v) => v.label));
  if (labels.size !== visited.length) failures.push("two legs share a caption");
  if (visited.some((v) => !Number.isFinite(v.pos[0]) || !Number.isFinite(v.pos[1]))) {
    failures.push("a leg put the camera nowhere");
  }
  if (end.touring) failures.push("the circuit never finished");
  if (end.weather !== "sunset") failures.push(`ends at ${end.weather}, not sunset`);
  if (steppedOff.touring || steppedOff.touringClass) {
    failures.push("a movement key did not step off the circuit");
  }
  if (failures.length) {
    console.error("FAILED:\n - " + failures.join("\n - "));
    process.exitCode = 1;
  } else {
    console.log("tour-browser: OK");
  }
} finally {
  await browser.close();
}
