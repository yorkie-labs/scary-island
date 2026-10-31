// Fit the parts, start the engine, stand at the boat: do the rocks come?
await start(true); await wait(300); await skip();
await goMark('boat', 0);
for (let i = 0; i < 5 && !G.flag('crystalFitted'); i++) { await use(); await wait(300); }
log.push(['crystal fitted', G.flag('crystalFitted'), L(G.nearInteractable)]);
await use(); await wait(400); await skip();
const hunters = G.enemies.filter((e) => ['h1', 'h2', 'h3'].includes(e.id));
const boat = G.markers.boat; let closest = 99; let hits = 0; let last = G.state.hearts;
for (let i = 0; i < 100 && !G.flag('finalChase'); i++) {
  await go(boat.x, boat.z, boat.y); // stand still on the dock by the boat
  for (const h of hunters) closest = Math.min(closest, h.pos.distanceTo(P.position));
  if (G.state.hearts < last) hits++; last = G.state.hearts; G.state.hearts = 3;
  await wait(250);
}
log.push(['hunter states', hunters.map((h) => h.state).join(','), 'closest approach (m)', +closest.toFixed(1), 'hits taken', hits, 'finalChase', G.flag('finalChase')]);
log.push(['any hunter in the water', hunters.some((h) => h.pos.y < -0.5)]);
return log;
