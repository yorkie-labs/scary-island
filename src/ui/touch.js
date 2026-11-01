// Mobile controls (GDD §9.2): a virtual joystick and action buttons, shown
// only on touch screens. They feed the same input as the keyboard.
export function setupTouch(G) {
  if (!matchMedia('(pointer: coarse)').matches) return; // a phone or tablet, not a touch laptop
  const root = document.getElementById('touch');
  root.classList.remove('hidden');
  // the layout and wording switch to touch (style.css: body.touch)
  document.body.classList.add('touch');
  G.touch = true;
  document.getElementById('dialog-next').textContent = '▼ 화면을 톡';
  // the "✋ use" prompt is a button too
  const prompt = document.getElementById('prompt');
  prompt.addEventListener('touchstart', (e) => { e.preventDefault(); G.input.trigger('Space', e); });
  // The joystick floats: put a thumb down anywhere on the left half of the
  // island and drag, and the stick appears where the thumb first touched and
  // stays there (the knob stops at its rim). A quick tap there (no
  // drag) is still "tap the ground to walk": nothing is cancelled until the
  // finger moves, so the browser's tap reaches the game as usual.
  const stick = document.getElementById('stick'), knob = document.getElementById('knob');
  const canvas = G.renderer.domElement;
  canvas.style.touchAction = 'none';
  const v = G.input.virtual;
  const R = 50, DRAG = 12; // stick reach, and how far a thumb moves before it is a drag
  let id = null, active = false;
  const origin = { x: 0, y: 0 };
  const place = () => {
    stick.style.left = `${origin.x - stick.offsetWidth / 2}px`;
    stick.style.top = `${origin.y - stick.offsetHeight / 2}px`;
    stick.style.bottom = 'auto';
  };
  const move = (t) => {
    let dx = t.clientX - origin.x, dy = t.clientY - origin.y;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    v.right = dx / R; v.forward = -dy / R; v.run = d > R * 0.9;
  };
  const touchOf = (e) => [...e.changedTouches].find((t) => t.identifier === id);

  // Two fingers on the island pinch the camera closer or farther (the
  // mouse wheel of a phone). A pinch is never a tap or a stick.
  let pinch = null; // { d } while two fingers are down; 'done' until they all lift
  const spread = (e) => { const [a, b] = e.targetTouches; return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); };
  canvas.addEventListener('touchstart', (e) => {
    if (e.targetTouches.length === 2 && !active && G.mode !== 'title') { pinch = { d: spread(e) }; id = null; }
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (!pinch?.d || e.targetTouches.length < 2) return;
    e.preventDefault();
    const d = spread(e);
    if (d > 0) G.cam.zoom(pinch.d / d);
    pinch.d = d;
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    if (!pinch) return;
    e.preventDefault(); // no walk order from a pinching finger
    pinch = e.targetTouches.length ? 'done' : null;
  }, { passive: false });

  canvas.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    if (pinch || id !== null || G.mode !== 'play' || t.clientX > innerWidth / 2) return;
    id = t.identifier; active = false;
    origin.x = t.clientX; origin.y = t.clientY; // where the stick will sit
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    const t = touchOf(e);
    if (!t) return;
    if (!active && Math.hypot(t.clientX - origin.x, t.clientY - origin.y) < DRAG) return;
    if (!active) { active = true; stick.classList.add('held'); place(); }
    e.preventDefault();
    move(t);
  }, { passive: false });
  const end = (e) => {
    if (!touchOf(e)) return;
    if (active) e.preventDefault(); // a drag is not a tap: no walk order after it
    id = null; active = false;
    v.forward = v.right = 0; v.run = false;
    knob.style.transform = '';
    stick.classList.remove('held');
    stick.style.left = stick.style.top = stick.style.bottom = ''; // back to its resting spot (a hint)
  };
  canvas.addEventListener('touchend', end, { passive: false });
  canvas.addEventListener('touchcancel', end, { passive: false });
  // a phone screen is small: start closer than on a desktop, so Yorkie is
  // about as big to the eye (a tablet already is). A pinch changes it.
  if (Math.min(innerWidth, innerHeight) < 500) G.cam.zoom(0.7);
  for (const b of document.querySelectorAll('#touch button[data-key]')) {
    b.addEventListener('touchstart', (e) => { e.preventDefault(); G.input.trigger(b.dataset.key, e); });
  }
}
