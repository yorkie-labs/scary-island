// The guardian follows Yorkie up the banks around the arena (stage 4).
localStorage.clear();
await start(false);
for (let i = 0; i < 60 && !G.flag('awake'); i++) { await skip(); await wait(300); }
for (const f of ['ancientGateOpen', 'guardianMet']) G.setFlag(f);
const g = G.enemies.find((e) => e.kind === 'guardian');
g.state = 'awake';
// the steepest bank north-west of the arena: Yorkie stands on top, facing away
const spots = [[56, -22], [66, -20], [86, -12]];
for (const [x, z] of spots) {
  g.mover.teleport(g.home); g.model.position.copy(g.home);
  await go(x, z);
  P.state.heading = Math.atan2(x - g.home.x, z - g.home.z); // looking away: it walks fast
  const y0 = g.pos.y;
  await wait(9000);
  log.push(`to (${x},${z}) y=${G.groundAt(x, z).toFixed(1)}`, 'guardian dist', +Math.hypot(g.pos.x - x, g.pos.z - z).toFixed(1), 'climbed', +(g.pos.y - y0).toFixed(1));
}
return log;
