import { connect } from './client.js';
import { LOBBY_KEY, lobbyRows, staleGames } from './share.js';

// The game list (Diablo II's lobby). Public games live as entries in one
// shared lobby document; the host of each game keeps its entry fresh, and any
// viewer sweeps entries that went quiet (a game whose tabs all crashed).

export async function watchLobby(onRows) {
  const { sdk, client } = await connect();
  const doc = new sdk.Document(LOBBY_KEY);
  await client.attach(doc, { initialRoot: { games: {} } });
  const render = () => {
    const games = doc.getRoot().games?.toJS?.() ?? {};
    const stale = staleGames(games, Date.now());
    if (stale.length) doc.update((root) => { for (const id of stale) delete root.games[id]; });
    onRows(lobbyRows(games, Date.now()));
  };
  const off = doc.subscribe(render);
  const timer = setInterval(render, 10000); // staleness moves with the clock
  render();
  return {
    async stop() {
      off(); clearInterval(timer);
      await client.detach(doc).catch(() => {});
    },
  };
}

// Write (or with null, remove) one game's entry: attach without live sync,
// change, and detach, which pushes the change.
export async function publishGame(id, entry) {
  const { sdk, client } = await connect();
  const doc = new sdk.Document(LOBBY_KEY);
  await client.attach(doc, { initialRoot: { games: {} }, syncMode: sdk.SyncMode.Manual });
  doc.update((root) => {
    if (entry) root.games[id] = entry;
    else delete root.games[id];
  });
  await client.detach(doc);
}
