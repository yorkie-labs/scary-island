await start(true); await wait(300); await skip();
const canvas = G.renderer.domElement;
const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 500, clientY: 300 });
canvas.dispatchEvent(ev);
const ev2 = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
document.getElementById('bar').dispatchEvent(ev2);
log.push(['context menu blocked on canvas', ev.defaultPrevented, 'on HUD', ev2.defaultPrevented]);
// Space uses the nearest thing
await goMark('shop', 0); await wait(300);
dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); await wait(300);
log.push(['Space near Polly opens shop', !document.getElementById('shop').classList.contains('hidden')]);
return log;
