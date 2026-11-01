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
  // island and drag, and the stick appears under it. A quick tap there (no
  // drag) is still "tap the ground to walk": nothing is cancelled until the
  // finger moves, so the browser's tap reaches the game as usual.
  const stick = document.getElementById('stick'), knob = document.getElementById('knob');
  const canvas = G.renderer.domElement;
  canvas.style.touchAction = 'none';
  const v = G.input.virtual;
  const R = 50, DRAG = 12; // stick reach, and how far a thumb moves before it is a drag
  let id = null, active = false;
  const origin = { x: 0, y: 0 }, start = { x: 0, y: 0 };
  const place = () => {
    stick.style.left = `${origin.x - stick.offsetWidth / 2}px`;
    stick.style.top = `${origin.y - stick.offsetHeight / 2}px`;
    stick.style.bottom = 'auto';
  };
  const move = (t) => {
    let dx = t.clientX - origin.x, dy = t.clientY - origin.y;
    const d = Math.hypot(dx, dy);
    // past its reach the stick follows the thumb, so turning around is quick
    if (d > R) { origin.x += dx * (1 - R / d); origin.y += dy * (1 - R / d); dx = (dx / d) * R; dy = (dy / d) * R; place(); }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    v.right = dx / R; v.forward = -dy / R; v.run = d > R * 0.9;
  };
  const touchOf = (e) => [...e.changedTouches].find((t) => t.identifier === id);
  canvas.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    if (id !== null || G.mode !== 'play' || t.clientX > innerWidth / 2) return;
    id = t.identifier; active = false;
    start.x = origin.x = t.clientX; start.y = origin.y = t.clientY;
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    const t = touchOf(e);
    if (!t) return;
    if (!active && Math.hypot(t.clientX - start.x, t.clientY - start.y) < DRAG) return;
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
  for (const b of document.querySelectorAll('#touch-buttons button')) {
    b.addEventListener('touchstart', (e) => { e.preventDefault(); G.input.trigger(b.dataset.key, e); });
  }
}
