// Pure rules for playing together (Diablo II style games): game codes, who
// hosts, who has to leave a full game, which lobby entries are stale, and the
// preset names and colours (no free text in a kids' game). No Yorkie here, so
// it is all unit-tested.

export const MAX_PLAYERS = 10;
export const HEARTBEAT_MS = 30000; // the host refreshes its lobby entry this often
export const STALE_MS = 90000; // a lobby entry not refreshed for this long is gone

// A game code is 4 animals a child can read out to a friend. Each animal is a
// hex digit, so the code maps 1:1 to a 4-character game id.
export const CODE_EMOJIS = ['🐶', '🐱', '🐰', '🐻', '🐼', '🦊', '🐸', '🐵', '🐧', '🐤', '🐢', '🐙', '🦄', '🐝', '🦋', '🐳'];
export const CODE_LENGTH = 4;

export function randomGameId(random = Math.random) {
  let id = '';
  for (let i = 0; i < CODE_LENGTH; i++) id += Math.floor(random() * 16).toString(16);
  return id;
}
export const isGameId = (id) => typeof id === 'string' && /^[0-9a-f]{4}$/.test(id);
export const idToCode = (id) => [...id].map((c) => CODE_EMOJIS[parseInt(c, 16)]);
export function codeToId(emojis) {
  if (emojis.length !== CODE_LENGTH) return null;
  const digits = emojis.map((e) => CODE_EMOJIS.indexOf(e));
  return digits.includes(-1) ? null : digits.map((d) => d.toString(16)).join('');
}

export const docKey = (id) => `scary-island-game-${id}`;
export const LOBBY_KEY = 'scary-island-lobby';

// The host simulates the monsters: the owner while they are here, else the
// player with the smallest id, so every client picks the same one.
export function electHost(players, owner) {
  if (!players.length) return null;
  if (players.some((p) => p.id === owner)) return owner;
  return players.map((p) => p.id).sort()[0];
}

// When two friends join at once a game can go past the limit: the latest
// arrivals leave (ties broken by id, so everyone agrees on who).
export function mustLeave(players, me, max = MAX_PLAYERS) {
  if (players.length <= max) return false;
  const order = [...players].sort((a, b) => (a.joinedAt - b.joinedAt) || (a.id < b.id ? -1 : 1));
  return order.findIndex((p) => p.id === me) >= max;
}

// Times are stored as Dates (a Yorkie Date primitive; a millisecond number
// would not fit int32 and turns into a Long). `toJS()` hands them back as ISO
// strings; read any of these as milliseconds (unreadable = long ago).
export function ms(t) {
  const v = t instanceof Date ? t.getTime() : typeof t === 'string' ? Date.parse(t) : Number(t ?? 0);
  return Number.isFinite(v) ? v : 0;
}

export const staleGames = (games, now) =>
  Object.entries(games ?? {}).filter(([, g]) => !(now - ms(g.lastSeen) < STALE_MS)).map(([id]) => id);

// Lobby rows: fresh public games, the fullest-but-not-full first.
export function lobbyRows(games, now) {
  const stale = new Set(staleGames(games, now));
  return Object.entries(games ?? {})
    .filter(([id]) => !stale.has(id))
    .map(([id, g]) => ({ id, ...g, full: (g.players ?? 0) >= MAX_PLAYERS }))
    .sort((a, b) => (a.full - b.full) || ((b.players ?? 0) - (a.players ?? 0)) || (ms(b.createdAt) - ms(a.createdAt)));
}

// Nicknames are an adjective plus an animal; hoodies come in ten colours.
export const NAME_ADJECTIVES = ['용감한', '씩씩한', '졸린', '배고픈', '반짝이는', '수줍은', '신나는', '똑똑한', '꼬마', '튼튼한', '날쌘', '귀여운'];
export const NAME_ANIMALS = ['강아지', '고양이', '토끼', '다람쥐', '펭귄', '여우', '곰돌이', '햄스터', '부엉이', '거북이', '판다', '오리'];
export const HOODIE_COLORS = ['#8fd3f4', '#ff9ec7', '#8ee6b5', '#ffe066', '#c3a6ff', '#ff8f70', '#4fd1c5', '#ffb062', '#a0c4ff', '#f2f2f2'];

export function randomName(random = Math.random) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  return `${pick(NAME_ADJECTIVES)} ${pick(NAME_ANIMALS)}`;
}

// A name is only ever one of the presets, whatever a save or a peer says.
export function isPresetName(name) {
  if (typeof name !== 'string') return false;
  const [adj, animal, ...rest] = name.split(' ');
  return !rest.length && NAME_ADJECTIVES.includes(adj) && NAME_ANIMALS.includes(animal);
}
export const safeName = (name) => (isPresetName(name) ? name : '친구');
export const safeColor = (color) => (HOODIE_COLORS.includes(color) ? color : HOODIE_COLORS[0]);

// --- Shared progress (Diablo II: the world follows the game, quest credit goes
// to every character in it). Everything shared only ever turns on, so merging
// is a union and two friends doing the same thing at once can't clash.

// Pickups that are the quest itself: one per game, gone for everyone once
// taken. Every other pickup (treats, potions, mine diamonds) is personal loot.
export const QUEST_PICKUPS = new Set(['hammer', 'engine', 'flashlight', 'scissors', 'energy-crystal', 'ship-key', 'village-key-0', 'village-key-1', 'village-key-2']);
export const isQuestPickup = (id) => QUEST_PICKUPS.has(id);

// Flags about where *I* am or what *I* saw, not about the world.
export const PERSONAL_FLAGS = new Set(['awake', 'inMine', 'boarded', 'escaped']);

const on = (obj) => Object.fromEntries(Object.entries(obj ?? {}).filter(([, v]) => v === true).map(([k]) => [k, true]));
const union = (...objs) => Object.assign({}, ...objs.map(on));
const KEYS = [...QUEST_PICKUPS].filter((id) => id.startsWith('village-key-'));

// The shared slice of a state, as sets ({ key: true }) the document can hold.
export function sharedOf(state) {
  const flags = on(state.flags);
  for (const f of PERSONAL_FLAGS) delete flags[f];
  return {
    flags,
    items: on(state.items),
    parts: on(state.parts),
    devicesLit: Object.fromEntries((state.devicesLit ?? []).map((i) => [String(i), true])),
    taken: Object.fromEntries(Object.keys(on(state.collected)).filter(isQuestPickup).map((id) => [id, true])),
    cleared: on(state.cleared),
  };
}

// Counters that follow from the sets (never stored, so they can't race):
// keys in the bag until the ancient gate takes them, devices lit.
function derive(state) {
  state.keys = state.flags.ancientGateOpen ? 0 : KEYS.filter((id) => state.collected[id]).length;
  state.devices = state.devicesLit.length;
  return state;
}

// The state a character plays a game with: the game's world progress plus my
// own things (hearts, diamonds, upgrades, treats...). Tools are mine to keep
// and the party's to share. My own world progress waits in my save.
export function gameStateFor(save, shared, base) {
  const s = structuredClone(save);
  const personalLoot = Object.fromEntries(Object.entries(save.collected ?? {}).filter(([id]) => !isQuestPickup(id)));
  const keepPersonal = Object.fromEntries([...PERSONAL_FLAGS].filter((f) => save.flags?.[f]).map((f) => [f, true]));
  s.flags = { ...on(shared.flags), ...keepPersonal };
  s.items = { ...base.items, ...union(save.items, shared.items) };
  s.parts = { ...base.parts, ...on(shared.parts) };
  s.devicesLit = Object.keys(on(shared.devicesLit)).map(Number).sort();
  s.collected = { ...personalLoot, ...on(shared.taken) };
  s.cleared = union(save.cleared, shared.cleared);
  s.checkpoint = null; // spawn where the game is, not where I last was
  return derive(s);
}

// What a character keeps after (or during) a game: everything personal as it
// is now, and world progress from both my own adventure and this game.
export function creditSave(own, state) {
  const s = structuredClone(state);
  const mine = sharedOf(own), game = sharedOf(state);
  s.flags = { ...union(mine.flags, game.flags), ...Object.fromEntries([...PERSONAL_FLAGS].filter((f) => state.flags[f]).map((f) => [f, true])) };
  s.items = { ...state.items, ...union(own.items, state.items) };
  s.parts = { ...state.parts, ...union(own.parts, state.parts) };
  s.devicesLit = [...new Set([...(own.devicesLit ?? []), ...(state.devicesLit ?? [])])].sort();
  s.collected = { ...union(state.collected), ...mine.taken };
  s.cleared = union(own.cleared, state.cleared);
  s.checkpoint = own.checkpoint; // my own adventure resumes where I left it
  return derive(s);
}

// What the document has that this state does not yet: [[field, key], ...].
export function newIn(from, to) {
  const out = [];
  for (const field of Object.keys(from)) for (const key of Object.keys(from[field] ?? {})) if (!to[field]?.[key]) out.push([field, key]);
  return out;
}

// Take a friend's progress into my state; returns what changed.
export function applyShared(state, shared) {
  const changes = newIn(shared, sharedOf(state)).filter(([field, key]) => !(field === 'flags' && PERSONAL_FLAGS.has(key)));
  for (const [field, key] of changes) {
    if (field === 'devicesLit') state.devicesLit = [...new Set([...(state.devicesLit ?? []), Number(key)])].sort();
    else if (field === 'taken') state.collected[key] = true;
    else state[field][key] = true;
  }
  derive(state);
  return changes;
}
