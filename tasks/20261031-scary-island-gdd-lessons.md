# Lessons · Scary Island from the GDD

- The user may be playing in the shared Chrome tab and closes tabs I open:
  verify with a separate headless Chrome (`scripts/e2e.mjs`), not their browser.
- Triggers must treat "disabled" as "outside", or a trigger enabled while the
  player already stands in it never fires.
- JS `%` is negative for negative numbers; use ((n % m) + m) % m for indices.
- Steps whose resource gets spent (keys, diamonds) need an "or the thing it
  unlocked is done" clause, or the objective goes backwards.
- Smooth ridges are climbable with jumps; back every gate-gated wall with an
  invisible collider.
- Changing the number of three.js lights recompiles shaders; keep a fixed pool.
- Scenario scripts must respect action cooldowns (sniff → swing) and wait for
  random boss timing; tell script failures apart from game failures.
- The hero is named **Yorkie**, not "Yoki" (user correction, 2026-10-31). The
  GDD's "Yoki" was a typo; use Yorkie in code, UI text and docs.
- Click-to-move must pick the *ground* (not every collider) and must never
  silently ignore a click: snap, go partway, or at least turn and show "no".
- ARPG camera feel = low pitch (~30–35°) + narrow FOV + far distance; a steep
  wide-angle camera reads as "looking at the top of the head".
- Keep navigation step limits equal to what the character controller climbs.
- Timing challenges for kids need a wide window and a warning: the cart beams
  had a ~0.3 s jump window at 9 m/s with no cue, so children hit every beam.
  Now 6.5 m/s, a ~5 m window, a blinking sign + "지금 점프!", and click/W/Up/
  Space all hop. Test with early, middle and late presses, not perfect ones.
- Terrain is a single surface: cutting holes in it (fragment discard) shows the
  void/sea behind. For see-through ridges, lower the occluding vertices in the
  vertex shader (a cutaway); the collider and shadows stay untouched.
- Start every session in the intended default view; a remembered preference
  can silently put a player in a mode they did not choose.
- Invisible blocking colliders must be excluded from every "what do I see /
  what did I click" ray (click picking, line of sight, camera). Tag them
  (G.invisibleColliders) and filter with a predicate. They were swallowing
  clicks on ordinary ground beyond a ridge.
- Rigged GLBs (animals) must be copied with SkeletonUtils.clone; a plain
  clone(true) keeps the original skeleton and the copy draws elsewhere or not
  at all (Polly the parrot was missing from her shop).
- Monster movers and the hero must ignore each other in character-controller
  queries, or a chasing monster physically shoves the child's character.
- Check props from the actual top-down camera: a perch tucked under a roof is
  invisible from above.
- Flip/roll animations must turn about the body's middle (≈ half its full
  height, including hair tufts), or the head dips through the ground. Measure
  the lowest vertex against the ground across the whole animation.
- Anything drawn low or hidden in the top-down view (cave ceiling, upper
  cave walls) must also be invisible to click rays; and "ground" for a click
  is the first upward-facing surface, never a wall face.
- Safe zones need a hard rule, not just distance: monsters keep to their home
  region and never step into a gate gap (ridge walls do the rest), so nothing
  follows a child into the camp.
- Never trust a stored spawn height: snap every teleport/checkpoint up to the
  ground at that spot. A checkpoint saved with a lower height (the arena's,
  stored at the gate) dropped the child through the world forever, and the
  "last safe spot" got overwritten with the same bad point.
- Reveal effects should be tied to the visible wave: items light up when the
  ring's radius reaches them (constant speed), not all at once.
- The mine sits far off the island: any "ground height" query there must use
  the cave floor, not the island height field (diamonds fell to -7 m).
- Loot should land toward the player and only on walkable cells (checked on
  the nav grid), never inside walls or behind the rock it came from.
- Raycasts against grouped models must be recursive (the dock is a group of
  planks); a non-recursive test silently hit the sea floor beneath.
- A 1 m nav cell is walkable only if its middle and corners all find the same
  dry floor; centre-only sampling let paths shave the edge of a diagonal dock
  and walk the child into the sea. Paths never wade.
- Story props must match the story: "the engine behind the planks" needs the
  planks on something (a slatted crate by the wreck), not floating on sand.
- Dialogues must queue: two say() calls at once (picking up the hammer and a
  treat together) replaced each other and left one promise hanging.
- Ability gates from collectibles (director's call: treats teach roll/jump)
  must never block progress: check every danger can be walked away from, and
  put the first unlock in plain sight near the start.
- When rewriting input, keep the small guards (contextmenu preventDefault):
  removing it brought back the browser menu on every right click.
- Simplicity requests (director): one camera, mouse + 1-4 + Space only; remove
  alternatives (WASD, V, F, Q, E) rather than keeping duplicates.
- A ride the child cannot steer must not be lethal: monsters can't hurt a rider, and beams stop at 1 heart. Also guard loops whose state a callback (faint) can clear mid-iteration.
- Occluder fading needs oriented boxes and a real line-of-sight hit before the hero; bounding spheres/AABBs of long, turned models (dock, ship) faded them while the child stood on them.

- Every chaser's mover slope limit must be at least what Yorkie climbs (46°);
  a lower limit strands it at the foot of a bank. Map slopes before tuning.
- A "you made it" moment should also end the danger: put the monsters to
  sleep first, then show the line, so nothing hits during the dialogue.
- Title/menu backdrops should show the game's world (island, sea, sun), not a
  generic gradient; check them with a screenshot like any other screen.
