await start(true);
log.push(['obj', obj(), pos()]);
await goMark('villageDoor', 0); log.push(['door', L(G.nearInteractable)]);
await use(); await wait(2800); await skip();
await go(38, 2); await wait(400); await skip();
log.push(['entered', G.flag('villageEntered'), obj()]);
await goMark('flashlight', 0.2); await wait(600); await skip();
log.push(['flashlight', G.state.items.flashlight]);
await shot('village');
// look at a statue, then light it
const w = G.enemies.find((e) => e.id === 'v1');
await go(w.pos.x + 6, w.pos.z); G.cam.rig.yaw = Math.atan2(P.position.x - w.pos.x, P.position.z - w.pos.z); await wait(800); await skip();
face(w.pos.x, w.pos.z); G.emit('flashlight'); await wait(400);
log.push(['seen', G.flag('villageWatcherSeen'), 'frozen', G.flag('watcherFrozen'), w.frozenFor.toFixed(1)]);
// keys
for (let i = 0; i < 3; i++) { const k = G.pickups.find((p) => p.id?.startsWith('village-key')); if (!k) break; await go(k.pos.x, k.pos.z, k.pos.y - 0.2 > G.groundAt(k.pos.x, k.pos.z) ? k.pos.y : undefined); await wait(500); }
log.push(['keys', G.state.keys, obj()]);
G.state.hearts = 3;
await goMark('ancientGate', 0); log.push(['gate', L(G.nearInteractable)]); await use(); await wait(2500);
log.push(['gateOpen', G.flag('ancientGateOpen')]);
const s = G.markers.seal; await go(s.x, s.z + 5); await wait(600); await skip();
log.push(['met', G.flag('guardianMet'), obj()]);
await shot('guardian');
const guardian = G.enemies.find((e) => e.kind === 'guardian');
for (let i = 0; i < 3; i++) {
  const d = G.markers.device; G.state.hearts = 3;
  guardian.freeze(10);
  await go(d.x, d.z + 1.3); G.interact(); await wait(1900);
}
await wait(1500); await skip(); await wait(800);
log.push(['devices', G.state.devices, 'seal', G.flag('sealReleased')]);
const key = G.pickups.find((p) => p.id === 'ship-key');
if (key) { await go(key.pos.x, key.pos.z); await wait(600); await skip(); await wait(3500); await skip(); }
log.push(['shipKey', G.state.parts.shipKey, 'cleared', JSON.stringify(G.state.cleared), obj(), 'hearts', G.state.hearts]);
return log;
