await start(true); await wait(300); await skip();
await go(12.6, 89.0); await wait(700); await shot('crate-before');
const hits = [];
for (let i = 0; i < 4 && !G.pickups.some((p) => p.id === 'engine'); i++) { await swing(12.6, 91.4); hits.push(document.getElementById('toast').textContent); await wait(150); }
await wait(250); await shot('crate-burst');
const eng = G.pickups.find((p) => p.id === 'engine');
log.push(['toasts', JSON.stringify(hits), 'engine at', eng ? eng.model.position.toArray().map((v) => +v.toFixed(1)) : 'none', 'walkable', eng ? !!G.nav.cell(G.nav.toIx(eng.pos.x), G.nav.toIx(eng.pos.z)) : null]);
if (eng) { G.pointer.goTo(eng.model.position); for (let i = 0; i < 40 && eng.alive; i++) await wait(100); await skip(); }
log.push(['engine collected', G.state.parts.engine]);
return log;
