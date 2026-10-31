// Mine every ore at the landing many times; every diamond must land on walkable ground and be collectable.
await start(true); await wait(300); await skip();
await goMark('elevator', 1); await use(); await wait(2000); await skip();
const origAdd = G.addPickup; const added = [];
G.addPickup = (o) => { const r = origAdd(o); if (r) added.push(r); return r; };
const ores = G.hittables.map((h) => (typeof h.pos === 'function' ? h.pos() : h.pos)).filter((p) => p && p.x > 590 && p.z > -9 && p.z < 5);
for (const ore of ores) {
  await go(ore.x + 0.8, ore.z + 0.8, 0); await swing(ore.x, ore.z); await swing(ore.x, ore.z); await wait(300);
}
let bad = 0;
for (const p of added) { const c = G.nav.cell(G.nav.toIx(p.pos.x), G.nav.toIx(p.pos.z)); if (!c) bad++; }
const before = G.state.diamonds;
for (const p of added) { if (!p.alive) continue; G.pointer.goTo(p.model.position); for (let i = 0; i < 40 && p.alive; i++) await wait(100); }
log.push(['drops', added.length, 'on unwalkable cells', bad, 'collected by walking', G.state.diamonds - before, 'still lying', added.filter((p) => p.alive).length]);
return log;
