// Probe: which GL does headless Chrome give us, and how long is one 1080p frame?
import {chromium} from '@playwright/test';
const mode = process.argv[2] || 'gpu';
const args = mode === 'gpu'
  ? ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-webgl']
  : ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({channel: 'chrome', headless: true, args});
const page = await browser.newPage({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({status: 200, contentType: 'text/css', body: ''}));
await page.addInitScript(() => localStorage.setItem('mufu-quality', 'rich'));
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto('http://127.0.0.1:5178', {waitUntil: 'domcontentloaded', timeout: 120000});
await page.waitForFunction(() => window.__mufu?.state?.ready, null, {timeout: 400000});
const info = await page.evaluate(() => {
  const gl = window.__mufu.renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return {renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'n/a', size: [window.__mufu.renderer.domElement.width, window.__mufu.renderer.domElement.height], quality: window.__mufu.state.quality};
});
console.log(JSON.stringify(info));
const t = await page.evaluate(async () => {
  const m = window.__mufu; m.paused = true;
  const t0 = performance.now(); const out = [];
  for (let i = 0; i < 4; i++) { m.step(1, 1 / 24); const s = m.renderer.domElement.toDataURL('image/jpeg', .92); out.push(s.length); }
  return {ms: (performance.now() - t0) / 4, bytes: out};
});
console.log(JSON.stringify(t));
await browser.close();
