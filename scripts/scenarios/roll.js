// Roll on the beach and measure how far below the ground Yorkie's body dips.
await start(true); await wait(300); await skip();
await go(-3, 84); await wait(500);
const Box = G.player.model.children[0].constructor; // a THREE.Group, for its prototype chain
let worst = 0;
const dip = () => { let minY = Infinity; G.player.model.updateMatrixWorld(true); G.player.model.traverse((o) => { if (!o.isMesh || o.userData.isOutline || o.userData.isSilhouette || !o.visible) return; const pos = o.geometry.attributes.position; const v = new (P.position.constructor)(); for (let k = 0; k < pos.count; k += 3) { v.fromBufferAttribute(pos, k).applyMatrix4(o.matrixWorld); minY = Math.min(minY, v.y); } }); return G.groundAt(P.position.x, P.position.z) - minY; };
await wait(300); const standing = dip();
for (let r = 0; r < 3; r++) {
  P.act('roll');
  for (let i = 0; i < 12; i++) {
    await wait(40);
    let minY = Infinity;
    G.player.model.updateMatrixWorld(true);
    G.player.model.traverse((o) => {
      if (!o.isMesh || o.userData.isOutline || o.userData.isSilhouette || !o.visible) return;
      const pos = o.geometry.attributes.position;
      const v = new (P.position.constructor)();
      for (let k = 0; k < pos.count; k += 3) { v.fromBufferAttribute(pos, k).applyMatrix4(o.matrixWorld); minY = Math.min(minY, v.y); }
    });
    const ground = G.groundAt(P.position.x, P.position.z);
    worst = Math.max(worst, ground - minY);
  }
  await wait(400);
}
log.push(['standing dip (baseline)', +standing.toFixed(2), 'deepest dip during rolls (m)', +worst.toFixed(2)]);
return log;
