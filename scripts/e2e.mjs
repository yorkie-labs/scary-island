// Headless playtest driver: opens the game in a separate headless Chrome,
// runs a scenario script (a JS file evaluated in the page) and saves
// screenshots. Usage: node scripts/e2e.mjs <scenario.js> [outDir] [saveJson]
import puppeteer from 'puppeteer-core';
import { readFileSync, mkdirSync } from 'node:fs';

const [scenarioPath, outDir = '/tmp', savePath] = process.argv.slice(2);
const url = process.env.GAME_URL ?? 'http://localhost:5179/';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  protocolTimeout: 900000,
  args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--window-size=1100,800', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1100, height: 800 },
});
const page = await browser.newPage();
const logs = [];
await page.setRequestInterception(true);
page.on('request', (r) => (/fonts\.(googleapis|gstatic)\.com/.test(r.url()) ? r.abort() : r.continue()));
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
mkdirSync(outDir, { recursive: true });
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.evaluate((save) => { localStorage.clear(); if (save) localStorage.setItem('scary-island-save-v1', save); }, savePath ? readFileSync(savePath, 'utf8') : null);
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
try {
  await page.waitForFunction(() => window.G && document.getElementById('loading-text').textContent === '', { timeout: 90000 });
} catch (e) {
  console.log('LOAD FAILED:', await page.evaluate(() => document.getElementById('loading-text')?.textContent), '\n' + logs.join('\n'));
  await browser.close();
  process.exit(1);
}
await page.exposeFunction('shot', async (name) => { await page.screenshot({ path: `${outDir}/${name}.png` }); return `${outDir}/${name}.png`; });
const lib = readFileSync(new URL('./scenarios/_lib.js', import.meta.url), 'utf8');
const result = await page.evaluate(`(async () => { ${lib}\ntry {\n${readFileSync(scenarioPath, 'utf8')}\n} catch (e) { log.push(['ERROR', e.message, e.stack?.split('\\n')[1]]); return log; } })()`);
console.log(JSON.stringify(result, null, 1));
if (logs.length) console.log('CONSOLE:\n' + [...new Set(logs)].slice(0, 30).join('\n'));
await browser.close();
