await start(true); await wait(300); await skip();
await go(14.5, 87.4); await wait(600);
for (let i = 0; i < 5 && !G.pickups.some((p) => p.id === 'engine'); i++) await swing(14.5, 89.5);
await wait(600);
const eng = G.pickups.find((p) => p.id === 'engine');
log.push(['engine pickup', eng ? eng.model.position.toArray().map((v) => +v.toFixed(2)) : 'none', 'ground there', eng ? +G.groundAt(eng.pos.x, eng.pos.z).toFixed(2) : null]);
await shot('planks');
return log;
