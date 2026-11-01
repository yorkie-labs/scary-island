// Zoom check: how big Yorkie and the world look on a phone, upright and lying
// down (pixels per metre at Yorkie, and the metres the screen spans).
// Usage: node scripts/zoom.mjs [outDir]   (DEVICE='iPhone 12' by default)
import puppeteer, { KnownDevices } from 'puppeteer-core';
const out = process.argv[2] ?? '/tmp/scary-island-zoom';
const url = process.env.GAME_URL ?? 'http://localhost:5179/';
const device = process.env.DEVICE ?? 'iPhone 12';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 900000,
  args: ['--use-angle=metal', '--enable-unsafe-swiftshader'],
});
for (const name of [device, `${device} landscape`]) {
  const page = await browser.newPage();
  await page.emulate(KnownDevices[name]);
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.G && document.getElementById('loading-text').textContent === '', { timeout: 120000 });
  await page.evaluate(() => document.getElementById('btn-new').click());
  await page.evaluate(async () => { for (let i = 0; i < 80 && !G.flag('awake'); i++) { if (G.hud.inDialog) G.hud.advanceDialog(); await new Promise((r) => setTimeout(r, 250)); } });
  await new Promise((r) => setTimeout(r, 1500));
  const m = await page.evaluate(() => {
    const cam = G.camera, p = G.player.position, V = p.constructor;
    const px = (v) => { const s = v.clone().project(cam); return [(s.x + 1) / 2 * innerWidth, (1 - s.y) / 2 * innerHeight]; };
    const a = px(new V(p.x - 0.5, p.y, p.z + 0.5)), b = px(new V(p.x + 0.5, p.y, p.z - 0.5)); // 1 m across the screen (iso yaw 45°)
    const pxPerM = Math.hypot(b[0] - a[0], b[1] - a[1]) / Math.SQRT2;
    return { w: innerWidth, h: innerHeight, pxPerM: +pxPerM.toFixed(1), spanW: +(innerWidth / pxPerM).toFixed(1), spanH: +(innerHeight / pxPerM).toFixed(1), dist: +cam.position.distanceTo(p).toFixed(1) };
  });
  console.log(name.padEnd(22), JSON.stringify(m));
  await page.screenshot({ path: `${out}/${name.replace(/ /g, '-')}.png` });
  // the 🔨 button: stand 1.5 m from something bonkable, facing away; one tap
  // turns Yorkie toward it and lands the hammer on it
  const setup = await page.evaluate(() => {
    G.state.items.hammer = true;
    const at = (x) => (typeof x.pos === 'function' ? x.pos() : x.pos);
    const p0 = G.player.position;
    const h = G.hittables.filter((x) => (!x.enabled || x.enabled()) && at(x).x < 400)
      .sort((a, b) => at(a).distanceTo(p0) - at(b).distanceTo(p0))[0];
    const hp = at(h).clone();
    G.player.teleport({ x: hp.x + 1.5, y: G.groundAt(hp.x + 1.5, hp.z), z: hp.z });
    G.player.state.heading = Math.PI / 2; // facing +x, away from it
    const orig = G.hammerHit; window.__hit = null;
    G.hammerHit = (pt) => { const r = orig(pt); window.__hit = r === h; G.hammerHit = orig; return r; };
    return true;
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.tap('#touch-buttons [data-key="Hammer"]');
  await new Promise((r) => setTimeout(r, 900));
  console.log('  🔨 button hit the nearby thing:', await page.evaluate(() => window.__hit));
  await page.close();
}
await browser.close();
