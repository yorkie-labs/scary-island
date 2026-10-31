# Lessons · Island environment

- Polyfork: read `https://polyfork.dev/prompt.txt` first; it documents conventions
  (Y-up metres, origin on ground, +Z front) and helper modules (stage, clips, merge).
- Don't put ACES tone mapping over Polyfork models; use `stage.mjs` lighting.
- zsh: `echo ======` fails (`=` expansion). Quote separators.
- Circle-radius site packing is conservative: size cluster radii from the real
  item extents, and test the layout against the real terrain, not only fakes.
- Polyfork terrain `heightAt` never returns "off island" (it clamps to the skirt
  floor); use `scatter`/`flatAreas`, which already respect the island mask.
- While verifying in a shared browser tab, the user may also be pressing keys;
  verify state with scripted input and read-backs, not only screenshots.
