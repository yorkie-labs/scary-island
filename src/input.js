// Keys and touch behind one interface (GDD §9.2). Kept simple: no keyboard
// movement; the mouse moves Yorkie and the number keys are abilities.

export function createInput() {
  const handlers = new Map(); // code -> fn
  const virtual = { forward: 0, right: 0, run: false }; // the touch joystick writes here
  let enabled = true;

  // Handlers always fire; the game decides what a key means in each mode.
  const fire = (code, e) => handlers.get(code)?.(e);

  // the right button is the flashlight: never open the browser's menu
  addEventListener('contextmenu', (e) => e.preventDefault());

  addEventListener('keydown', (e) => {
    if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    fire(e.code, e);
  });

  return {
    // keyboard movement is gone (click to move); only the touch stick moves
    get move() {
      if (!enabled) return { forward: 0, right: 0, run: false };
      return { forward: virtual.forward, right: virtual.right, run: virtual.run };
    },
    on(code, fn) { handlers.set(code, fn); },
    trigger: fire,
    virtual,
    set enabled(v) { enabled = v; },
    get enabled() { return enabled; },
  };
}
