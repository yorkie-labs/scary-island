// Lure the forest statues to the vines, then step into the camp and look away.
await start(true); await wait(300); await skip();
await go(-40, 10); await wait(800); await skip();
const ws = G.enemies.filter((e) => e.kind === 'watcher' && e.homeRegion === 'forest');
// walk out through the gap into the camp, back to the statues (they follow while unseen)
for (const x of [-36, -33, -30, -26, -20, -12]) { await go(x, 12); G.cam.rig.yaw = 0; P.state.heading = Math.PI / 2; await wait(700); }
await wait(4000);
const maxX = Math.max(...ws.map((w) => w.pos.x));
log.push(['statues furthest east (x)', +maxX.toFixed(1), 'vines gate x', -32, 'any in camp side?', maxX > -34]);
// beach Rocky never passes the stone door
const rk = G.enemies.find((e) => e.id === 'rocky-3'); rk.wake();
await go(1, 56); await wait(1200);
for (const z of [52, 48, 44, 40, 34]) { await go(0, z); await wait(600); }
await wait(3000);
log.push(['rocky furthest north (z)', +rk.pos.z.toFixed(1), 'stone door z', 50]);
return log;
