await start(true); await wait(300); await skip();
await goMark('cart', 1.5); await wait(300); await skip();
G.state.hearts = 3; G.refresh();
G.interact();
// never jump: hit every beam until fainting
for (let i = 0; i < 300 && G.mode !== 'cutscene'; i++) await wait(50);
log.push(['fainted at cart z', +G.markers.cart.z.toFixed(1), 'hearts', G.state.hearts]);
await wait(3500); await skip();
log.push(['respawn', pos(), 'checkpoint', JSON.stringify(G.state.checkpoint), 'cart at', G.markers.cart.toArray().map((v) => +v.toFixed(1)), 'riding', G.riding(), 'frozen', P.state.frozen, 'mode', G.mode]);
await shot('cart-respawn');
// try again: board and hop at the first beam
await goMark('cart', 1.5); await wait(300);
log.push(['near cart', L(G.nearInteractable)]);
G.interact(); await wait(200);
let hopped = false, maxY = 0;
for (let i = 0; i < 200 && G.riding(); i++) {
  const z = G.markers.cart.z;
  if (!hopped && z - (-84) < 3) { dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); hopped = true; }
  maxY = Math.max(maxY, G.markers.cart.y);
  if (z < -90) break;
  await wait(40);
}
log.push(['second ride: hopped', hopped, 'max cart y', +maxY.toFixed(2), 'hearts', G.state.hearts]);
return log;
