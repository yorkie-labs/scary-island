# 2026-11-01 · Co-op multiplayer with Yorkie (Diablo II style)

Goal (user): a multiplayer menu and co-op play for up to 10 friends, synced with
Yorkie (https://yorkie.dev) on **Yorkie Cloud**, shaped like Diablo II's
Battle.net games: your character is yours, a game is a one-off session you create
or pick from a list, and it ends when everyone has left.

Lessons: [20261031-scary-island-gdd-lessons.md](20261031-scary-island-gdd-lessons.md)

## Model: Diablo II → Scary Island

| Diablo II | Scary Island |
|---|---|
| Character keeps level, items, quests | **My Yorkie** = the existing localStorage save (+ a profile: nickname, fur colour) |
| Create game: name, password, max players | **게임 만들기**: preset name, 🔒 secret (code only) or public, max 10 |
| Game list lobby | **게임 목록**: public games with name, players, creator, stage |
| Game vanishes when the last player leaves | One-off game; the creator can also close it early |
| World follows the creator's progress | The world starts from the **creator's shared progress** |
| Quest credit for the party | Anything the game achieves (flags, parts, tools, cleared stages) is **saved to every participant's character** |
| Monsters and drops are new each game | Monsters are shared. Loot (treats, chests, ore, diamonds, potions) is **personal**: each player sees and collects their own |
| `/players X` scaling | Monsters get tougher with player count |
| Party | Everyone is in one party, no PvP |

## Decisions

- **Server**: Yorkie Cloud, public API key in `VITE_YORKIE_API_KEY` in a committed
  `.env` (public by design; Vite reads it in dev and in the Pages build).
- **Character**: one save slot, as today. Solo play and co-op use the same
  character, and progress made in a friend's game stays yours. A new `profile`
  field holds the nickname and colour, both picked from presets. There is no free
  text and no chat (a kids' game): friends bark and emote.
- **Rushing is allowed**: a new player in a stage-3 game gets the stage 1–3 credit
  too. A player with no `awake` flag sees a short intro card before joining.
- **Shared vs personal state**:
  - *Game (shared)*: `flags`, `parts`, `items` (party tools), `devicesLit`,
    `cleared`, quest pickups (tools, parts, keys) in `taken`. Counters such as
    `keys` and `devices` are derived from sets, never stored as plain numbers that
    two players could bump at once.
  - *Character (personal)*: hearts, potions, diamonds, upgrades, treats,
    treasures, loot pickups in `collected`, checkpoint, playTime.
  - Every pickup id and one-shot interactable is classified as quest or loot in
    one table (`src/net/share.js`). Anything not in the table is personal.
- **World inside a game** = the game's shared fields + my personal fields. My own
  save may be further ahead than the game. That progress is kept, never shown in
  this game, and never lost: on save the character gets
  `union(my save's shared fields, game shared fields)` + my personal fields.
- **Spawn**: joiners spawn at camp if the game has it, else on the beach.
  Fainting respawns at an in-game checkpoint, which is personal and reset on join.
- **Owner vs host**:
  - *Owner* = the creator. The world starts from their progress, and they can
    close the game early. That is the owner's only power, so there is no kick.
  - *Host* = the client that simulates monsters: the owner while connected,
    otherwise the player with the smallest `playerId`. Hand-over happens on every
    presence change.
- **Size**: 10 players. If two joins race past 10, the players with the latest
  `joinedAt` leave with a kind message.
- **Scaling**: monster HP and stun times ×(1 + 0.2·(players − 1)). Tune in playtest.
- **Game end**: when the last player leaves, they remove the game Document and its
  lobby entry. If the owner closes early, they remove the Document: everyone else
  gets the `removed` status, a card, and returns to the title. Crashed games
  drop out of the lobby by heartbeat. An orphaned Document in Cloud is harmless.

## Data model

```
Lobby document  scary-island-lobby
root.games = { <gameId>: { name, owner, ownerName, players, stage, createdAt, lastSeen } }
             // public games only; host heartbeats lastSeen every 30 s,
             // any lobby viewer deletes entries older than 90 s
presence   = { name, color }                     // friends browsing the lobby

Game document   scary-island-game-<gameId>     (gameId ↔ 4-emoji code)
root = {
  meta:   { owner, name, secret, createdAt, version: 1 },
  shared: { flags:{}, parts:{}, items:{}, devicesLit:{}, cleared:{}, taken:{} },
}
presence = { id, name, color, joinedAt, x, y, z, heading, action, speed, hidden,
             light, hearts, region, host,
             enemies?: [[idx, x, y, z, heading, state], ...] }   // host only
Game channel    scary-island-game-<gameId>-ch  (Channel, NOT the doc key: see findings)
broadcast  'hit' (to host: enemyIdx, point, dir) · 'noise' · 'bark' · 'emote'
```

- Presence is sent on change, at most 8 Hz. Remote Yorkies interpolate.
- The host sends only active monsters or ones near a player.

## Code shape

- `src/net/client.js` is the only file that imports `@yorkie-js/sdk`. It handles
  activate, attach and detach, presence throttle, broadcast, and remove.
- `src/net/lobby.js` handles the lobby Document: list, register, heartbeat, stale
  sweep, and the presence of friends browsing.
- `src/net/game.js` handles the game Document: create from the owner's save,
  join, leave, close, host election, size limit, and the bridge to `G`.
- `src/net/share.js` holds pure functions, unit-tested:
  - classification table
  - `gameStateFor(save, shared)`
  - `creditSave(save, shared)`
  - `applyRemoteShared(state, shared)` → changes
  - `electHost`, `overflow`, `monsterScale`, `staleGames`, and the code ↔ id mapping
- `src/entities/friends.js` holds remote Yorkies. It uses `createYorkie()` +
  `createYorkieAnimator` with a fur tint, a name tag (`labels.js`), and a
  silhouette.
- `src/ui/lobby.js` holds the lobby screens (DOM, like `screens.js`).
- **Boot**: entering a game reloads with `?game=<id>`, the same reload pattern as
  `startOver`. `boot()` attaches the game Document *before* `createGame` and the
  region builders, so the world is built straight from `gameStateFor(...)`.
- **In-game writes**: `setFlag`, quest pickups, parts, and devices go to
  `doc.update`. Personal changes only go to the local save.
  `G.refresh()` saves through `creditSave`.
- **Remote changes**: `applyRemoteShared` writes into `G.state`. It removes taken
  quest pickups, emits `flag` for new flags (doors, nav cache and statues react as
  for local flags), refreshes the HUD, and saves the credit. A dialogue or
  cutscene plays only for the player who triggered it. Others get a toast
  ("🐶 Jiyu found the engine part!"), and the world never pauses for anyone
  else's dialogue.
- **Monsters**: `G.targetFor(pos)` returns the nearest visible player, local or
  friend, in place of `G.player` in every enemy.
  - Only the host runs enemy `update`, and the others apply the host's transforms.
  - Damage is checked locally against the replicated monster positions.
  - A non-host hammer hit on a monster is broadcast as `'hit'` to the host.

## Menu flow

```
Title ─ 혼자 하기 ────────────────────────────── (today's game)
      └ 같이 하기 ─ profile (first time: nickname + colour)
                   └ Lobby: game list (name · 👥 3/10 · 👑 creator · STAGE 2)
                            [게임 만들기] → preset name, 🔒 secret? → enter
                            [코드로 들어가기] → 4 emoji → enter
                            tap a game → enter
In game, Esc menu: players (👑 owner, 🎮 host), code + copy link,
                   나가기, 게임 닫기 (owner, two-press confirm)
```

## Steps (each: build → test → headless check)

- [ ] 0. Setup
  - [x] `VITE_YORKIE_API_KEY` in `.env` (user)
  - [x] `npm i @yorkie-js/sdk` (0.7.25, Apache-2.0), README credits
  - [x] verify the real SDK API against Yorkie Cloud (two headless Chrome clients, see findings)
- [x] 1. Lobby and friends visible
  - [x] save `profile` (id, preset nickname, hoodie colour). Old saves get one on first co-op
  - [x] lobby Document: list, register, heartbeat, stale sweep
        (browsing friends' presence is left out for now)
  - [x] create (public or secret) and join (list, code pad, `?game=` link)
  - [x] boot from `?game`: attach, write `meta` + `shared` on create, spawn
  - [x] full, missing and taken games → friendly message, back to lobby
  - [x] friend Yorkies: hoodie tint, name tag, silhouette, interpolation, replayed moves
        (a bark is heard nearby), minimap dots
  - [x] Esc menu: code, copy link, players (👑 owner), leave, owner close (two-press)
  - [x] leave, owner close (others get `removed` → card → title), last-one-out removal
  - Notes: the SDK loads only on 같이 하기 (a separate 107 kB gz chunk). No Channel
    yet: moves ride on presence (`an` counter), and Channel comes in step 3 for `'hit'`.
    The game doc's `shared` is written but not read yet (step 2).
- [x] 2. Shared world and quest credit
  - [x] `share.js` + tests: `sharedOf`, `gameStateFor`, `creditSave`, `applyShared`, derived `keys`/`devices`
  - [x] audit (subagent) of all 34 flags: 12 need a world apply, 4 are personal
  - [x] the game is joined **before** the island is built (`main.js`), so the island is the game's
  - [x] local progress → `G.on('progress')` diff → `pushShared`; remote → `applyShared` →
        `G.removePickup`, `emit('flag')`, `emit('shared')` → region listeners
  - [x] region listeners: stone door, engine crate, vines, generator, mine door,
        forest statues, golem + crystal, cart gate, village door, ancient gate,
        guardian / devices / seal / ship key, boat
  - [x] mine cart stays rideable from the station side after a friend's ride (no lock-out)
  - [x] friend news toasts. The stage card goes to the whole party. Stage 5 (the
        escape) is a toast instead: everyone boards their own boat
  - [x] save = `creditSave(own, state)` through `setSaveTransform`
  - [x] joiners spawn at the camp once the game has it
  - Notes: a character's own tools stay theirs and are not given to the party.
    The owner's tools at creation are the game's (party) tools. Builders skip
    a tool pickup the character already owns (e.g. scissors), so a veteran
    may not see it lying there.
  - Known gaps for step 3: `finalChase` and every monster are still local, so
    a friend's harbor chase shows no monsters here.

- [x] 3. Monsters
  - [x] host election + hand-over (owner first). A new host picks up from the drawn poses
        (movers are moved to where the puppets stand)
  - [x] `G.targets()` / `G.nearestTarget()` / `G.hurtTarget()`: rocky, watcher, mushy, golem
        and guardian go after the nearest Yorkie. Friends are proxies with `G.player`'s shape
  - [x] the host runs `update`; everyone else runs `puppet` (glide to the host's pose and play
        the looks). Each monster has `snap`/`apply`/`puppet`, plus `fx` for puffs and rocks.
        Snapshots go out at 10 Hz (only what changed, plus everything every 2 s)
  - [x] to the host: hammer hits (`'hit'`, with the hitter's position for the golem's back),
        wake / start / freeze / blow / chase start and end (`G.toHost`, allowlisted), barks
        and hammer noise (`'noise'`). The hitter sees the effect at once; it runs on the host
        quietly (no toasts meant for the hitter)
  - [x] the host tells who got hurt (`'hurt'`); the receiver checks the hit is really close
        (< 3.5 m) to where it stands. **Changed from the plan**: damage is decided by the host
        and checked by the receiver, not computed by each client, which keeps a single brain
  - [x] Watcher and Guardian: frozen or slowed when *any* Yorkie looks.
        Only my own look plays Yorkie's line about it
  - [x] player-count scaling: Rocky and Golem HP ×(1 + 0.2·friends)
  - [x] with friends around, a faint no longer resets every monster on the island
  - [x] harbor: removed the duplicated `ghost.reset` wrapping (an old bad merge), and the
        final chase start and end reach the host
  - [x] (user) **Esc menu doesn't pause when playing together**, like Diablo II.
        `G.running()` / `G.ticking()`: in co-op the menu and shop leave the world running
        (monsters, my chase / collapse / cart clocks) and I can still be hurt. The title
        reads "메뉴 (게임은 계속돼요!)". A faint closes the menu. Solo still pauses
        (checked: monsters frozen, not hurtable, resumes)

- [ ] 4. Polish
  - [ ] reconnect after sleep or offline. Host hand-back
  - [ ] 10 players: draw calls, presence rate, phones
  - [ ] co-op touches (revive a fainted friend? two-player door?): ask Jiyu
- [ ] 5. Verify
  - [ ] `npm test`, `npm run build`, solo `full.js` still passes
  - [x] `scripts/coop.mjs` (3 headless profiles): 29 checks covering lobby, joining, shared
        progress, loot, credit, monsters, hit and hurt, owner close, secret game and host
        hand-over. The items below were the plan for it:
    - [ ] create, see the game in the list, join by list and by code
    - [ ] quest pickup syncs, but loot stays personal
    - [ ] credit lands in each save
    - [ ] host hand-over when the owner tab closes
    - [ ] owner closes the game, and the last one out removes it
  - [ ] staff-engineer pass, then this file's Review section

## SDK findings (step 0, @yorkie-js/sdk 0.7.25 on Yorkie Cloud)

- `new Client({ apiKey })` defaults to `rpcAddr: https://api.yorkie.dev` (Cloud).
- Works in Chrome: attach with `initialRoot` / `initialPresence`, `doc.update((root, p) => …)`,
  `subscribe` → `remote-change`, `subscribe('others')` → `presence-changed`,
  `getOthersPresences()`.
- **Broadcast moved off the Document**: in 0.7.x it lives on `Channel`
  (`client.attach(new Channel(key))`, `ch.broadcast(topic, payload)`,
  `ch.subscribe('broadcast')`), which also gives `getSessionCount()`.
  `client.peekChannel(key)` reads a channel's count without joining, which the
  lobby can use to show player counts.
- **A Channel with the same key as a Document breaks `client.remove(doc)`**
  (`[not_found] Document …`). With a different key it works. This looks like a
  server-side key collision, worth an issue on Yorkie. Use the `-ch` suffix.
- `client.remove(doc)` works while others are attached. They get
  `subscribe('status')` → `removed`, so "owner closes the game" needs no extra
  `meta.closed` flag. A new attach to that key afterwards starts a fresh doc.
- Numbers outside int32 (e.g. `Date.now()`) are stored as Long with a `YORKIE W`
  warning, and they come back as bigint. Store times as `new Date()` instead. Note
  that `toJS()` returns a Date as an **ISO string**, so read times through
  `share.js` `ms()`. Presence is plain JSON and is not affected.
- **`await client.attach(channel)` resolves before the channel is `attached`**
  (it is `detached` for a moment), so an early `channel.broadcast` throws `channel is not
  attached: detached`. We wait for `isAttached()`, and `net.broadcast` never throws.
  Worth an issue on Yorkie.
- Node cannot connect (`HTTP 464` from the Cloud load balancer: Node's fetch
  speaks HTTP/1.1). All Yorkie tests run in headless Chrome. Vitest covers only
  the pure `share.js`.

## Quest vs loot table (step 2, for Jiyu to check)

| Kind | What | In a game |
|---|---|---|
| Quest pickups (shared) | hammer, scissors, flashlight, engine, energy crystal, ship key, village keys ×3 | one per game, gone for everyone once taken, everyone gets it |
| World progress (shared) | doors, vines, generator, statues asleep, golem, cart gate, devices, seal, boat repairs, stage clears | everyone's world changes, everyone gets the credit |
| Loot (personal) | treats, potions, mine diamonds, ore diamonds, chests, heart snacks | each player has their own |
| Personal moments | intro (`awake`), first elevator (`inMine`), boarding and ending (`boarded`, `escaped`) | never shared |
| Personal | hearts, diamonds, upgrades, checkpoint, nickname and hoodie | never shared |

## Open questions (for Jiyu)

- Party tools vs personal tools: the plan says party tools.
- More than one character slot later?
- Co-op-only touches: revive a friend, doors that need two Yorkies.

## Review

(to fill when done)
