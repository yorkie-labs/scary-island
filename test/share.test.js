import { describe, it, expect } from 'vitest';
import {
  MAX_PLAYERS, STALE_MS, CODE_EMOJIS, randomGameId, isGameId, idToCode, codeToId,
  electHost, mustLeave, staleGames, lobbyRows, randomName, isPresetName, safeName, safeColor, HOODIE_COLORS,
  sharedOf, gameStateFor, applyShared, newIn, isQuestPickup,
} from '../src/net/share.js';
import { newState } from '../src/core/state.js';

describe('game codes', () => {
  it('every id maps to 4 animals and back', () => {
    for (const id of ['0000', 'ffff', 'a3c9', randomGameId()]) {
      expect(isGameId(id)).toBe(true);
      const code = idToCode(id);
      expect(code).toHaveLength(4);
      expect(code.every((e) => CODE_EMOJIS.includes(e))).toBe(true);
      expect(codeToId(code)).toBe(id);
    }
  });
  it('rejects codes that are short or have strangers in them', () => {
    expect(codeToId(['🐶', '🐱', '🐰'])).toBe(null);
    expect(codeToId(['🐶', '🐱', '🐰', '🍕'])).toBe(null);
    expect(isGameId('ABCD')).toBe(false);
    expect(isGameId('../x')).toBe(false);
  });
});

describe('host election', () => {
  const players = [{ id: 'm' }, { id: 'c' }, { id: 'x' }];
  it('the owner hosts while here', () => expect(electHost(players, 'x')).toBe('x'));
  it('else the smallest id, the same on every client', () => {
    expect(electHost(players, 'gone')).toBe('c');
    expect(electHost([...players].reverse(), 'gone')).toBe('c');
  });
  it('nobody hosts an empty game', () => expect(electHost([], 'x')).toBe(null));
});

describe('a full game', () => {
  const crowd = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${String(i).padStart(2, '0')}`, joinedAt: 1000 + i }));
  it('nobody leaves at the limit', () => {
    expect(crowd(MAX_PLAYERS).some((p, _, all) => mustLeave(all, p.id))).toBe(false);
  });
  it('only the latest arrivals leave when two join at once', () => {
    const all = crowd(MAX_PLAYERS + 2);
    const leaving = all.filter((p) => mustLeave(all, p.id)).map((p) => p.id);
    expect(leaving).toEqual(['p10', 'p11']);
  });
  it('a tie on joinedAt is broken by id', () => {
    const all = [...crowd(MAX_PLAYERS), { id: 'aa', joinedAt: 1009 }];
    expect(mustLeave(all, 'p09')).toBe(true);
    expect(mustLeave(all, 'aa')).toBe(false);
  });
});

describe('lobby', () => {
  const now = 1_000_000;
  const games = {
    old: { name: 'a', players: 2, createdAt: 1, lastSeen: now - STALE_MS - 1 },
    busy: { name: 'b', players: 6, createdAt: 2, lastSeen: now - 1000 },
    quiet: { name: 'c', players: 1, createdAt: 3, lastSeen: now },
    full: { name: 'd', players: MAX_PLAYERS, createdAt: 4, lastSeen: now },
    broken: { name: 'e' },
  };
  it('entries not refreshed lately are stale', () => expect(staleGames(games, now).sort()).toEqual(['broken', 'old']));
  it('lists fresh games, busiest first, full ones last', () => {
    expect(lobbyRows(games, now).map((r) => r.id)).toEqual(['busy', 'quiet', 'full']);
    expect(lobbyRows(games, now).at(-1).full).toBe(true);
  });
  it('an empty lobby is fine', () => expect(lobbyRows(undefined, now)).toEqual([]));
  it('reads times stored as Dates (the Yorkie Date primitive)', () => {
    const dated = { a: { lastSeen: new Date(now - 1000), createdAt: new Date(1) }, b: { lastSeen: new Date(now - STALE_MS - 1) } };
    expect(staleGames(dated, now)).toEqual(['b']);
    expect(lobbyRows(dated, now).map((r) => r.id)).toEqual(['a']);
  });
  it('reads them back as ISO strings too (what toJS() gives)', () => {
    const iso = { a: { lastSeen: new Date(now - 1000).toISOString() }, b: { lastSeen: 'nonsense' } };
    expect(staleGames(iso, now)).toEqual(['b']);
  });
});

describe('names and colours are presets only', () => {
  it('random names are presets', () => {
    for (let i = 0; i < 20; i++) expect(isPresetName(randomName())).toBe(true);
  });
  it('anything else shows as 친구', () => {
    expect(safeName('나쁜 말')).toBe('친구');
    expect(safeName('용감한 토끼 <b>')).toBe('친구');
    expect(safeName(42)).toBe('친구');
    expect(safeName('용감한 토끼')).toBe('용감한 토끼');
  });
  it('unknown colours fall back to the sky-blue hoodie', () => {
    expect(safeColor('#123456')).toBe(HOODIE_COLORS[0]);
    expect(safeColor(HOODIE_COLORS[3])).toBe(HOODIE_COLORS[3]);
  });
});

describe('shared progress (Diablo II style)', () => {
  const veteran = () => {
    const s = newState();
    Object.assign(s.flags, { awake: true, doorOpen: true, campReached: true, vinesCut: true });
    Object.assign(s.items, { hammer: true, scissors: true });
    s.parts.engine = true;
    Object.assign(s.collected, { hammer: true, engine: true, scissors: true, 'treat-b1': true, 'potion-1': true });
    s.cleared[1] = true;
    s.diamonds = 12; s.upgrades.shoes = true;
    s.checkpoint = { x: 1, y: 2, z: 3, region: 'forest' };
    return s;
  };
  const newbieGame = () => sharedOf(Object.assign(newState(), { flags: { awake: true } }));

  it('only quest pickups are shared; loot is personal', () => {
    expect(isQuestPickup('hammer')).toBe(true);
    expect(isQuestPickup('village-key-2')).toBe(true);
    expect(isQuestPickup('treat-b1')).toBe(false);
    expect(isQuestPickup('mine-gem-3')).toBe(false);
    expect(sharedOf(veteran()).taken).toEqual({ hammer: true, engine: true, scissors: true });
  });

  it("a character back after a refresh: the world is the game's, its things are its own", () => {
    const s = gameStateFor(veteran(), newbieGame(), newState());
    expect(s.flags).toEqual({ awake: true }); // the stone door is shut in this game
    expect(s.parts.engine).toBe(false);
    expect(s.items.hammer).toBe(true); // but I keep my tools
    expect(s.collected.hammer).toBeUndefined(); // so the hammer still lies on the beach for the party
    expect(s.collected['treat-b1']).toBe(true); // my treats stay found
    expect(s.diamonds).toBe(12);
    expect(s.upgrades.shoes).toBe(true);
    expect(s.checkpoint).toBe(null);
  });

  it("a new Yorkie in a game: nothing of its own, the party's tools and progress", () => {
    const play = gameStateFor(newState(), sharedOf(veteran()), newState());
    expect(play.flags.doorOpen).toBe(true);
    expect(play.items.hammer).toBe(true); // party tools
    expect(play.diamonds).toBe(0);
    expect(play.collected['treat-b1']).toBeUndefined();
  });

  it("applies a friend's progress once, and reports what changed", () => {
    const s = gameStateFor(newState(), newbieGame(), newState());
    const friend = sharedOf(s);
    friend.flags.doorOpen = true; friend.taken.hammer = true; friend.items.hammer = true; friend.devicesLit['1'] = true;
    const changes = applyShared(s, friend);
    expect(changes).toEqual(expect.arrayContaining([['flags', 'doorOpen'], ['taken', 'hammer'], ['items', 'hammer'], ['devicesLit', '1']]));
    expect(s.collected.hammer).toBe(true);
    expect(s.devicesLit).toEqual([1]);
    expect(s.devices).toBe(1);
    expect(applyShared(s, friend)).toEqual([]);
  });

  it('keys follow the key pickups, and the gate spends them', () => {
    const s = newState();
    const shared = sharedOf(s);
    shared.taken['village-key-0'] = true; shared.taken['village-key-2'] = true;
    applyShared(s, shared);
    expect(s.keys).toBe(2);
    shared.taken['village-key-1'] = true; shared.flags.ancientGateOpen = true;
    applyShared(s, shared);
    expect(s.keys).toBe(0);
  });

  it('newIn lists only what is missing', () => {
    expect(newIn({ flags: { a: true, b: true } }, { flags: { a: true } })).toEqual([['flags', 'b']]);
  });
});
