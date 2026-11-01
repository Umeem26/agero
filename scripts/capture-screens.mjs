#!/usr/bin/env node
// Full-page screenshots of the live app without a wallet, for the README (docs/screenshots/).
//
//   node scripts/capture-screens.mjs [--base https://agero.vercel.app] [--out screenshots-out]
//
// Pages: home, marketplace, one Sample agent's detail, the "Uji 3b" detail, Agent dashboard without a
// wallet; each at 1440x900 and 375x812, device scale factor 2, PNG. Nothing is mocked and the DOM is
// not changed: the script only navigates and clicks like a visitor. It waits until the contract reads
// have filled the page and exits 1 if an RPC error is shown or a loading skeleton never goes away.
//
// Playwright is not a dependency of this repo. The script uses `playwright` if it can be resolved
// (PLAYWRIGHT_MODULE=<path to .../node_modules/playwright>, or a local install), otherwise the copy
// in the npx cache (`npx playwright@1.64.1 ...` puts it there) with its installed Chromium.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const VIEWPORTS = [
  { width: 1440, height: 900, isMobile: false },
  { width: 375, height: 812, isMobile: true },
];
const READY_TIMEOUT_MS = 60_000;
const RPC_ERROR = /Could not read from Stellar Testnet|Configuration error/;

class CaptureError extends Error {}

function findPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [process.env.PLAYWRIGHT_MODULE].filter(Boolean);
  try { candidates.push(require.resolve('playwright')); } catch { /* not installed locally */ }
  const npxRoot = join(process.env.LOCALAPPDATA || join(process.env.HOME || '', '.npm'), 'npm-cache', '_npx');
  const altRoot = join(process.env.HOME || '', '.npm', '_npx');
  for (const root of [npxRoot, altRoot]) {
    if (!existsSync(root)) continue;
    for (const dir of readdirSync(root)) {
      const p = join(root, dir, 'node_modules', 'playwright');
      if (existsSync(join(p, 'package.json'))) candidates.push(p);
    }
  }
  for (const c of candidates) {
    try { return require.resolve(c); } catch { /* try the next one */ }
  }
  return null;
}

// CHROMIUM_PATH, else the newest Chromium already installed by any Playwright version
function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = join(process.env.LOCALAPPDATA || join(process.env.HOME || '', '.cache'), 'ms-playwright');
  if (!existsSync(root)) return null;
  const dirs = readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const d of dirs) {
    for (const sub of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome', 'chrome-linux64/chrome']) {
      if (existsSync(join(root, d, sub))) return join(root, d, sub);
    }
  }
  return null;
}

async function launch(chromium) {
  try {
    return { browser: await chromium.launch(), executable: 'bundled' };
  } catch (err) {
    const executablePath = findChromium();
    if (!/Executable doesn't exist/.test(String(err?.message)) || !executablePath) throw err;
    return { browser: await chromium.launch({ executablePath }), executable: executablePath };
  }
}

// Poll the page until `ready` holds; fail at once on an RPC error, and after the timeout otherwise
async function waitReady(page, label, ready) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    const state = await page.evaluate((errorSource) => {
      const errorRe = new RegExp(errorSource);
      const alerts = [...document.querySelectorAll('[role="alert"]')].map((e) => e.textContent || '');
      const loading = document.querySelectorAll('.skeleton-card, [aria-busy="true"]').length;
      return { error: alerts.find((t) => errorRe.test(t)) || null, loading };
    }, RPC_ERROR.source);
    state.ok = Boolean(await page.evaluate(ready));
    if (state.error) throw new CaptureError(`${label}: RPC error banner shown: ${state.error.slice(0, 160)}`);
    if (state.ok && state.loading === 0) return;
    if (Date.now() > deadline) {
      throw new CaptureError(`${label}: not ready after ${READY_TIMEOUT_MS / 1000} s (${state.loading} loading placeholder(s) still visible)`);
    }
    await page.waitForTimeout(250);
  }
}

async function openNav(page, label, isMobile) {
  if (isMobile) await page.locator('.nav-menu-btn').click();
  await page.locator('#nav-links .nav-link', { hasText: label }).first().click();
}

const SHOTS = [
  {
    name: 'home',
    async go() {},
    ready: () => /Read from Stellar Testnet on page load/.test(document.querySelector('.pulse-note')?.textContent || '')
      && document.querySelectorAll('.agent-card').length > 0,
  },
  {
    name: 'marketplace',
    go: (page, vp) => openNav(page, 'Marketplace', vp.isMobile),
    ready: () => document.querySelectorAll('.agent-card').length > 1,
  },
  {
    name: 'agent-detail-sample',
    async go(page, vp, ctx) {
      await openNav(page, 'Marketplace', vp.isMobile);
      await waitReady(page, 'marketplace (for sample detail)', () => document.querySelectorAll('.agent-card').length > 1);
      const card = page.locator('.agent-card', { has: page.locator('.sample-badge') }).first();
      ctx.sampleName = (await card.locator('.card-link').textContent()).trim();
      await card.locator('.card-link').click();
    },
    ready: () => Boolean(document.querySelector('.detail-name')) && Boolean(document.querySelector('.detail-main .sample-badge')),
  },
  {
    name: 'agent-detail-uji-3b',
    async go(page, vp) {
      await openNav(page, 'Marketplace', vp.isMobile);
      await waitReady(page, 'marketplace (for Uji 3b)', () => document.querySelectorAll('.agent-card').length > 1);
      const link = page.locator('.agent-card .card-link').filter({ hasText: /^Uji 3b$/ });
      if ((await link.count()) !== 1) throw new CaptureError('No single agent named "Uji 3b" in the registry');
      await link.click();
    },
    ready: () => (document.querySelector('.detail-name')?.textContent || '').trim() === 'Uji 3b',
  },
  {
    name: 'agent-dashboard-disconnected',
    go: (page, vp) => openNav(page, 'Agent Dashboard', vp.isMobile),
    ready: () => [...document.querySelectorAll('main button')].some((b) => b.textContent.trim() === 'Connect Freighter'),
  },
];

async function main() {
  const { values } = parseArgs({ options: { base: { type: 'string', default: 'https://agero.vercel.app' }, out: { type: 'string', default: 'screenshots-out' } } });
  const base = values.base.replace(/\/+$/, '');
  const outDir = resolve(values.out);
  const entry = findPlaywright();
  if (!entry) {
    console.error('Playwright not found. Run `npx playwright@1.64.1 install chromium` once, or set PLAYWRIGHT_MODULE.');
    return 2;
  }
  const pw = await import(pathToFileURL(entry).href);
  const chromium = pw.chromium ?? pw.default?.chromium;
  mkdirSync(outDir, { recursive: true });

  const { browser, executable } = await launch(chromium);
  const manifest = { base, captured_at: new Date().toISOString(), browser: `${browser.version()} (${executable === 'bundled' ? 'bundled' : 'installed Chromium'})`, ledger: null, ledger_closed: null, sample_agent: null, shots: [] };
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, isMobile: vp.isMobile, hasTouch: vp.isMobile });
      for (const shot of SHOTS) {
        const page = await context.newPage();
        const label = `${shot.name}-${vp.width}`;
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await waitReady(page, `${label} (initial load)`, () => document.querySelectorAll('.agent-card').length > 0);
        const ctx = {};
        await shot.go(page, vp, ctx);
        await waitReady(page, label, shot.ready);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(500);
        if (shot.name === 'home' && vp.width === 1440) {
          const pulse = await page.locator('.pulse').innerText();
          manifest.ledger = pulse.match(/Latest ledger\s*([\d,]+)/)?.[1] ?? null;
          manifest.ledger_closed = pulse.match(/ledger closed ([^)]+)\)/)?.[1] ?? null;
        }
        if (ctx.sampleName) manifest.sample_agent = ctx.sampleName;
        const file = join(outDir, `${label}.png`);
        await page.screenshot({ path: file, fullPage: true, type: 'png' });
        const size = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
        manifest.shots.push({ file: `${label}.png`, css_width: size.w, css_height: size.h, bytes: statSync(file).size });
        console.log(`ok  ${label}.png  ${size.w}x${size.h} css px`);
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`ledger ${manifest.ledger} (closed ${manifest.ledger_closed}); manifest in ${join(values.out, 'manifest.json')}`);
  return 0;
}

main().then(
  (code) => { process.exitCode = code; },
  (err) => {
    console.error(err instanceof CaptureError ? `FAIL ${err.message}` : err);
    process.exitCode = 1;
  },
);
