// Every pickup, chest and usable thing on the island must sit on dry, walkable ground.
await start(true); await wait(300); await skip();
const bad = [];
const check = (name, p) => {
  if (p.x > 400) return; // the mine has its own floor
  const g = G.groundAt(p.x, p.z);
  const wet = g < 0.25;
  let near = false;
  for (let dx = -2; dx <= 2 && !near; dx++) for (let dz = -2; dz <= 2 && !near; dz++) if (G.nav.cell(G.nav.toIx(p.x) + dx, G.nav.toIx(p.z) + dz)) near = true;
  if (wet || !near) bad.push([name, +p.x.toFixed(1), +p.z.toFixed(1), 'ground', +g.toFixed(2), wet ? 'WET' : '', near ? '' : 'NO WALKABLE GROUND NEARBY']);
};
for (const p of G.pickups) check(p.name ?? p.id ?? 'pickup', p.pos);
for (const it of G.interactables) { const ip = typeof it.pos === 'function' ? it.pos() : it.pos; const lab = typeof it.label === 'function' ? it.label() : it.label; check(lab, ip); }
log.push(['checked', G.pickups.length + G.interactables.length, 'problems', bad.length]);
for (const b of bad) log.push(b);
return log;
