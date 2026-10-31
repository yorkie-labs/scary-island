// Press early, middle and late before each beam; one press is a mouse click.
await start(true); await wait(300); await skip();
await goMark('cart', 1.5); await wait(300); await skip();
G.state.hearts = 3; G.refresh();
G.interact(); await wait(200);
const beams = [[-84, 5, 'key'], [-104, 3, 'click'], [-124, 1.2, 'key']];
const done = new Set(); const hits = []; let last = 3; const prompts = new Set();
for (let i = 0; i < 400 && !G.flag('cartDone'); i++) {
  const z = G.markers.cart.z;
  prompts.add(document.getElementById('prompt').textContent);
  for (const [b, d, how] of beams) if (!done.has(b) && z - b <= d) {
    done.add(b);
    if (how === 'click') dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    else dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  }
  if (G.state.hearts < last) { hits.push(+z.toFixed(1)); last = G.state.hearts; }
  await wait(30);
}
log.push(['cartDone', G.flag('cartDone'), 'hits at', JSON.stringify(hits), 'hearts', G.state.hearts]);
log.push(['prompts seen', JSON.stringify([...prompts])]);
return log;
