await start(true);
log.push(['obj', obj(), pos()]);
await goMark('elevator', 1); log.push(['elev', L(G.nearInteractable)]);
await use(); await wait(1800); await skip();
log.push(['inMine', G.flag('inMine'), pos(), P.state.grounded]);
await shot('mine-landing');
// mine ores
for (const o of G.hittables.filter((h) => h.pos && typeof h.pos === 'function').map((h) => h.pos()).filter((p) => p.x > 590 && p.z > -9).slice(0, 4)) {
  await go(o.x, o.z + 1.1); await swing(o.x, o.z); await swing(o.x, o.z); await wait(300);
  for (const p of [...G.pickups]) if (!p.id && p.model.position.distanceTo(P.position) < 4) { await go(p.model.position.x, p.model.position.z); }
}
for (const p of [...G.pickups]) if (p.id && p.id.startsWith('mine-gem')) await go(p.model.position.x, p.model.position.z);
log.push(['ore', G.flag('mineOreMined'), 'mineDiamonds', G.state.mineDiamonds, obj()]);
// collapse: walk the tunnel
await go(600, -9); await wait(500);
let hits = G.state.hearts;
for (let z = -10; z >= -48; z -= 1.5) { await go(600, z); await wait(120); }
await wait(400);
log.push(['collapse', G.flag('collapseEscaped'), 'hearts', hits, '->', G.state.hearts]);
await go(600, -54); await wait(800); await skip();
await shot('mine-station');
await goMark('cart', 1.5); log.push(['cart', L(G.nearInteractable)]);
G.state.hearts = 3; G.refresh();
G.interact(); await wait(300);
const beamTimes = [];
for (let i = 0; i < 120 && !G.flag('cartDone'); i++) {
  const cz = G.markers.cart.z;
  if ([-84, -104, -124].some((b) => cz - b < 2.2 && cz - b > 1.2)) G.emit('rideJump');
  if (i === 30) await shot('mine-cart');
  await wait(100);
}
log.push(['cartDone', G.flag('cartDone'), 'hearts', G.state.hearts, pos()]);
await wait(300); await go(600.5, -146); await wait(800); await skip();
const golem = G.enemies.find((e) => e.kind === 'golem');
log.push(['golem', golem.state]);
// fight: wait for stun, go behind, hit
for (let round = 0; round < 12 && golem.state !== 'sleep'; round++) {
  // stand close so it slams
  await go(golem.pos.x, golem.pos.z + 3.5); G.state.hearts = 3;
  for (let i = 0; i < 40 && golem.state !== 'stunned'; i++) await wait(100);
  if (golem.state !== 'stunned') continue;
  const h = golem.heading;
  await go(golem.pos.x - Math.sin(h) * 2.1, golem.pos.z - Math.cos(h) * 2.1);
  await swing(golem.pos.x, golem.pos.z);
}
await wait(2000); await skip();
log.push(['golemAsleep', G.flag('golemAsleep'), golem.state]);
await shot('mine-golem');
await goMark('energyCrystal', 0.3); await wait(800); await skip(); await wait(3500); await skip();
log.push(['crystal', G.state.parts.crystal, 'cleared', JSON.stringify(G.state.cleared), obj()]);
return log;
