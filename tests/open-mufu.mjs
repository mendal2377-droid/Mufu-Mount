// Since 22 October the app opens on the Nanjing home page; the Mufu Mountain morning walk is its
// own entrance (city.enter('mufu', {walk: true})). The walk's browser tests open it here and wait
// for the plan's camera to settle, so its entrance pins hold still enough to click.
export async function openMufu(page) {
  await page.waitForFunction(() => window.__mufu?.state.ready && window.__mufu.city, null, { timeout: 180000 });
  await page.evaluate(() => { if (window.__mufu.city.active) window.__mufu.city.enter("mufu", { walk: true }); });
  await page.waitForFunction(() => !window.__mufu.city.active && window.__mufu.state.overview, null, { timeout: 120000 });
  await page.waitForFunction(() => new Promise((resolve) => {
    const at = () => { const b = document.querySelector("#access-0")?.getBoundingClientRect(); return b ? [b.x, b.y] : null; };
    const a = at();
    setTimeout(() => { const b = at(); resolve(!!a && !!b && Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) < 0.5); }, 400);
  }), null, { timeout: 60000, polling: 200 });
}
