// Playing together, end to end against Yorkie Cloud: three headless players
// (separate browser profiles, so separate characters) make, list, join, see
// each other, leave and close a game. Needs the dev server.
// Usage: node scripts/coop.mjs [outDir]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? '/tmp/scary-island-coop';
const url = process.env.GAME_URL ?? 'http://localhost:5179/';
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', protocolTimeout: 900000,
  args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--window-size=1100,800', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1100, height: 800 },
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => { results.push([ok ? 'PASS' : 'FAIL', name, detail]); console.log(ok ? 'PASS' : 'FAIL', name, detail); };

// A owns the game: through the stone door, hammer in hand. B is new on the
// beach. C is a veteran from their own game (got past the mine door).
const SAVES = {
  A: { version: 1, flags: { awake: true, explored: true, rockyWoke: true, rockyEscaped: true, doorOpen: true }, items: { hammer: true }, collected: { hammer: true } },
  B: { version: 1, flags: { awake: true } },
  C: { version: 1, flags: { awake: true, explored: true, doorOpen: true, campReached: true, vinesCut: true, generatorFixed: true, mineDoorOpen: true },
    items: { hammer: true, scissors: true }, collected: { hammer: true, scissors: true }, diamonds: 7 },
};

async function player(name) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  // the save goes in on a page of the same site that doesn't run the game:
  // a booting game that read an empty save would write it back over this one.
  // (Opening the bare SVG makes Chrome ask for /favicon.ico: answer it here.)
  await page.setRequestInterception(true);
  page.on('request', (r) => (r.url().endsWith('/favicon.ico') ? r.respond({ status: 204 }) : r.continue()));
  await page.goto(new URL('favicon.svg', url).href);
  await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('scary-island-save-v1', s); }, JSON.stringify(SAVES[name]));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || /YORKIE W/.test(m.text())) errors.push(m.text()); });
  return { name, page, errors, ctx };
}
const loaded = (p) => p.page.waitForFunction(() => window.G && document.getElementById('loading-text').textContent === '', { timeout: 120000 });
// in the game: skip any story lines on the way (a character's beach dialogue)
const inGame = (p) => p.page.waitForFunction(() => {
  if (window.G?.hud?.inDialog) G.hud.advanceDialog();
  return window.G?.net && G.mode === 'play';
}, { timeout: 60000, polling: 300 }).catch(async (err) => {
  const why = await p.page.evaluate(() => ({ url: location.href, mode: window.G?.mode, net: !!window.G?.net, loading: document.getElementById('loading-text').textContent, msg: document.getElementById('coop-msg').textContent }));
  throw new Error(`${p.name} not in game: ${JSON.stringify(why)} ${p.errors.slice(0, 3).join(' | ')}`);
});
// back to playing: skip whatever a pickup or a door had Yorkie say
const play = (p) => p.page.waitForFunction(() => { if (G.hud.inDialog) G.hud.advanceDialog(); return G.mode === 'play'; }, { timeout: 30000, polling: 200 });
const click = (p, sel) => p.page.evaluate((s) => document.querySelector(s).click(), sel);
const friendsOf = (p) => p.page.evaluate(() => G.friends?.count ?? -1);

try {
  const A = await player('A'), B = await player('B'), C = await player('C');

  // A makes a public game from the lobby
  await A.page.goto(url); await loaded(A);
  await click(A, '#btn-coop');
  await A.page.waitForSelector('#coop:not(.hidden)');
  await click(A, '#coop-create');
  await A.page.waitForNavigation({ timeout: 30000 }).catch(() => {});
  await loaded(A); await inGame(A);
  const game = await A.page.evaluate(() => ({ id: G.net.id, code: G.net.code, owner: G.net.isOwner, host: G.net.amHost() }));
  check('A created a game and owns it', game.owner && game.host, JSON.stringify(game));

  // B finds it in the game list and joins
  await B.page.goto(url); await loaded(B);
  await click(B, '#btn-coop');
  await B.page.waitForFunction((id) => [...document.querySelectorAll('.coop-game')].length > 0, { timeout: 30000 }, game.id).catch(() => {});
  const listed = await B.page.evaluate(() => [...document.querySelectorAll('.coop-game')].map((b) => b.textContent));
  check('B sees the game in the lobby', listed.length > 0, JSON.stringify(listed));
  await B.page.screenshot({ path: `${out}/1-lobby.png` });
  // the list may hold other people's games: join the one whose owner is A
  const aName = await A.page.evaluate(() => G.state.profile.name);
  await B.page.evaluate((n) => [...document.querySelectorAll('.coop-game')].find((b) => b.textContent.startsWith(n)).click(), aName);
  await B.page.waitForNavigation({ timeout: 30000 }).catch(() => {});
  await loaded(B); await inGame(B);
  check('B joined the same game', (await B.page.evaluate(() => G.net.id)) === game.id);

  // C comes in by a friend's link and the code pad
  await C.page.goto(`${url}?game=${game.id}`); await loaded(C);
  const pad = await C.page.evaluate(() => [...document.querySelectorAll('#coop-slots span')].map((s) => s.textContent));
  check('a link fills the code pad', pad.join('') === game.code.join(''), pad.join(''));
  await click(C, '#coop-join-code');
  await inGame(C);

  await Promise.all([A, B, C].map((p) => p.page.waitForFunction(() => G.friends.count === 2, { timeout: 15000 }).catch(() => {})));
  check('everyone sees two friends', (await Promise.all([A, B, C].map(friendsOf))).every((n) => n === 2), JSON.stringify(await Promise.all([A, B, C].map(friendsOf))));

  // --- shared world progress
  const view = (p) => p.page.evaluate(() => ({ flags: { ...G.state.flags }, items: { ...G.state.items }, diamonds: G.state.diamonds,
    pickups: G.pickups.filter((q) => q.alive && q.id).map((q) => q.id) }));
  const b0 = await view(B), c0 = await view(C);
  check("B's island is the owner's (stone door open, party hammer)", b0.flags.doorOpen && b0.items.hammer, JSON.stringify(b0.flags));
  check("C plays the owner's world, not their own", !c0.flags.mineDoorOpen && !c0.flags.vinesCut && c0.flags.doorOpen, JSON.stringify(c0.flags));
  check('C keeps their own things', c0.items.scissors && c0.diamonds === 7);

  // B picks up the scissors (a quest pickup): gone for everyone, everyone has them
  await B.page.evaluate(() => { const p = G.pickups.find((q) => q.id === 'scissors'); G.player.teleport({ x: p.model.position.x, y: p.model.position.y - 0.4, z: p.model.position.z }); });
  await A.page.waitForFunction(() => !G.pickups.some((q) => q.alive && q.id === 'scissors'), { timeout: 15000 }).catch(() => {});
  const a1 = await view(A);
  check('a quest pickup vanishes for friends', !a1.pickups.includes('scissors') && a1.items.scissors, JSON.stringify(a1.pickups));
  await A.page.screenshot({ path: `${out}/4-friend-found.png` });

  // B cuts the vines: A's vines are gone too
  await play(B);
  await B.page.evaluate(() => { G.player.teleport(G.markers.vines); });
  // arriving at the forest has Yorkie say a few things first: keep at it
  for (let i = 0; i < 6 && !(await B.page.evaluate(() => G.flag('vinesCut'))); i++) {
    await wait(500); await play(B);
    await B.page.evaluate(() => G.interact());
  }
  await A.page.waitForFunction(() => G.flag('vinesCut'), { timeout: 15000 }).catch(() => {});
  check("a friend's gate opens here", await A.page.evaluate(() => G.flag('vinesCut') && G.nav.cell != null),
    JSON.stringify(await B.page.evaluate(() => ({ mode: G.mode, cut: G.flag('vinesCut'), scissors: G.state.items.scissors, at: G.player.position, vines: G.markers.vines, dialog: G.hud.inDialog }))));

  // B eats a treat (loot): it stays on A's beach
  await play(B);
  await B.page.evaluate(() => { const p = G.pickups.find((q) => q.id === 'treat-beach-a'); G.player.teleport({ x: p.model.position.x, y: p.model.position.y - 0.35, z: p.model.position.z }); });
  await wait(500); await play(B); await wait(1500);
  const [bTreat, aTreat] = await Promise.all([B.page.evaluate(() => !!G.state.collected['treat-beach-a']), A.page.evaluate(() => G.pickups.some((q) => q.alive && q.id === 'treat-beach-a'))]);
  check('loot is personal: my treat, your treat', bTreat && aTreat, JSON.stringify({ bTreat, aTreat, b: await B.page.evaluate(() => ({ mode: G.mode, at: G.player.position, treat: G.pickups.find((q) => q.id === 'treat-beach-a')?.model.position })) }));

  // credit: C's save holds the game's progress and their own
  await wait(500);
  const cSave = await C.page.evaluate(() => { G.refresh(); return JSON.parse(localStorage.getItem('scary-island-save-v1')); });
  check("C's save: own progress kept, the game's credited", cSave.flags.mineDoorOpen && cSave.flags.vinesCut && cSave.flags.doorOpen && cSave.collected.scissors,
    JSON.stringify(cSave.flags));

  // --- monsters: A hosts; B wakes a beach Rocky, it comes for B (the nearest),
  // B gets bumped through the host, and B's hammer stuns it on the host
  check('only the owner runs the monsters', (await A.page.evaluate(() => G.simulating())) && !(await B.page.evaluate(() => G.simulating())));
  const ri = await A.page.evaluate(() => G.enemies.findIndex((e) => e.id === 'rocky-1'));
  await play(B);
  await B.page.evaluate((i) => {
    const r = G.enemies[i];
    G.player.teleport({ x: r.pos.x + 2.5, y: r.pos.y, z: r.pos.z });
    G.state.hearts = 3; G.player.state.invulnerable = 0;
    G.toHost(r, 'wake');
  }, ri);
  await A.page.waitForFunction((i) => G.enemies[i].state === 'chase', { timeout: 10000 }, ri).catch(() => {});
  await B.page.waitForFunction((i) => G.enemies[i].state === 'chase', { timeout: 10000 }, ri).catch(() => {});
  check("a friend's wake-up reaches the host, and the host's Rocky shows for the friend",
    (await A.page.evaluate((i) => G.enemies[i].state, ri)) === 'chase' && (await B.page.evaluate((i) => G.enemies[i].state, ri)) === 'chase');
  await B.page.waitForFunction(() => G.state.hearts < 3, { timeout: 15000, polling: 200 }).catch(() => {});
  check('the Rocky chases the nearest Yorkie and bumps the friend', await B.page.evaluate(() => G.state.hearts < 3), String(await B.page.evaluate(() => G.state.hearts)));
  await B.page.screenshot({ path: `${out}/5-rocky.png` });
  for (let k = 0; k < 4 && (await A.page.evaluate((i) => G.enemies[i].state, ri)) !== 'stunned'; k++) {
    await B.page.evaluate((i) => G.hammerHit(G.enemies[i].pos.clone().setY(G.enemies[i].pos.y + 0.5)), ri);
    await wait(700);
  }
  check("a friend's hammer stuns the host's Rocky", (await A.page.evaluate((i) => G.enemies[i].state, ri)) === 'stunned');
  await wait(500);
  check('…and everyone sees it dizzy', (await C.page.evaluate((i) => G.enemies[i].state, ri)) === 'stunned');

  // the host opens the Esc menu: nothing pauses (Diablo II), for anyone
  await play(A);
  const menu0 = await A.page.evaluate((i) => { G.screens.openMenu(); return G.enemies[i].t; }, ri);
  // with the menu open, a second Rocky wakes on the host: the friend sees it come alive
  const r2 = await A.page.evaluate(() => { const r = G.enemies.find((e) => e.id === 'rocky-2'); r.wake(); return r.index; });
  // (with nobody near it may soon give up and doze off again: catch it awake)
  const friendSees = await B.page.waitForFunction((i) => G.enemies[i].state !== 'sleep', { timeout: 5000, polling: 50 }, r2).then(() => true, () => false);
  await wait(1000);
  const hostTicks = await A.page.evaluate(([i, t0]) => G.mode === 'menu' && G.enemies[i].t > t0 + 1, [ri, menu0]);
  check("the host's menu doesn't pause the monsters", hostTicks, String(hostTicks));
  check('…and friends still see them move', friendSees);
  const hurtInMenu = await A.page.evaluate(() => { G.state.hearts = 3; G.player.state.invulnerable = 0; const ok = G.player.hurt(G.player.position.clone().setX(G.player.position.x + 1)); G.state.hearts = 3; return ok; });
  check('a monster can still reach you with the menu open', hurtInMenu);
  await A.page.evaluate(() => G.screens.closeMenu());

  // A walks off and barks: B sees A's Yorkie follow
  const to = await A.page.evaluate(() => { const p = G.player.position; G.player.teleport({ x: p.x + 4, y: p.y, z: p.z + 2 }); G.player.act('bark'); return { x: p.x, z: p.z }; });
  await wait(1500);
  const seen = await B.page.evaluate((me) => G.friends.dots().map((d) => Math.hypot(d.x - me.x, d.z - me.z)), to);
  check('B sees A where A went', seen.some((d) => d < 0.5), JSON.stringify(seen));
  await B.page.evaluate(() => { G.cam.snap?.(G.player.position); });
  await wait(500);
  await B.page.screenshot({ path: `${out}/2-friends.png` });

  // the menu lists everyone, with the owner's crown
  await B.page.evaluate(() => G.screens.openMenu());
  const menu = await B.page.evaluate(() => [...document.querySelectorAll('#menu-coop-players span')].map((s) => s.textContent));
  check('the menu lists 3 players and the owner', menu.length === 3 && menu.some((t) => t.startsWith('👑')), JSON.stringify(menu));
  check('no closing a game on friends (Diablo II): everyone just leaves',
    !(await B.page.evaluate(() => document.getElementById('btn-close-game'))) && await B.page.evaluate(() => !document.getElementById('btn-leave').classList.contains('hidden')));
  await B.page.screenshot({ path: `${out}/3-menu.png` });
  await B.page.evaluate(() => G.screens.closeMenu());

  // B leaves: the others see one friend
  await B.page.evaluate(() => G.screens.onLeave());
  await B.page.waitForNavigation({ timeout: 15000 }).catch(() => {});
  await A.page.waitForFunction(() => G.friends.count === 1, { timeout: 15000 }).catch(() => {});
  check('B left: A sees one friend', (await friendsOf(A)) === 1 && (await friendsOf(C)) === 1);

  // the owner leaves: C plays on (and takes over the monsters), then C is
  // the last one out and the lobby forgets the game
  await A.page.evaluate(() => G.screens.onLeave());
  await C.page.waitForFunction(() => G.simulating() && G.friends.count === 0, { timeout: 20000 }).catch(() => {});
  check('the owner left: C plays on as the host', await C.page.evaluate(() => !!G.net && G.mode !== 'title' && G.simulating()));
  await C.page.evaluate(() => G.screens.onLeave());
  await C.page.waitForFunction(() => !location.search.includes('game='), { timeout: 20000 }).catch(() => {});
  await loaded(B);
  await click(B, '#btn-coop');
  await wait(4000);
  const after = await B.page.evaluate(() => [...document.querySelectorAll('.coop-game')].map((b) => b.textContent));
  check('the lobby no longer lists it', !after.some((t) => t.startsWith(aName)), JSON.stringify(after));

  // --- host hand-over: B makes a game, C joins, B leaves: C runs the monsters
  await loaded(B);
  await B.page.evaluate(() => document.getElementById('coop').classList.add('hidden'));
  await B.page.evaluate(() => { document.getElementById('btn-coop').click(); });
  await B.page.waitForSelector('#coop:not(.hidden)');
  await click(B, '#coop-create-secret');
  await B.page.waitForNavigation({ timeout: 30000 }).catch(() => {});
  await loaded(B); await inGame(B);
  const secret = await B.page.evaluate(() => G.net.id);
  const bName = await B.page.evaluate(() => G.state.profile.name);
  await loaded(C);
  await C.page.evaluate(() => document.getElementById('btn-coop').click());
  await wait(4000);
  const seenByC = await C.page.evaluate(() => [...document.querySelectorAll('.coop-game')].map((b) => b.textContent));
  check('a secret game is not in the lobby', !seenByC.some((t) => t.startsWith(bName)), JSON.stringify(seenByC));
  await C.page.goto(`${url}?game=${secret}`); await loaded(C);
  await click(C, '#coop-join-code');
  await inGame(C);
  check('the joiner is not the host yet', !(await C.page.evaluate(() => G.simulating())));
  await B.page.evaluate(() => G.screens.onLeave());
  await C.page.waitForFunction(() => G.simulating(), { timeout: 15000 }).catch(() => {});
  const ticking = await C.page.evaluate(async () => { const e = G.enemies.find((x) => x.kind === 'mushy'); const t0 = e.t; await new Promise((r) => setTimeout(r, 800)); return e.t > t0; });
  check('the host left: the friend takes over the monsters', (await C.page.evaluate(() => G.simulating())) && ticking);
  await C.page.evaluate(() => G.screens.onLeave());

  for (const p of [A, B, C]) {
    const bad = p.errors.filter((e) => !/favicon|fonts\.g/.test(e));
    check(`${p.name} has no page errors`, !bad.length, bad.slice(0, 3).join(' | '));
  }
} catch (err) {
  check('scenario ran', false, err.stack);
} finally {
  await browser.close();
}
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} passed, screenshots in ${out}`);
process.exit(failed ? 1 : 0);
