await start(true); await wait(300); await skip();
const faded = () => G.scene.children.filter((o) => { let f = false; o.traverse((c) => { if (c.userData.solidMaterial) f = true; }); return f; }).map((o) => o.name || o.type);
const dir = { x: 0.62, z: 0.78 }; const n = Math.hypot(dir.x, dir.z);
for (const d of [2, 8, 13]) {
  await go(66 + (dir.x / n) * d, 76 + (dir.z / n) * d, 1.62); await wait(700);
  log.push([`on dock at ${d} m`, 'faded', JSON.stringify(faded())]);
}
await shot('dock-walk');
// a real occluder still fades: stand behind the lighthouse from the camera
await go(84, 62); await wait(700);
log.push(['behind lighthouse', 'faded', JSON.stringify(faded())]);
return log;
