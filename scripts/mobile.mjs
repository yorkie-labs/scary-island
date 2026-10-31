// Mobile layout check: screenshots of every screen on a phone (portrait and
// landscape) and a tablet, with touch emulation. Usage: node scripts/mobile.mjs [outDir]
import puppeteer, { KnownDevices } from 'puppeteer-core';
const out = process.argv[2] ?? '/tmp/scary-island-mobile';
const url = process.env.GAME_URL ?? 'http://localhost:5179/';
const DEVICES = {
  'phone-portrait': KnownDevices['iPhone 13'],
  'phone-landscape': KnownDevices['iPhone 13 landscape'],
  tablet: KnownDevices['iPad Mini landscape'],
};
const only = process.env.ONLY?.split(',');
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 900000,
  args: ['--use-angle=metal', '--enable-unsafe-swiftshader'],
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [name, dev] of Object.entries(DEVICES)) {
  if (only && !only.includes(name)) continue;
  const page = await browser.newPage();
  await page.emulate(dev);
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.G && document.getElementById('loading-text').textContent === '', { timeout: 120000 });
  const shot = (s) => page.screenshot({ path: `${out}/${name}-${s}.png` });
  console.log(name, await page.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, w: innerWidth, h: innerHeight })));
  await shot('1-title');
  await page.evaluate(() => document.getElementById('btn-new').click());
  await wait(1500);
  await shot('2-intro-dialog');
  await page.evaluate(async () => { for (let i = 0; i < 80 && !G.flag('awake'); i++) { if (G.hud.inDialog) G.hud.advanceDialog(); await new Promise((r) => setTimeout(r, 250)); } });
  await page.evaluate(() => { G.state.items.flashlight = true; G.state.potions = 2; G.state.diamonds = 12; G.refresh(); });
  await wait(1200);
  await shot('3-play-hud');
  // a tap on the ground walks there; the joystick walks too
  const before = await page.evaluate(() => G.player.position.toArray());
  const vp = page.viewport();
  await page.touchscreen.tap(Math.round(vp.width * 0.3), Math.round(vp.height * 0.4));
  await wait(2000);
  const after = await page.evaluate(() => G.player.position.toArray());
  console.log('  tap-to-move moved', Math.hypot(after[0] - before[0], after[2] - before[2]).toFixed(1), 'm');
  console.log('  mode after tap', await page.evaluate(() => G.mode));
  await page.evaluate(async () => { for (let i = 0; i < 20 && G.mode !== 'play'; i++) { if (G.hud.inDialog) G.hud.advanceDialog(); await new Promise((r) => setTimeout(r, 250)); } });
  const box = await (await page.$('#stick')).boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const cdp = await page.createCDPSession();
  const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: cx, y }] });
  const b2 = await page.evaluate(() => G.player.position.toArray());
  await touch('touchStart', cy); await touch('touchMove', cy - 50); await wait(1500); await touch('touchEnd');
  const a2 = await page.evaluate(() => G.player.position.toArray());
  console.log('  joystick moved', Math.hypot(a2[0] - b2[0], a2[2] - b2[2]).toFixed(1), 'm');
  await page.evaluate(() => { G.showMap = true; });
  await wait(600);
  await shot('4-map');
  await page.evaluate(() => { G.showMap = false; G.screens.openMenu(); });
  await wait(500);
  await shot('5-menu');
  await page.evaluate(() => { G.screens.closeMenu(); G.screens.openShop(); });
  await wait(500);
  await shot('6-shop');
  await page.evaluate(() => G.screens.closeShop());
  await page.close();
}
await browser.close();
