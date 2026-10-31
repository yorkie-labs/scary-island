// A whole game, new save to credits, following the mission text as a child would.
const S = G.state;
const step = (name) => log.push([name, obj(), 'hearts', S.hearts, 'diamonds', S.diamonds]);
const pickupNear = async (r = 5) => { for (const p of [...G.pickups]) if (!p.id && p.model.position.distanceTo(P.position) < r) { await go(p.model.position.x, p.model.position.z, P.position.x > 400 ? 0 : undefined); } };
await start(false); await wait(500); await skip();
step('awake');
await shot('full-01-beach');
// ---- Stage 1
await goMark('wreck', 0); await wait(400); await skip();
await goMark('hammer', 0); await wait(500); await skip();
for (let round = 0; round < 3 && S.diamondsTotal < 3; round++) {
  for (const [x, z] of [[-5, 75], [-12, 72], [10, 73], [15, 68], [-17, 77]]) {
    if (S.diamondsTotal >= 3) break;
    await go(x, z + 1.2); await swing(x, z); await swing(x, z); await wait(300); await skip();
    await pickupNear(6); await skip();
  }
}
step('mined');
const need = (cond, what) => { if (!cond) throw new Error(`STUCK: ${what} — ${obj()}`); };
need(S.diamondsTotal >= 3, 'not enough diamonds');
// hide from Rocky in a bush
const rk = G.enemies.find((e) => e.kind === 'rocky' && e.state !== 'sleep');
if (rk) { await go(-14, 63); await wait(2600); log.push(['hidden', P.state.hidden, 'rocky', rk.state]); }
await wait(3000);
step('escaped?');
// sniff and bark
P.act('sniff'); await wait(1300); log.push(['sniff toast', document.getElementById('toast').textContent]);
await wait(800); await go(12.6, 89.0); for (let i = 0; i < 5 && !G.pickups.some((p) => p.id === 'engine') && !S.parts.engine; i++) await swing(12.6, 91.4);
const eng = G.pickups.find((p) => p.id === 'engine'); if (eng) { await go(eng.pos.x, eng.pos.z); await wait(400); await skip(); }
need(S.parts.engine, 'engine part');
await skip(); await goMark('stoneDoor', 0); await wait(300);
log.push(['at door', G.mode, G.hud.inDialog, L(G.nearInteractable), 'diamonds', S.diamonds, pos()]);
await use(); await wait(2600);
need(G.flag('doorOpen'), 'stone door');
await go(0, 44); await go(0, 36); await wait(4200); await skip();
step('stage1');
need(S.cleared[1], 'stage 1');
await shot('full-02-camp');
// shop: buy a potion
G.interactables.find((i) => L(i)?.includes('폴리'))?.action(); await wait(300);
document.querySelector('[data-buy="potion"]')?.click(); await wait(200);
document.getElementById('btn-shop-close').click(); await wait(200);
log.push(['potions after shop', S.potions, 'diamonds', S.diamonds]);
// ---- Stage 2
await go(-24, 12); await wait(400); await skip();
await goMark('scissors', 0); await wait(500); await skip();
await goMark('vines', 0); await use(); await wait(800);
await goMark('flashlight', 0.2); await wait(600); await skip();
need(G.state.items.flashlight, 'flashlight in the forest');
await go(-40, 10); await wait(1500); await skip();
await go(-66, -6); await wait(800); await skip(); await wait(300); await skip();
await go(-61.5, -11); await use(); await wait(1200);
await goMark('hut', 0); await use();
await goMark('generator', 0.5); await use();
await goMark('mineDoor', 0.5); await use(); await wait(4500); await skip();
step('stage2');
need(S.cleared[2], 'stage 2');
S.hearts = 3; G.refresh();
// ---- Stage 3
await goMark('elevator', 1); await use(); await wait(2000); await skip();
await shot('full-03-mine');
for (const o of G.hittables.map((h) => (typeof h.pos === 'function' ? h.pos() : h.pos)).filter((p) => p && p.x > 590 && p.z > -9 && p.z < 5).slice(0, 4)) {
  await go(o.x, o.z + 1.1); await swing(o.x, o.z); await swing(o.x, o.z); await wait(250); await pickupNear();
}
for (const p of [...G.pickups]) if (p.id && p.id.startsWith('mine-gem')) await go(p.model.position.x, p.model.position.z, 0);
S.hearts = 3; G.refresh();
log.push(['pre-tunnel', G.mode, G.hud.inDialog, pos()]);
await go(600, -9); await wait(400);
log.push(['tunnel start', G.musicOverride, pos()]);
for (let z = -10; z >= -48; z -= 1.6) { S.hearts = 3; await go(600, z, 0); await wait(110); }
log.push(['tunnel', G.flag('collapseEscaped'), 'hearts', S.hearts, 'mode', G.mode, pos(), 'cp', JSON.stringify(S.checkpoint)]);
await wait(400); await go(600, -54, 0); await wait(800); await skip();
await goMark('cart', 1.5); S.hearts = 3; G.interact(); await wait(300);
for (let i = 0; i < 130 && !G.flag('cartDone'); i++) { const cz = G.markers.cart.z; if ([-84, -104, -124].some((b) => cz - b < 2.2 && cz - b > 1.2)) G.emit('rideJump'); await wait(100); }
await wait(300); await go(600.5, -146, 0); await wait(800); await skip();
const golem = G.enemies.find((e) => e.kind === 'golem');
for (let round = 0; round < 40 && golem.state !== 'sleep'; round++) {
  await go(golem.pos.x, golem.pos.z + 3.5, 0); S.hearts = 3;
  for (let i = 0; i < 40 && golem.state !== 'stunned'; i++) await wait(100);
  if (golem.state !== 'stunned') continue;
  const h = golem.heading; await go(golem.pos.x - Math.sin(h) * 2.1, golem.pos.z - Math.cos(h) * 2.1, 0); await swing(golem.pos.x, golem.pos.z);
}
await wait(2200); await skip();
await goMark('energyCrystal', 0.3); await wait(800); await skip(); await wait(3500); await skip();
step('stage3');
need(S.cleared[3], 'stage 3');
await go(613, -167, 0); await use(); await wait(1800);
// ---- Stage 4
await goMark('villageDoor', 0); await use(); await wait(2800); await skip();
await go(38, 2); await wait(400); await skip();
const w = G.enemies.find((e) => e.id === 'v1');
await go(w.pos.x + 6, w.pos.z); G.cam.rig.yaw = Math.atan2(P.position.x - w.pos.x, P.position.z - w.pos.z); await wait(800); await skip();
face(w.pos.x, w.pos.z); G.emit('flashlight'); await wait(400); await skip();
for (let i = 0; i < 3; i++) { const k = G.pickups.find((p) => p.id?.startsWith('village-key')); if (!k) break; await go(k.pos.x, k.pos.z, k.pos.y > G.groundAt(k.pos.x, k.pos.z) + 0.6 ? k.pos.y : undefined); await wait(500); }
S.hearts = 3;
await goMark('ancientGate', 0); await use(); await wait(2500);
const sl = G.markers.seal; await go(sl.x, sl.z + 5); await wait(600); await skip();
await shot('full-04-guardian');
const guardian = G.enemies.find((e) => e.kind === 'guardian');
for (let i = 0; i < 3; i++) { const d = G.markers.device; S.hearts = 3; guardian.freeze(10); await go(d.x, d.z + 1.3); G.interact(); await wait(1900); }
await wait(1500); await skip(); await wait(800);
const key = G.pickups.find((p) => p.id === 'ship-key'); if (key) { await go(key.pos.x, key.pos.z); await wait(600); await skip(); await wait(3500); await skip(); }
step('stage4');
need(S.cleared[4], 'stage 4');
// ---- Stage 5
log.push(['pre-harbor', G.mode, G.flag('sealReleased'), G.hud.inDialog, pos(), G.flag('harborReached')]);
await go(66, 36); await go(66, 46); await go(64, 54); await wait(800);
log.push(['at-harbor', G.mode, G.hud.inDialog, pos(), G.flag('harborReached'), G.triggers.filter((t) => t.test && !t.done).length]);
await skip();
await goMark('boat', 0);
for (let i = 0; i < 5; i++) { log.push(['boat', L(G.nearInteractable), G.mode]); await use(); await wait(300); }
await shot('full-05-boat');
for (let i = 0; i < 70 && !G.flag('finalChase'); i++) { S.hearts = Math.max(S.hearts, 2); const a = i * 0.7; await go(64 + Math.cos(a) * 8, 64 + Math.sin(a) * 6); await wait(400); }
log.push(['after chase', G.flag('finalChase'), S.hearts, G.mode, obj()]);
await goMark('boat', 0); log.push(['board?', L(G.nearInteractable)]); G.interact(); await wait(500);
for (let i = 0; i < 40 && !G.flag('escaped'); i++) { if (G.hud.inDialog) G.hud.advanceDialog(); await wait(500); }
await wait(800);
await shot('full-06-credits');
log.push(['ESCAPED', G.flag('escaped'), 'cleared', JSON.stringify(S.cleared), 'stars', [1, 2, 3, 4, 5].map((i) => (S.cleared[i] ? 1 : 0) + (S.treasures[i] ? 1 : 0)).join(',')]);
return log;
