// Cozy look: the intro's flight and Yorkie waking, with the effects on
// (`?tag=` prefixes the shots, as in k1-look.js).
const tag = new URLSearchParams(location.search).get('tag') ?? 'shot';
document.getElementById('btn-new').click();
await wait(1500); await shot(`${tag}-intro-1`);
await wait(4000); await shot(`${tag}-intro-2`);
for (let i = 0; i < 12 && G.mode !== 'play'; i++) {
  if (G.hud.inDialog) G.hud.advanceDialog();
  await wait(1400);
  if (i === 5) await shot(`${tag}-intro-3`);
}
await shot(`${tag}-intro-4`);
log.push(['mode', G.mode]);
return log;
