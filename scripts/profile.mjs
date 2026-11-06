// CPU profile of the game loop: where the main thread's time goes while
// Yorkie stands at a spot (uncapped frames). Prints the functions with the
// most self time. Needs the dev server.
// Usage: node scripts/profile.mjs [x z] (default: the camp)
import puppeteer from 'puppeteer-core';

const url = process.env.GAME_URL ?? 'http://localhost:5179/';
const [x = -2, z = 24] = process.argv.slice(2).map(Number);
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 300000,
  args: ['--use-angle=metal', '--window-size=1100,800', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
  defaultViewport: { width: 1100, height: 800 },
});
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.G && document.getElementById('loading-text').textContent === '', { timeout: 90000 });
await page.evaluate(async (x, z) => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  document.getElementById('btn-new').click();
  for (let i = 0; i < 40 && G.mode !== 'play'; i++) { if (G.hud.inDialog) G.hud.advanceDialog(); await wait(300); }
  G.state.hearts = 99;
  G.player.teleport({ x, y: G.groundAt(x, z), z });
  await wait(4000);
}, x, z);
const cdp = await page.createCDPSession();
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
await cdp.send('Profiler.start');
const frames = await page.evaluate(() => new Promise((done) => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(tick); else done(n); };
  requestAnimationFrame(tick);
}));
const { profile } = await cdp.send('Profiler.stop');
// self time per function (samples × interval)
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map();
const dts = profile.timeDeltas;
profile.samples.forEach((id, i) => {
  const n = byId.get(id), f = n.callFrame;
  const key = `${f.functionName || '(anon)'} ${f.url.split('/').slice(-2).join('/').replace(/\?.*/, '')}:${f.lineNumber + 1}`;
  self.set(key, (self.get(key) ?? 0) + (dts[i] ?? 0) / 1000);
});
const total = [...self.values()].reduce((a, b) => a + b, 0);
console.log(`${frames} frames in 5 s; profiled ${total.toFixed(0)} ms`);
for (const [k, ms] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`${(ms / frames).toFixed(3)} ms/frame  ${(100 * ms / total).toFixed(1)}%  ${k}`);
await browser.close();
