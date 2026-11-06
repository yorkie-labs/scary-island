# SCARY ISLAND — Find the Way Out!

A cute-spooky 3D adventure for families, built from the Game Design Document:
Yorkie the Yorkie washes up on Scary Island, explores five regions, outwits rock
monsters, statues and mushroom ghosts, repairs a boat and escapes.
three.js + Rapier, low-poly assets from [Polyfork](https://polyfork.dev).

**Play:** https://yorkie-labs.github.io/scary-island/

## Run

```bash
npm install
npm run fetch-assets   # Polyfork GLBs + stage.mjs (not committed)
npm run dev            # http://localhost:5173 (game), /gallery.html (characters, dev only)
npm test               # unit tests (map, quests, state, movement)
npm run playtest       # headless full playthrough, new game → ending (dev server must run)
```

## Controls (kept simple, Diablo-style)

| Input | Action |
|-------|--------|
| left click | ground: walk there (hold to keep following) · monster/ore: bonk with the hammer · item/door/device: walk up and use |
| right click | flashlight toward the cursor (freezes statues; battery orb) |
| 1 | sniff: a scent ring rolls out; things it reaches sparkle and get name tags (click a tag to go there) |
| 2 | roll toward the cursor (learned from the 1st dog treat) |
| 3 | jump (learned from the 2nd dog treat) |
| 4 | drink a heart potion |
| Space | use the nearest thing · next line of a dialogue · hop in the mine cart |
| Tab | island map · wheel zoom · Esc menu |

Phones and tablets get a joystick and buttons for all of the above (flashlight and menu included).

## The five stages (GDD §5)

1. **Lost Beach** — wake by the wreck, find the hammer, mine 3 diamonds, wake
   Rocky (run, hide in flower bushes, or bonk twice), open the stone door.
2. **Whispering Forest** — scissors → vines, Watchers move only when you
   look away, wind fans blow Mushy away, hut parts, generator, mine door.
3. **Diamond Mine** — elevator down, ore, a collapsing tunnel, a mine-cart
   chase (jump the beams), the Crystal Golem (hit the crystal on its back
   while it is dizzy), the energy crystal.
4. **Statue Village** — the crystal opens the door, flashlight freezes
   statues, 3 keys, the ancient gate, the Island Guardian and 3 crystal
   devices; the seal breaks and you get the ship key.
5. **Escape Island** — fit engine, fuel and crystal, hold out while the
   engine warms up as the monsters come, board, sail away… THE END?

Every stage hides 3 dog treats and a treasure chest (stars, GDD §8.3).
Diamonds buy upgrades from Polly the parrot at the camp (GDD §8.2).

## Code map

- `src/world/map.js` — the island: regions, ridges, gates, roads, heights (pure)
- `src/world/regions/*.js` — one builder per stage + the camp
- `src/entities/` — Yorkie, Rocky, Watcher, Mushy (+ fans), Crystal Golem
- `src/core/quests.js` — GDD missions as data; `state.js` — save, stars, upgrades
- `src/core/game.js` — interactables, pickups, triggers, hits, lights, dialogue
- `src/player/` — controller, movement maths, camera; `src/systems/flashlight.js`
- `src/ui/` — HUD, minimap, menus, shop, touch; `src/audio/sound.js` — synthesised sound
- `scripts/e2e.mjs` + `scripts/scenarios/` — headless playtests

Design decisions the GDD left open are listed in
`tasks/20261031-scary-island-gdd-todo.md` (each marked **[call]**).

## Build & deploy

```bash
npm run build          # → dist/ (static files, relative paths: any sub-folder works)
npm run preview        # serve dist/ locally to check it
```

`dist/` is a plain static site (about 7 MB, mostly the bundled Jua font):
upload it to any static host. This repository deploys itself: every push to
`main` runs `.github/workflows/pages.yml` (tests, build, GitHub Pages). The game needs WebGL; it tells players kindly if
their browser has none.

## Asset licence

Polyfork low-poly models are free for games; shipping them inside the game is
fine, redistributing the raw files as assets is not. See https://polyfork.dev/licensing.

So the production build does **not** contain the GLB files: the game loads
them from the Polyfork CDN (`https://polyfork.dev/cdn/<id>.glb`), and
`vite build` deletes `dist/assets/polyfork`. The dev server uses the local
copies from `npm run fetch-assets`. Only if you have permission to self-host,
build with `VITE_SELF_HOST_MODELS=1 npm run build`.

## Credits

- Story & direction: Jiyu (daughter) · Hackerwins (dad)
- 3D models: [Polyfork](https://polyfork.dev) (loaded from the Polyfork CDN at runtime; the files are not in this repository)
- Font: [Jua](https://fonts.google.com/specimen/Jua) (SIL Open Font License, via `@fontsource/jua`)
- Engine: [three.js](https://threejs.org), physics: [Rapier](https://rapier.rs), post-processing: [postprocessing](https://github.com/pmndrs/postprocessing) (zlib) and [N8AO](https://github.com/N8python/n8ao) (ISC)
- Multiplayer sync: [Yorkie](https://yorkie.dev) (Apache-2.0, via `@yorkie-js/sdk`, on Yorkie Cloud)
