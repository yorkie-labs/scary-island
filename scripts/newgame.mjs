// Starting over: "새로 시작" (title) and "처음부터" (menu, two presses) wipe the
// save and drop straight into a new game, without a second title screen, and
// the save-on-close must not write the old game back.
import puppeteer from 'puppeteer-core';
const url = process.env.GAME_URL ?? 'http://localhost:5179/';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 900000,
  args: ['--use-angle=metal', '--enable-unsafe-swiftshader'], defaultViewport: { width: 1100, height: 800 },
});
const page = await browser.newPage();
const ready = () => page.waitForFunction(() => window.G && document.getElementById('loading-text').textContent === '', { timeout: 120000 });
const status = () => page.evaluate(() => ({ title: !document.getElementById('title').classList.contains('hidden'), mode: G.mode, diamonds: G.state.diamonds }));
const withSave = async (diamonds) => {
  await page.evaluate((d) => localStorage.setItem('scary-island-save-v1', JSON.stringify({ ...G.state, diamonds: d, checkpoint: null, flags: { awake: true } })), diamonds);
  await page.reload(); await ready();
};
await page.goto(url); await ready();
await withSave(7);
console.log('with a save (7💎)      ', await status());
await Promise.all([page.waitForNavigation(), page.click('#btn-new')]); await ready();
await new Promise((r) => setTimeout(r, 800));
console.log('after 새로 시작        ', await status());

await withSave(5);
await page.click('#btn-continue');
await page.waitForFunction(() => { if (G.hud.inDialog) G.hud.advanceDialog(); return G.mode === 'play'; }, { timeout: 30000, polling: 300 });
await page.keyboard.press('Escape');
await page.waitForFunction(() => !document.getElementById('menu').classList.contains('hidden'));
await page.click('#btn-restart');
console.log('처음부터 once          ', await page.evaluate(() => document.getElementById('btn-restart').textContent), await status());
await Promise.all([page.waitForNavigation(), page.click('#btn-restart')]); await ready();
await new Promise((r) => setTimeout(r, 800));
console.log('after 처음부터 twice   ', await status());
await browser.close();
