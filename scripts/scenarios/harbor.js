await start(true);
log.push(['obj', obj(), pos()]);
await go(66, 36); await wait(300); await go(66, 46); await wait(800); await skip();
log.push(['harbor', G.flag('harborReached'), obj()]);
await shot('harbor');
await goMark('boat', 0);
for (let i = 0; i < 5; i++) { log.push(['boat', L(G.nearInteractable)]); await use(); await wait(300); }
log.push(['repairs', G.flag('boatChecked'), G.flag('engineFixed'), G.flag('fuelFilled'), G.flag('crystalFitted'), obj()]);
await shot('boat');
// survive: hop around the yard dodging, keep hearts topped up (we test the timer and the chase)
let minHearts = 3;
for (let i = 0; i < 60 && !G.flag('finalChase'); i++) {
  minHearts = Math.min(minHearts, G.state.hearts); G.state.hearts = 3;
  const a = i * 0.7; await go(64 + Math.cos(a) * 8, 64 + Math.sin(a) * 6);
  await wait(400);
}
log.push(['finalChase', G.flag('finalChase'), 'chasers', G.enemies.filter((e) => e.active).length, 'minHearts', minHearts]);
await goMark('boat', 0); log.push(['board', L(G.nearInteractable)]);
G.interact(); await wait(500);
for (let i = 0; i < 40 && !G.flag('escaped'); i++) { if (G.hud.inDialog) G.hud.advanceDialog(); await wait(500); }
await wait(1000);
await shot('credits');
log.push(['escaped', G.flag('escaped'), 'cleared', JSON.stringify(G.state.cleared), document.getElementById('menu').innerText.slice(0, 120)]);
return log;
