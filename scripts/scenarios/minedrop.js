await start(true); await wait(300); await skip();
await goMark('elevator', 1); await use(); await wait(2000); await skip();
const ores = G.hittables.filter((h) => { const p = typeof h.pos === 'function' ? h.pos() : h.pos; return p && p.x > 590 && p.z > -9 && p.z < 5; });
const d0 = G.state.diamonds;
const ids0 = new Set(G.pickups);
const origAdd = G.addPickup; const added = [];
G.addPickup = (o) => { const r = origAdd(o); if (r) added.push(r); return r; };
// stand 3 m away facing the ore so a drop is not picked up at once
const ore = typeof ores[0].pos === 'function' ? ores[0].pos() : ores[0].pos;
await go(ore.x, ore.z + 1.1, 0); await swing(ore.x, ore.z); await swing(ore.x, ore.z);
await go(ore.x + 5, ore.z + 5, 0); await wait(300);
log.push(['ore at', [+ore.x.toFixed(1), +ore.z.toFixed(1)], 'drops', JSON.stringify(added.map((p) => p.model.position.toArray().map((v) => +v.toFixed(2)))), 'diamonds', d0, '→', G.state.diamonds]);
for (const p of added) { if (!p.alive) continue; await go(p.model.position.x, p.model.position.z, 0); }
log.push(['after walking to each drop: diamonds', G.state.diamonds, 'left on map', added.filter((p) => p.alive).length]);
return log;
