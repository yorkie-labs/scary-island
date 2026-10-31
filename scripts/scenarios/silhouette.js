await start(true); await wait(300); await skip();
await go(27, 9); await wait(1200);
await shot('silhouette-ridge');
// behind a forest tree, with a Watcher hunting
await go(-50, 12); await wait(1500); await skip();
await shot('silhouette-forest');
log.push(['ok']);
return log;
