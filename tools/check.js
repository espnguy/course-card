/* Layout rules for the fold work. Run against the live local server.
 *
 *   A  no sideways scroll                      (every size)
 *   B  two panes side by side                  (fold sizes, 600-1000px)
 *   C  tap targets >= 44px                     (fold sizes)
 *   D  nothing hidden under the sticky rail    (fold sizes)
 *   E  left/right safe-area insets respected   (fold sizes)
 *   F  no accidental visual drift: every size    (all sizes)
 *      pixel-identical to the approved shots/golden/
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { SIZES, TABS, BASE } = require('./sizes');

const FOLD_MIN = 600, FOLD_MAX = 1000, MIN_TAP = 44;
const results = [];
const rec = (size, tab, rule, pass, detail) =>
  results.push({ size, tab, rule, pass, detail });

(async () => {
  const browser = await chromium.launch();

  for (const s of SIZES) {
    const isFold = s.w >= FOLD_MIN && s.w <= FOLD_MAX;
    const isControl = !s.duo;
    const ctx = await browser.newContext({
      viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1
    });
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
      await page.waitForTimeout(100);

      // ---- A: no sideways scroll -------------------------------------
      const ov = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth
      }));
      rec(s.name, tab, 'A no-x-scroll', ov.sw <= ov.cw, `scrollW ${ov.sw} vs clientW ${ov.cw}`);

      // ---- C: tap targets (every size, not just the fold) -------------
      {
        const small = await page.evaluate((min) => {
          const out = [];
          document.querySelectorAll('.tab').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.height < min || r.width < min) {
              out.push(`${el.textContent.trim()} ${Math.round(r.width)}x${Math.round(r.height)}`);
            }
          });
          return out;
        }, MIN_TAP);
        rec(s.name, tab, 'C tap>=44', small.length === 0,
          small.length ? `under 44px: ${small.join(', ')}` : 'all >= 44px');
      }

      if (isFold) {
        // ---- B: two panes side by side -------------------------------
        const panes = await page.evaluate(() => {
          const rail = document.querySelector('.tabs');
          const panel = document.querySelector('.panel.active');
          if (!rail || !panel) return null;
          const r = rail.getBoundingClientRect(), p = panel.getBoundingClientRect();
          return {
            railRight: Math.round(r.right), panelLeft: Math.round(p.left),
            railTop: Math.round(r.top), railBottom: Math.round(r.bottom),
            panelTop: Math.round(p.top), panelBottom: Math.round(p.bottom)
          };
        });
        const sideBySide = panes &&
          panes.railRight <= panes.panelLeft + 1 &&
          Math.min(panes.railBottom, panes.panelBottom) > Math.max(panes.railTop, panes.panelTop);
        rec(s.name, tab, 'B two-panes', !!sideBySide,
          panes ? `rail.right ${panes.railRight} / panel.left ${panes.panelLeft}` : 'missing nodes');

        // ---- D: nothing hidden under the sticky rail -----------------
        const covered = await page.evaluate(() => {
          const rail = document.querySelector('.tabs');
          if (!rail) return 'no rail';
          const pos = getComputedStyle(rail).position;
          if (pos !== 'sticky' && pos !== 'fixed') return null; // nothing to overlap
          const r = rail.getBoundingClientRect();
          const panel = document.querySelector('.panel.active');
          const first = panel && panel.firstElementChild;
          if (!first) return 'no content';
          const f = first.getBoundingClientRect();
          const overlapsX = f.left < r.right && f.right > r.left;
          const overlapsY = f.top < r.bottom && f.bottom > r.top;
          return (overlapsX && overlapsY) ? `content overlaps rail` : null;
        });
        rec(s.name, tab, 'D no-overlap', covered === null, covered || 'clear');

        // ---- E: safe-area insets -------------------------------------
        if (tab === TABS[0]) {
          const safe = await page.evaluate(() => {
            const el = document.querySelector('.shell') || document.body;
            const base = parseFloat(getComputedStyle(el).paddingLeft);
            const baseR = parseFloat(getComputedStyle(el).paddingRight);
            document.documentElement.style.setProperty('--sai-l', '40px');
            document.documentElement.style.setProperty('--sai-r', '40px');
            const after = parseFloat(getComputedStyle(el).paddingLeft);
            const afterR = parseFloat(getComputedStyle(el).paddingRight);
            document.documentElement.style.removeProperty('--sai-l');
            document.documentElement.style.removeProperty('--sai-r');
            return { base, after, baseR, afterR };
          });
          const ok = safe.after >= safe.base + 39 && safe.afterR >= safe.baseR + 39;
          rec(s.name, tab, 'E safe-area', ok,
            `padL ${safe.base}->${safe.after}, padR ${safe.baseR}->${safe.afterR}`);
        }
      }

      // ---- F: control sizes must be pixel-identical --------------------
      {
        const golden = path.join(__dirname, '..', 'shots', 'golden', `${s.name}__${tab}.png`);
        if (fs.existsSync(golden)) {
          const shot = await page.screenshot();
          const same = Buffer.compare(shot, fs.readFileSync(golden)) === 0;
          rec(s.name, tab, 'F no-drift', same, same ? 'matches golden' : 'DIFFERS from golden');
        }
      }
    }
    await ctx.close();
  }

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  const byRule = {};
  results.forEach((r) => {
    byRule[r.rule] = byRule[r.rule] || { pass: 0, fail: 0 };
    r.pass ? byRule[r.rule].pass++ : byRule[r.rule].fail++;
  });

  console.log('\n RULE              PASS  FAIL');
  console.log(' ----------------- ----  ----');
  Object.keys(byRule).sort().forEach((k) => {
    console.log(` ${k.padEnd(17)} ${String(byRule[k].pass).padStart(4)}  ${String(byRule[k].fail).padStart(4)}`);
  });

  if (failed.length) {
    console.log(`\n FAILURES (${failed.length}):`);
    const seen = new Set();
    failed.forEach((f) => {
      const key = `${f.size}|${f.rule}|${f.detail}`;
      if (seen.has(key)) return;
      seen.add(key);
      console.log(`  [${f.rule}] ${f.size} (${f.tab}) -> ${f.detail}`);
    });
  }
  console.log(`\n${failed.length ? 'FAIL' : 'PASS'}: ${results.length - failed.length}/${results.length} checks passed\n`);
  process.exit(failed.length ? 1 : 0);
})();
