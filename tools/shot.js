// Screenshots every tab at every size into shots/<phase>/.
// Also records layout metrics so overflow is measured, not eyeballed.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { SIZES, TABS, BASE } = require('./sizes');

const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw new Error('usage: shot.js before|after');

(async () => {
  const outDir = path.join(__dirname, '..', 'shots', phase);
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const metrics = [];

  for (const s of SIZES) {
    const ctx = await browser.newContext({
      viewport: { width: s.w, height: s.h },
      deviceScaleFactor: 1
    });
    // Keep the service worker out of the test run entirely.
    await ctx.addInitScript(() => {
      try { Object.defineProperty(navigator, 'serviceWorker', { get: () => undefined }); } catch (e) {}
      // Freeze the panel fade so screenshots are deterministic frame-to-frame.
      addEventListener('DOMContentLoaded', () => {
        const st = document.createElement('style');
        st.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
        document.head.appendChild(st);
      });
    });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'load' });

    for (const tab of TABS) {
      await page.evaluate((t) => {
        document.querySelectorAll('.tab').forEach((el) => {
          if (el.dataset.panel === t) el.click();
        });
        window.scrollTo(0, 0);
      }, tab);
      await page.waitForTimeout(120); // let the fade animation settle
      await page.screenshot({ path: path.join(outDir, `${s.name}__${tab}.png`) });

      const m = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
        bodyW: document.body.getBoundingClientRect().width
      }));
      metrics.push({ size: s.name, tab, ...m, overflow: m.scrollW > m.clientW });
    }
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(outDir, '_metrics.json'), JSON.stringify(metrics, null, 2));
  const bad = metrics.filter((m) => m.overflow);
  console.log(`${phase}: ${metrics.length} screenshots -> shots/${phase}/`);
  console.log(`horizontal overflow: ${bad.length}/${metrics.length}`);
  const widths = {};
  metrics.forEach((m) => { widths[m.size] = m.bodyW; });
  console.log('body width by size:', JSON.stringify(widths, null, 2));
})();
