// Solmar Heat — input.js
// Keyboard + mouse state. The game polls `keys` / `mouse` each frame;
// `pressed` tracks keys that went down since the last frame so menus
// and one-shot actions (E to steal, T for missions) fire exactly once.

export function createInput(canvas) {
  const input = {
    keys: Object.create(null),
    pressed: Object.create(null),
    mouse: { x: 0, y: 0, down: false, clicked: false, wx: 0, wy: 0 },
    anyKey: false,
  };

  window.addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    if (!input.keys[k]) input.pressed[k] = true;
    input.keys[k] = true;
    input.anyKey = true;
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    input.keys[k] = false;
  });
  window.addEventListener('blur', () => {
    input.keys = Object.create(null);
  });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    input.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouse.down = true;
      input.mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return input;
}

export function isDown(input, ...names) {
  return names.some((n) => input.keys[n]);
}

// One-shot test that CONSUMES the press: a key pressed between two
// frames fires exactly once, even when the fixed-step loop runs several
// steps in one frame (catch-up after a slow frame).
export function wasPressed(input, ...names) {
  for (const n of names) {
    if (input.pressed[n]) {
      delete input.pressed[n];
      return true;
    }
  }
  return false;
}

// Call once at the end of each frame so one-shot presses don't repeat.
export function endFrame(input) {
  input.pressed = Object.create(null);
  input.mouse.clicked = false;
  input.anyKey = false;
}
