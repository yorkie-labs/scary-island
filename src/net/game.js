import { connect } from './client.js';
import { publishGame } from './lobby.js';
import { docKey, idToCode, electHost, mustLeave, HEARTBEAT_MS, safeName, safeColor } from './share.js';

// One game (Diablo II style): a Yorkie document per game, everyone's Yorkie in
// its presence. The creator owns it and can close it; the host (the owner while
// here, else an agreed player) keeps the public lobby entry fresh. The last
// player out removes the document, so a game lives only while it is played.

const SEND_MS = 125; // presence at most 8 times a second

export class GameError extends Error {
  constructor(code) { super(code); this.code = code; }
}

const SHARED_FIELDS = ['flags', 'items', 'parts', 'devicesLit', 'taken', 'cleared'];

// `shared` (create only): the owner's world progress the game starts from
export async function joinGame({ id, create = false, secret = false, profile, stage = 1, shared = {} }) {
  const { sdk, client } = await connect();
  const doc = new sdk.Document(docKey(id));
  const me = { id: profile.id, name: profile.name, color: profile.color, joinedAt: Date.now() };
  await client.attach(doc, { initialPresence: me });
  const others = () => doc.getOthersPresences().map(({ clientID, presence }) => ({ clientID, ...presence }));
  const bail = async (code) => {
    // an empty document made by this attach is not left behind
    if (!others().length && !doc.getRoot().meta) await client.remove(doc).catch(() => {});
    else await client.detach(doc).catch(() => {});
    throw new GameError(code);
  };

  if (create) {
    // a fresh random code that someone is already playing on: pick another
    if (doc.getRoot().meta && others().length) await bail('taken');
    doc.update((root) => {
      root.meta = { owner: me.id, ownerName: me.name, name: `${me.name}의 모험`, secret, stage, createdAt: new Date(), version: 1 };
      root.shared = Object.fromEntries(SHARED_FIELDS.map((f) => [f, { ...shared[f] }]));
    });
  } else if (!doc.getRoot().meta) await bail('missing');

  const players = () => [{ ...doc.getMyPresence(), me: true }, ...others()];
  if (mustLeave(players(), me.id)) await bail('full');

  // quick messages that are not kept (monsters, hits, barks): a Channel, on
  // its own key (the same key as the document breaks removing the document)
  const channel = new sdk.Channel(`${docKey(id)}-ch`);
  await client.attach(channel);
  // (SDK 0.7.25: attach resolves a moment before the channel says attached)
  for (let i = 0; i < 50 && !channel.isAttached(); i++) await new Promise((r) => setTimeout(r, 100));
  const handlers = new Map(); // topic -> [fn]
  channel.subscribe('broadcast', (e) => { for (const fn of handlers.get(e.topic) ?? []) fn(e.payload); });
  const dropChannel = () => client.detach(channel).catch(() => {});

  const listeners = { join: [], leave: [], end: [], shared: [] };
  const emit = (name, data) => { for (const fn of listeners[name]) fn(data); };
  let ended = false;
  const end = (reason) => {
    if (ended) return;
    ended = true;
    clearInterval(heartbeat);
    emit('end', reason);
  };

  const unsubs = [
    doc.subscribe('others', (e) => {
      if (e.type === 'watched') emit('join', e.value.presence);
      if (e.type === 'unwatched') emit('leave', e.value.presence);
      if (e.type !== 'presence-changed') {
        if (mustLeave(players(), me.id)) { end('full'); dropChannel(); client.detach(doc).catch(() => {}); return; }
        lobbySoon();
      }
    }),
    doc.subscribe((e) => { if (e.type === 'remote-change') emit('shared', net.shared()); }),
    doc.subscribe('status', (e) => { if (e.value?.status === 'removed' || e.value === 'removed') end('closed'); }),
  ];

  // the lobby entry, written one at a time
  let lobbyChain = Promise.resolve(), lobbyTimer = null;
  const writeLobby = (entry) => { lobbyChain = lobbyChain.then(() => publishGame(id, entry)).catch((err) => console.warn('lobby entry not written', err)); return lobbyChain; };
  const lobbyEntry = () => {
    const meta = doc.getRoot().meta;
    return { name: meta.name, owner: meta.owner, ownerName: meta.ownerName, stage: meta.stage, players: players().length, createdAt: meta.createdAt, lastSeen: new Date() };
  };
  const refreshLobby = () => { if (!ended && net.amHost() && !net.secret) writeLobby(lobbyEntry()); };
  function lobbySoon() { clearTimeout(lobbyTimer); lobbyTimer = setTimeout(refreshLobby, 1000); }
  const heartbeat = setInterval(refreshLobby, HEARTBEAT_MS);

  // my Yorkie's pose: only what changed, at most every SEND_MS
  let pending = null, lastSent = 0;
  const flush = () => {
    if (!pending || ended) return;
    const change = pending; pending = null; lastSent = performance.now();
    doc.update((_, p) => p.set(change));
  };

  const net = {
    id,
    code: idToCode(id),
    get secret() { return !!doc.getRoot().meta?.secret; },
    get owner() { return doc.getRoot().meta?.owner; },
    get name() { return doc.getRoot().meta?.name; },
    me: me.id,
    get isOwner() { return net.owner === me.id; },
    host() { return electHost(players(), net.owner); },
    amHost() { return net.host() === me.id; },
    // everyone here, with names and colours forced back to the presets
    players() { return players().map((p) => ({ ...p, name: safeName(p.name), color: safeColor(p.color) })); },
    others() { return net.players().filter((p) => !p.me); },
    on(name, fn) { listeners[name].push(fn); },
    // a message to everyone else in the game (not kept)
    // (never throws: it is called from the game loop, and a lost message is fine)
    broadcast(topic, payload) {
      if (ended || !channel.isAttached()) return;
      try { channel.broadcast(topic, payload, { maxRetries: 0, error: () => {} }); } catch (err) { console.warn('broadcast', topic, err); }
    },
    onMessage(topic, fn) { (handlers.get(topic) ?? handlers.set(topic, []).get(topic)).push(fn); },

    // the game's world progress, as sets ({ key: true }) per field
    shared() {
      const s = doc.getRoot().shared?.toJS() ?? {};
      return Object.fromEntries(SHARED_FIELDS.map((f) => [f, s[f] ?? {}]));
    },
    // my progress into the game: [[field, key], ...], each only ever turns on
    pushShared(pairs) {
      if (ended || !pairs.length) return;
      doc.update((root) => {
        root.shared ??= {};
        for (const [field, key] of pairs) {
          if (!root.shared[field]) root.shared[field] = {};
          root.shared[field][key] = true;
        }
      });
    },

    send(pose) {
      pending = { ...pending, ...pose };
      if (performance.now() - lastSent >= SEND_MS) flush();
    },
    tick() { if (pending && performance.now() - lastSent >= SEND_MS) flush(); },

    // leave: the last one out removes the game and its lobby entry
    async leave() {
      if (ended) return;
      ended = true;
      clearInterval(heartbeat); clearTimeout(lobbyTimer);
      for (const off of unsubs) off();
      await dropChannel();
      if (!others().length) {
        await writeLobby(null);
        await client.remove(doc).catch(() => client.detach(doc).catch(() => {}));
      } else await client.detach(doc).catch(() => {});
    },
    // the owner ends the game for everyone: the others see it removed
    async close() {
      if (!net.isOwner || ended) return;
      ended = true;
      clearInterval(heartbeat); clearTimeout(lobbyTimer);
      for (const off of unsubs) off();
      await dropChannel();
      await writeLobby(null);
      await client.remove(doc).catch(() => {});
    },
    // the tab is closing: tell the server now so friends see us go
    goodbye() {
      if (ended) return;
      ended = true;
      client.deactivate({ keepalive: true }).catch(() => {});
    },
  };

  refreshLobby();
  return net;
}
