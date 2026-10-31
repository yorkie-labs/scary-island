await start(true);
// try to climb each ridge: walk at it holding run and jumping, from a point beside it
const tries = [
  { name: 'beach→camp', from: [14, 60], dir: [0, -1] },
  { name: 'beach→harbor', from: [26, 72], dir: [1, 0] },
  { name: 'camp→forest', from: [-24, 0], dir: [-1, 0] },
  { name: 'camp→village', from: [24, 16], dir: [1, 0] },
  { name: 'camp→mine', from: [10, -22], dir: [0, -1] },
  { name: 'village→harbor', from: [76, 30], dir: [0, 1] },
];
for (const t of tries) {
  await go(t.from[0], t.from[1]);
  G.cam.rig.yaw = Math.atan2(-t.dir[0], -t.dir[1]);
  G.input.virtual.forward = 1; G.input.virtual.run = true;
  for (let i = 0; i < 24; i++) { P.jump(); await wait(250); }
  G.input.virtual.forward = 0; G.input.virtual.run = false;
  const p = P.position;
  const crossed = t.dir[0] ? (p.x - t.from[0]) * t.dir[0] > 14 : (p.z - t.from[1]) * t.dir[1] > 14;
  log.push([t.name, crossed ? 'CROSSED!' : 'blocked', pos(), G.mode, G.hud.inDialog]); await skip();
}
const info = G.renderer.info.render;
log.push(['draw calls', info.calls, 'triangles', info.triangles, 'scene objects', G.scene.children.length]);
let meshes = 0; G.scene.traverse((o) => { if (o.isMesh) meshes++; });
log.push(['meshes', meshes]);
return log;
