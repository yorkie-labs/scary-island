# 2026-11-01 · Release prep: review → fix → verify, repeated

Goal (user, /goal): "이제 전체적으로 리뷰와 수정을 반복하면서 배포하기전 마지막 준비를 하자"

## Plan
- [x] Parallel code review (3 reviewers): gameplay logic · UI/input/nav · build & deploy
- [x] Production build (`vite build`) and play it from `vite preview` headlessly, new game → credits
- [x] Console clean (404 favicon etc.), no page errors
- [x] Dead code from removed features (third-person, WASD, Alt labels, F/Q/E keys)
- [x] Static hosting: relative base path, assets in dist, gallery page decision
- [x] Fix findings; re-run unit tests + full playthrough on the build
- [x] README: how to build/deploy; licence note

## Review log

### Round 1 — three parallel reviews (gameplay · UI/input/nav · build/deploy)
Gameplay blockers fixed: golem reset after a faint, exit elevator only with the
crystal, ship key respawn after reload, ending replay after reload, mode/dialog
stuck states (central `beginCutscene/endCutscene/settle`, queued `say`), village
devices persisted (`devicesLit`), quest steps hidden by `showIf`, beach door and
gate keys spent atomically, chest diamonds added directly.

Build/deploy: `base: './'`, GLBs loaded from the Polyfork CDN in production
(licence), local models dropped from `dist`, gallery page dev-only, Jua font
self-hosted, favicon, meta description, WebGL probe, noscript, save on
`pagehide`/`visibilitychange`.

UI/input/nav: dialog advance marks the key event (no double use), Tab only in
play, touch 🔦 and ☰ buttons, scrollable screens, `touch-action: none`, phone
HUD layout under `(pointer: coarse)`, touch UI only on coarse pointers,
clickable hotbar/belt/flashlight slots, two-press "처음부터", gentle wheel zoom,
monsters never fade, nav cache cleared only for gate flags, nav ignores the
invisible ridge walls, click-to-move gives up after 3 stuck retries, orders
cancel on faint/fall/teleport.

Dead code: `controlMode`, `cam.behind`, `lockable`, `exitPointerLock`, the
frustum branch of `isObserved`, `G.on('scissors')`, `state.selected`.

### Round 2 — user reports during the pass
- Stage 5 chest was in the water → moved to (80,52); dry-land scan test added.
- Final chase: monsters never came → hunters with a dock `route`, never give up.
- Forest: at the hut, "휴~ 무사히 지나왔어!" and the statues fall asleep
  (also on load once `pastWatchers`). Scenario `forestsleep.js`.
- Stage 4 guardian could not climb the banks by the arena: its mover's slope
  limit was 20° while the banks are 20–30° → 46° like Yorkie. Verified with
  `guardiantrace.js` (20°: stuck at (79.5,-22.5); 46°: climbs 3.9 → 6.4 m).
- Title screen: purple gradient replaced by a sunny island illustration while
  loading, then the real island orbiting slowly behind the logo; menus use a
  deep-sea backdrop.

### Verification (final)
- `npx vitest run`: 40/40.
- Full playthrough new game → ending: dev server ✅ and production build from
  `vite preview` with CDN models ✅, no page errors.
- `dryland`, `finalchase`, `hotbar`, `ctxmenu`, `forestsleep`, `guardiantrace` ✅.

### Open (needs the user)
- The folder is not a git repo yet: `git init` + a remote before deploying.

### Round 3 — repo, deploy, mobile layout
- "새로 시작" kept showing the title: the save-on-close wrote the old game
  back during the reload → saving is off while wiping, and the new page goes
  straight into the new game. "처음부터" two-press timer fixed (started at 0).
- Repo `yorkie-labs/scary-island` + Pages workflow (push to main = deploy).
- Mobile (`scripts/mobile.mjs`, iPhone 13 portrait/landscape, iPad mini):
  touch layout under `body.touch` — bar keeps orbs/belt/diamonds only, clear
  of the stick and buttons; portrait buttons in 3 columns; objective top-left
  with a small minimap; touch wording (✋ prompt is tappable, "화면을 톡",
  touch controls in the menu); touch UI hidden on the title; compact menus
  and shop on short screens; upright phones get a slightly further camera.
  Tap-to-move and the joystick both move Yorkie on every device.
