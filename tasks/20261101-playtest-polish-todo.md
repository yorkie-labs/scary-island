# 2026-11-01 · Playtest polish (after co-op)

Goal (user): fix what came up while playing on desktop and an iPhone 12, one
request at a time. Each item was checked headless (phone emulation with real
touch events where it mattered), then committed on its own.

Lessons: [20261031-scary-island-gdd-lessons.md](20261031-scary-island-gdd-lessons.md)

## Co-op follow-ups

- [x] No 게임 닫기: games end when the last player leaves (Diablo II). Menu actions moved to the top
- [x] Every game starts on an empty island, and everyone plays a new Yorkie. The solo save is
      untouched, the game's character is kept per tab, and a refresh rejoins
- [x] The Esc menu doesn't pause the world while playing together

## Talk and help

- [x] Talk doesn't stop the game (Diablo III): a speech panel above the bar, tap/Enter to skip;
      `{ stop: true }` only for the intro, the boss reveals, the seal, the last chase and the ending
- [x] Help lines: tip cards on the beach; after the camp, Polly explains (Deckard Cain style):
      the current mission, monster weak spots, controls, and the shop
- [x] The intro and the ending hide the controls
- [x] Korean text calls the hero 요키

## Phones (iPhone 12)

- [x] Title buttons wait for the island to load
- [x] Floating joystick: it appears where the left thumb lands, stays there, and a tap still walks
- [x] Touch wording (no keys or clicks in hints, toasts and prompts); ⤴ hops the mine cart
- [x] Thumb arc: a big 🔨 with 🌀 ⤴ 🔦 👃 around it (compared against a 3×3 grid and a single row);
      potions on the belt, ✋ as the prompt, 🗺️ ☰ small buttons that fit even 280 pt tall screens
- [x] Camera starts at 70% on phones, with pinch zoom
- [x] Upright: the status bar sits top-left under the mission; talk never covers Yorkie
- [x] Locked buttons show 🔒 / 🦴n until earned
- [x] One potion slot with a count, a smaller stage card, and a shop that fits without scrolling

## Gameplay and world

- [x] Roll (1.5 s) and jump (1 s) cooldowns with a sweep on the buttons
- [x] Ridge walls had holes beside the gates (walk round the vines and the stone door): walls
      now stop exactly 3 m from a gate. Unit test finds no hole
- [x] The last chase's third Rocky started inside a shack and never moved
- [x] Item icons are drawn from the game's own models (bar, buttons, shop)

## Yorkie's look

- [x] Several rounds against the user's character art: from a smooth ball, through long locks
      and spikes (a pufferfish), to chunky low-poly fur on the crown and cheeks, outward ears,
      brown irises, a claw hammer, then cel shading, painted fur strokes and a bigger head,
      and finally less fur round the face
- [ ] A Tripo-generated model to compare: waiting on the user (export, rig, license check)

## Review

Each item has its own commit (bd543cb … c384c56). After every change: npm test, build and
full.js to the ending; co-op changes also ran scripts/coop.mjs (32 checks, also against the
live site); phone changes ran mobile.mjs and a dedicated touch or layout script.
