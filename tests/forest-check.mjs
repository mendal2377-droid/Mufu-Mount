import { chromium } from "@playwright/test";
const b = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-webgl"],
});
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:4173");
  await p.waitForFunction(() => window.__mufu?.state.ready, null, {
    timeout: 120000,
  });
  await p.click("#enter");
  await p.evaluate(() => document.exitPointerLock());
  await p.click("#overview");
  const frame = await p.evaluate(() => window.__mufu.state.frames);
  await p.waitForFunction((f) => window.__mufu.state.frames > f + 2, frame, {
    timeout: 60000,
  });
  await p.screenshot({ path: "test-results/forest-overview.png" });
  await p.click("#overview");
  await p.screenshot({ path: "test-results/forest-walking.png" });
  console.log(
    JSON.stringify(
      { errors, stats: await p.evaluate(() => window.__mufu.getStats()) },
      null,
      2,
    ),
  );
  if (errors.length) throw Error("Browser errors");
} finally {
  await b.close();
}
