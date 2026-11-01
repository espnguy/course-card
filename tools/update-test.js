// End-to-end test of the offline/update behaviour, service worker ENABLED.
// Serves a temp copy of the site from its own server so it can (1) change the
// card mid-test, as a deploy would, and (2) kill the server to mimic no signal.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = process.env.CC_ROOT || path.join(__dirname, '..');  // CC_ROOT: test another copy
const FILES = ['index.html', 'sw.js', 'manifest.webmanifest',
               'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
const TYPES = { '.html': 'text/html', '.js': 'application/javascript',
                '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const PORT = 8127;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-update-'));
FILES.forEach((f) => {
  fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
  fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
});

let server;
const start = () => new Promise((ok) => {
  server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(dir, p);
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  }).listen(PORT, ok);
});
const stop = () => new Promise((ok) => { server.close(ok); server.closeAllConnections(); });

let failures = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const sub = (page) => page.evaluate(() => document.querySelector('.head .sub').textContent.trim());

(async () => {
  await start();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 870, height: 669 } });
  const page = await ctx.newPage();
  let loads = 0;
  page.on('load', () => loads++);

  console.log('\n1. First visit installs the worker and caches the card');
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 })
    .catch(() => {});
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload(); // first load may finish before clients.claim()
  }
  check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'page is controlled by the service worker');
  const before = await sub(page);
  check(before === 'Quick Reference', `card shows "${before}"`);

  console.log('\n2. Nothing changed: resuming the app does not reload it');
  loads = 0;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(2000);
  check(loads === 0, `no reload when the card is unchanged (loads: ${loads})`);

  console.log('\n3. A deploy changes the card; resuming the app picks it up');
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  fs.writeFileSync(path.join(dir, 'index.html'), html.replace('Quick Reference', 'Updated Card'));
  loads = 0;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() => document.querySelector('.head .sub').textContent.includes('Updated'),
    null, { timeout: 10000 }).catch(() => {});
  check((await sub(page)) === 'Updated Card', `card now shows "${await sub(page)}"`);
  check(loads === 1, `exactly one reload (loads: ${loads})`);
  await page.waitForTimeout(2000);
  check(loads === 1, `no reload loop afterwards (loads: ${loads})`);

  console.log('\n4. No signal: server is gone');
  await stop();
  loads = 0;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(2000);
  check(loads === 0, `resume with no signal does nothing (loads: ${loads})`);

  const cold = await ctx.newPage();
  const t0 = Date.now();
  await cold.goto(`http://localhost:${PORT}/`);
  const ms = Date.now() - t0;
  check((await sub(cold)) === 'Updated Card', `cold start offline shows the latest card ("${await sub(cold)}")`);
  check(ms < 1500, `cold start offline is instant (${ms} ms)`);
  const tabs = await cold.evaluate(() => [...document.querySelectorAll('.tab')].map((t) => t.textContent).join(' '));
  check(tabs === 'Yards Lies Chips Grain Sand', `all tabs present offline (${tabs})`);

  await browser.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${failures ? 'FAIL' : 'PASS'}: update flow (${failures} failure${failures === 1 ? '' : 's'})\n`);
  process.exit(failures ? 1 : 0);
})();
