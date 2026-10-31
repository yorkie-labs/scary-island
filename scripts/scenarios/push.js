// A chasing Rocky runs into a Yorkie who stands still: how far is Yorkie moved?
await start(true); await wait(300); await skip();
const rk = G.enemies.find((e) => e.kind === 'rocky' && e.id === 'rocky-2');
await go(rk.pos.x, rk.pos.z + 3); await wait(500);
G.state.hearts = 3;
const start0 = P.position.clone();
rk.wake(); await wait(1100);
P.state.invulnerable = 99; // keep hits from knocking, to see pure body pushing
let maxMove = 0;
for (let i = 0; i < 40; i++) { await wait(100); maxMove = Math.max(maxMove, Math.hypot(P.position.x - start0.x, P.position.z - start0.z)); }
log.push(['rocky reached', +rk.pos.distanceTo(P.position).toFixed(2), 'yorkie pushed by', +maxMove.toFixed(2)]);
P.state.invulnerable = 0;
const shop = G.markers.shop; await go(shop.x + 1, shop.z + 2); await wait(1500); await shot('shop');
return log;
