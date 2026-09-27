// Drives a real browser through the memory layer: the frames appear, a photo
// loads and opens as you reach it, the guided morning walk advances, and the
// light moves from first light towards mid-morning while it does.
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(process.env.MUFU_TEST_URL || "http://127.0.0.1:4173", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForFunction(() => window.__mufu?.state.ready, null, {
    timeout: 120000,
  });
  await page.evaluate(() => {
    localStorage.removeItem("mufu-memories");
    window.__mufu.memories.reset();
  });
  await page.click("#enter");
  await page.evaluate(() => document.exitPointerLock());

  const strip = await page.$$eval("#memory-strip .memory-chip", (els) =>
    els.map((e) => e.dataset.memory),
  );

  // Stand in front of one frame and let it resolve.
  await page.evaluate(() => {
    const mufu = window.__mufu;
    const item = mufu.memories.items.find((i) => i.record.id === "094");
    const [x, y, z] = item.record.position;
    const [ax, az] = item.record.along;
    mufu.state.route = item.record.route;
    mufu.camera.position.set(x - ax * 8, y + 1.9, z - az * 8);
    mufu.camera.lookAt(x, y + 2.3, z);
  });
  await page.waitForFunction(
    () => window.__mufu.memories.getStats().active === "094",
    null,
    { timeout: 60000 },
  );
  await page.waitForFunction(
    () => window.__mufu.memories.items.find((i) => i.record.id === "094").loaded,
    null,
    { timeout: 60000 },
  );
  const opened = await page.evaluate(() => ({
    card: document.querySelector("#memory-card").classList.contains("show"),
    time: document.querySelector("#memory-time").textContent,
    zh: document.querySelector("#memory-zh").textContent,
    found: window.__mufu.memories.getStats().found,
  }));
  await page.screenshot({
    path: "test-results/memory-frame.png",
    timeout: 90000,
  });

  // Now let the guided morning walk run and watch the clock move with it.
  await page.click("#memory-walk");
  const startWeather = await page.evaluate(() => ({ ...window.__mufu.weather }));
  await page.waitForFunction(
    () => window.__mufu.state.distance > 12,
    null,
    { timeout: 120000 },
  );
  const walking = await page.evaluate(() => ({
    memoryWalk: window.__mufu.state.memoryWalk,
    weather: { ...window.__mufu.weather },
    distance: window.__mufu.state.distance,
    found: window.__mufu.memories.getStats().found,
  }));
  await page.screenshot({
    path: "test-results/memory-walk.png",
    timeout: 90000,
  });

  const report = {
    url: page.url(),
    errors,
    stripCount: strip.length,
    stripOrder: strip.slice(0, 5),
    opened,
    startedAtFirstLight: startWeather.dawn > 0 || walking.weather.dawn > 0,
    walking,
    stats: await page.evaluate(() => window.__mufu.getStats()),
  };
  await fs.mkdir("test-results", { recursive: true });
  await fs.writeFile(
    "test-results/memory-browser.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));

  const failures = [];
  if (errors.length) failures.push(`console errors: ${errors.join(" | ")}`);
  if (strip.length !== 20) failures.push(`strip has ${strip.length} frames`);
  if (!opened.card) failures.push("memory card did not open");
  if (opened.time !== "07:13") failures.push(`wrong time shown: ${opened.time}`);
  if (!opened.found) failures.push("opening a frame did not record it");
  if (!walking.memoryWalk) failures.push("memory walk stopped early");
  if (failures.length) {
    console.error("FAILED:\n - " + failures.join("\n - "));
    process.exitCode = 1;
  } else {
    console.log("memory-browser: OK");
  }
} finally {
  await browser.close();
}
