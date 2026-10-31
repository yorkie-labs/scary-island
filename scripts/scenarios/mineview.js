await start(true); await wait(300); await skip();
await goMark('elevator', 1); await use(); await wait(2000); await skip();
await go(600, 0, 0); await wait(1500); await shot('mine-view-landing');
await go(600, -20, 0); await wait(1500); await shot('mine-view-tunnel');
log.push(['ok']);
return log;
