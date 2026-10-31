await start(true); await wait(300); await skip();
log.push(['mode', G.controlMode, 'zoom distance', G.cam.rig.distance]);
// stand just west of the camp|village ridge: the camera (to the south-east) looks through it
await go(27, 9); await wait(1200);
await shot('xray-on');
const xr = G.scene.getObjectByName('island').userData.xray;
const r = xr.uRadius.value;
log.push(['xray radius', r]);
return log;
