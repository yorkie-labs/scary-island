# 2026-10-31 · Build Scary Island from the GDD

Goal (user, /goal): go through the scenario one piece at a time, check it, and
repeat until the game is built.

Source of truth: the GDD the user pasted (v1.0, "SCARY ISLAND — Find the Way Out!").
Director/story/monsters belong to the daughter; every call below that the GDD
left open or contradicted is marked **[call]** so she can overrule it.

## Calls on GDD inconsistencies

- **[call] Yorkie** is built in code: a chibi bipedal Yorkie (golden-orange and dark
  brown fur, big brown eyes, sky-blue hoodie, black cargo pants, black/white
  sneakers, big wooden hammer). Procedural animation (idle, walk, run, jump,
  roll, swing, bark, sniff, hurt). No catalog Yorkie exists.
- **[call] Hammer**: washed ashore from the wreck; Stage 1 "find the hammer" stays.
- **[call] Escape parts**: engine part = inside the beach wreck (Stage 1),
  fuel can + generator part = forest hut (Stage 2), energy crystal = mine (Stage 3),
  ship key = village (Stage 4). Collectibles list includes all of them.
- **[call] Structure**: hub. Camp in the middle; gates open in GDD order
  (beach → camp → forest → mine → village → harbor), every region revisitable.
- **[call] Last stage name**: "Escape Harbor" (region) for Stage 5 "Escape Island".
- **[call] Seal**: lives in Statue Village (Guardian arena); releasing it lifts
  the magic barrier on the harbor road.
- **[call] Camp**: checkpoint, full heal, parrot "Polly" shop (diamonds → upgrades).
- **[call] Diamonds** are the currency for the four upgrades.
- **[call] Controls**: Shift hold = run, Shift tap = roll (dodge). Left click =
  use selected tool (hammer swing / scissors / flashlight / potion). 1-4 select.
  E = interact, Q = sniff, B = bark, F = flashlight toggle shortcut.
- **[call] No knife/sword**: hammer bonks and tools only, monsters fall asleep
  (matches "Crystal Golem turns into a sleeping pebble"). Shield and smoke bomb
  deferred.
- **[call] Mushy** is countered by wind fans placed in the forest (E to switch on).
- **[call] Watcher** in Stage 2: keep it in view. Flashlight (Stage 4) freezes it
  even after you look away.
- **[call] Stars**: 1 = stage cleared, 2 = stage treasure chest found,
  3 = chest + all 3 hidden treats.
- **[call] Mine** is an underground cavern reached by an elevator (fade transition).

## Build order (each step: build → verify in browser → check against GDD)

- [x] A. Core + MVP / Stage 1 Lost Beach (GDD §13 DoD 1-7)
  - [x] island terrain with regions, ridges, passes, sea
  - [x] Yorkie model + procedural animation
  - [x] player abilities: walk/run/roll/jump/swing/bark/sniff, hearts, i-frames
  - [x] game state, inventory, quests, save/load, checkpoints
  - [x] HUD: hearts, minimap, item slots, mission text, diamonds, toasts, dialogue
  - [x] interactables: pickups, ore nodes, stone door w/ diamond sockets, hide bushes
  - [x] Rocky AI (disguised, wakes, chases, loses you, stunned by hammer)
  - [x] beach content + treats + treasure + engine part
  - [x] title + intro story; WebAudio SFX
- [x] B. Camp + Stage 2 Whispering Forest (scissors, vines, Watcher, Mushy, fans,
      hut, generator, mine door) + parrot shop/upgrades
- [x] C. Stage 3 Diamond Mine (elevator, ores, collapse run, cart chase, Crystal Golem)
- [x] D. Stage 4 Statue Village (flashlight, 3 keys, ancient gate, Island Guardian,
      3 crystal devices, seal)
- [x] E. Stage 5 Escape Harbor (repair 4 parts, final chase, boat, ending "THE END?")
- [x] F. Polish: stars/results, pause, music, mobile joystick, balance
- [x] G. Full scripted playthrough start → ending; GDD checklist pass

## Review

- A (2026-10-31): scripted run in Chrome — intro → wreck → hammer → 3 ores → Rocky
  wakes/chases, 2 bonks stun → planks → engine → door sockets → camp, Stage 1 card.
  Fixes found by the run: spawn was under water (coast profile rewritten), planks
  inside the wreck collider (moved), engine step removed from Stage 1 so its
  missions match the GDD (engine is re-checked in Stage 5).
- B (2026-10-31): scissors → vines → Watcher (still when on screen 0.01 m, moves
  0.78 m/s-ish when off screen) → fans blow Mushy → hut parts → generator → mine
  door, Stage 2 card.
- C (2026-10-31): mine scenario — elevator, ore, collapse run, cart chase with
  beam jumps, golem (stun → hit back crystal ×3 → pebble), energy crystal.
  Bugs found: negative cell modulo crashed the cave build; triggers enabled while
  the player already stood inside never fired (fixed in game.js); Rocky homes
  took the island height underground (y option).
- D (2026-10-31): village scenario — crystal door, flashlight freeze (3.6 s left
  after 0.4 s), keys, ancient gate, guardian, 3 devices, seal, ship key.
  Bug found: spending the keys re-opened the "collect keys" step (fixed).
- E (2026-10-31): harbor scenario — check, engine, fuel, crystal, 25 s warm-up
  chase, board, ending, THE END?, credits with the GDD §14 team.
- F: outlines on Yorkie and monsters (GDD §10.1), squeeze-through gap (§11.1),
  pause on pointer-lock loss, pooled lights (8 real lights), invisible ridge
  walls after the ridge test found two climbable ridges, boss intro cameras.
- G (2026-10-31): `npm run playtest` — new game → credits in one headless run:
  all 5 stages cleared, hiding works (Rocky returns home), sniff finds 4–5 things.
  Script-only failures along the way (sniff cooldown eating a swing, too few
  golem rounds) were fixed in the script, not the game. A real gameplay fix came
  out of it: a faint in the collapsing tunnel now restarts at the tunnel mouth.

## GDD checklist

| GDD | Status |
|---|---|
| §1 pillars: explore, survive, fight, collect, escape | all five present |
| §2 story, goal list, ending "THE END?" with blinking pebble | done |
| §3 Yorkie look; walk, run, jump, dodge, attack, sniff, bark | done (procedural model) |
| §4 5 stages, hub camp, revisit | done; gates in GDD order |
| §5 stage missions | as listed (Stage 1 engine part moved to an item, re-checked in Stage 5) |
| §6 Rocky, Watcher, Mushy, Crystal Golem, Island Guardian | done |
| §7.1 hammer, scissors, flashlight | done; knife/shield/smoke bomb **[call] left out** |
| §7.2 3 hearts, food & potions, checkpoints, camp heal | done |
| §8 collectibles, 4 upgrades, 3 treats per stage, 1–3 stars | done |
| §9 HUD layout, PC + mobile input | done (touch joystick basic) |
| §10 cartoon look, outlines, region palette, sound | done (synth audio) |
| §11 dog abilities (sniff, bark, small gaps) | done |
| §13 MVP DoD 1–7 | done (Stage 1) |
