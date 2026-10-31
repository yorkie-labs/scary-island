# 2026-10-31 · Island environment (world + assets + physics)

## Intent

A kids' third-person exploration game on a cozy, only-a-little-spooky
Halloween island. This first step builds the **environment** only: the
world, the placed assets and the physics a walking character needs.

- Audience: children. Cute, not scary (no jump scares, no gore).
- Third-person walk/run/jump exploration.
- Web browser game.

Non-goals for this step: quests, score, NPC dialogue, sound, mobile controls.

## Decisions

- Assets: Polyfork **Halloween Night** kit (free low-poly). GLBs + the kit
  terrain module are downloaded into the project by `npm run fetch-assets`
  (licence allows shipping files inside a game; no redistribution as assets).
- Stack (my call): Vite + three.js 0.180 + Rapier (`@dimforge/rapier3d-compat`).
- Ground: the kit terrain program with `edges: 'island'`, a sea plane around it.
- Lighting: Polyfork `stage.mjs` (no tone mapping, authored for these models),
  `golden` hour by default, keys to change time of day.
- Physics:
  - terrain + static props → Rapier trimesh colliders (accurate porches, gates)
  - small props (pumpkins, bales, bins) → dynamic convex hulls, pushable
  - player → kinematic character controller (capsule, autostep, snap-to-ground,
    slope limit), gravity + jump integrated by hand
  - falling into the sea → respawn at last safe ground position
  - NPC kids/animals → fixed capsule colliders, Idle animation
- Player: `kid-in-a-pumpkin`, Polyfork free clips (Idle/Walk/Run) via `clips.mjs`.
- Camera: third-person orbit (pointer lock on click, wheel zoom), ray-cast
  against colliders so it never clips into hills or walls.

## Todo

- [x] Recon polyfork catalog / kit / terrain / helper modules
- [x] Scaffold Vite project (package.json, index.html, src/)
- [x] `scripts/fetch-assets.mjs` downloads GLBs + vendor modules
- [x] Terrain + sea + lighting
- [x] Layout: hero buildings on flat areas, clusters, scatter
- [x] Physics world: terrain/static/dynamic colliders, debug view
- [x] Player controller + animation + respawn
- [x] Third-person camera with collision
- [x] HUD (controls help, FPS)
- [x] Unit tests for pure helpers (vitest)
- [x] Verify in browser (walk, jump, push pumpkin, fall-into-sea respawn)

## Review

Verified 2026-10-31 in Chrome against `npm run dev`, plus `npm test` (18 passing).

- Walk: 4.4 m in 2 s at walk speed 2.2 m/s, camera-relative.
- Jump: peak 1.42 m, lands grounded.
- Push: walking into a scattered jack-o-lantern moved it 2.3 m.
- Sea: teleporting into the sea respawns at the last safe ground with a toast;
  props knocked into the sea return home.
- R returns to the spawn point. T cycles time of day. P shows colliders, O shows the overview.
- No console errors; 60 fps; 151 placements, 25 dynamic bodies.
- `test/island.test.js` checks the layout against the real kit terrain: every cluster
  finds a site, nothing stands below the sea, the spawn is dry and gentle.

Calls I made along the way: sea level -3.3 m; cluster radii (village 12, farm 9,
cemetery 9, witch camp 6, corn maze 8); the cemetery shrank to a 12 x 12 m fence
so all five clusters fit; static props use their own triangles as colliders.

Possible next steps: the large outer parts of the island are still sparse; night
emissive windows (`night` maps) are not applied; Polyfork animation clips are
loaded from the CDN, so the game needs network access.
