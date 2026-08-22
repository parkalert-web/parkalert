/**
 * Entrées : clavier + souris (capture du pointeur), manette, écran tactile.
 * Le reste du jeu ne lit que des valeurs normalisées.
 */
import { clamp } from './math.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0; this.mouseDY = 0;
    this.mouse = { left: false, right: false };
    this.wheel = 0;
    this.locked = false;
    this.enabled = true;
    this.sensitivity = 0.0022;
    this.invertY = false;
    this.touch = { active: false, moveX: 0, moveY: 0, lookX: 0, lookY: 0, buttons: {} };
    this.gamepadIndex = null;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      this.pressed.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); });

    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked && this.enabled) { canvas.requestPointerLock(); return; }
      if (e.button === 0) this.mouse.left = true;
      if (e.button === 2) this.mouse.right = true;
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY * (this.invertY ? -1 : 1);
      }
    });
    addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    addEventListener('gamepadconnected', (e) => { this.gamepadIndex = e.gamepad.index; });
    addEventListener('gamepaddisconnected', () => { this.gamepadIndex = null; });
  }

  requestLock() { if (this.enabled) this.canvas.requestPointerLock(); }
  releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }

  /** Lecture manette (Xbox / PS). */
  pollPad() {
    if (this.gamepadIndex === null || !navigator.getGamepads) return null;
    const gp = navigator.getGamepads()[this.gamepadIndex];
    if (!gp) return null;
    const dz = (v) => (Math.abs(v) < 0.16 ? 0 : v);
    return {
      lx: dz(gp.axes[0] || 0), ly: dz(gp.axes[1] || 0),
      rx: dz(gp.axes[2] || 0), ry: dz(gp.axes[3] || 0),
      a: gp.buttons[0]?.pressed, b: gp.buttons[1]?.pressed,
      x: gp.buttons[2]?.pressed, y: gp.buttons[3]?.pressed,
      lb: gp.buttons[4]?.pressed, rb: gp.buttons[5]?.pressed,
      lt: gp.buttons[6]?.value || 0, rt: gp.buttons[7]?.value || 0,
      back: gp.buttons[8]?.pressed, start: gp.buttons[9]?.pressed,
      l3: gp.buttons[10]?.pressed, r3: gp.buttons[11]?.pressed,
      up: gp.buttons[12]?.pressed, down: gp.buttons[13]?.pressed,
      left: gp.buttons[14]?.pressed, right: gp.buttons[15]?.pressed,
    };
  }

  /** À appeler une fois par image, avant la logique. */
  begin() {
    const pad = this.pollPad();
    const t = this.touch;
    const k = (c) => this.keys.has(c);

    this.moveX = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyQ') || k('KeyA') || k('ArrowLeft') ? 1 : 0);
    this.moveY = (k('KeyW') || k('KeyZ') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
    if (pad) { this.moveX += pad.lx; this.moveY -= pad.ly; }
    if (t.active) { this.moveX += t.moveX; this.moveY -= t.moveY; }
    this.moveX = clamp(this.moveX, -1, 1);
    this.moveY = clamp(this.moveY, -1, 1);

    this.throttle = this.moveY;
    this.steer = this.moveX;
    if (pad) {
      this.throttle = clamp(pad.rt - pad.lt, -1, 1) || this.moveY;
      this.steer = clamp(pad.lx || this.moveX, -1, 1);
    }
    // montée / descente : pour l'hélicoptère
    this.climb = (k('Space') || (pad ? pad.a : false) || !!t.buttons.jump ? 1 : 0)
      - (k('ControlLeft') || k('ShiftLeft') || (pad ? pad.b : false) || !!t.buttons.brake ? 1 : 0);
    this.handbrake = k('Space') || (pad ? pad.a : false) || !!t.buttons.brake;
    this.sprint = k('ShiftLeft') || k('ShiftRight') || (pad ? pad.a : false) || !!t.buttons.sprint;
    this.jumpPressed = this.pressed.has('Space') || (pad ? pad.x : false) || !!t.buttons.jump;
    this.horn = k('KeyH') || (pad ? pad.l3 : false) || !!t.buttons.horn;
    this.lookFree = k('KeyC') || (pad ? pad.rb : false);
    this.fire = this.mouse.left || (pad ? pad.rt > 0.5 : false) || !!t.buttons.fire;
    this.aim = this.mouse.right || (pad ? pad.lt > 0.4 : false) || !!t.buttons.aim;

    let dx = this.mouseDX * this.sensitivity;
    let dy = this.mouseDY * this.sensitivity;
    if (pad) { dx += pad.rx * 0.045; dy += pad.ry * 0.035 * (this.invertY ? -1 : 1); }
    if (t.active) { dx += t.lookX * 0.006; dy += t.lookY * 0.006; }
    this.lookDX = dx; this.lookDY = dy;
    this.mouseDX = 0; this.mouseDY = 0;
    t.lookX = 0; t.lookY = 0;

    this.padState = pad;
  }

  end() {
    this.pressed.clear();
    this.wheel = 0;
    for (const b of Object.keys(this.touch.buttons)) {
      if (this.touch.buttons[b] === 'once') this.touch.buttons[b] = false;
    }
  }
}

/** Manettes tactiles pour téléphone : joystick gauche + boutons. */
export function setupTouchControls(input, root, game) {
  if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return null;
  input.touch.active = true;
  root.classList.add('touch');
  const stick = root.querySelector('#stick');
  const knob = root.querySelector('#stick-knob');
  let stickId = null, sx = 0, sy = 0;
  let lookId = null, lx = 0, ly = 0;

  const onStart = (e) => {
    for (const t of e.changedTouches) {
      const r = stick.getBoundingClientRect();
      if (t.clientX < innerWidth * 0.45 && t.clientY > innerHeight * 0.35) {
        stickId = t.identifier;
        sx = t.clientX; sy = t.clientY;
        stick.style.left = `${sx - 70}px`;
        stick.style.top = `${sy - 70}px`;
        stick.style.opacity = '0.8';
      } else if (t.clientX > innerWidth * 0.45) {
        lookId = t.identifier; lx = t.clientX; ly = t.clientY;
      }
    }
  };
  const onMove = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        const dx = clamp((t.clientX - sx) / 60, -1, 1);
        const dy = clamp((t.clientY - sy) / 60, -1, 1);
        input.touch.moveX = dx; input.touch.moveY = dy;
        knob.style.transform = `translate(${dx * 42}px, ${dy * 42}px)`;
      } else if (t.identifier === lookId) {
        input.touch.lookX += t.clientX - lx;
        input.touch.lookY += t.clientY - ly;
        lx = t.clientX; ly = t.clientY;
      }
    }
    e.preventDefault();
  };
  const onEnd = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        stickId = null; input.touch.moveX = 0; input.touch.moveY = 0;
        knob.style.transform = 'translate(0,0)';
        stick.style.opacity = '0.35';
      }
      if (t.identifier === lookId) lookId = null;
    }
  };
  root.addEventListener('touchstart', onStart, { passive: false });
  root.addEventListener('touchmove', onMove, { passive: false });
  root.addEventListener('touchend', onEnd);
  root.addEventListener('touchcancel', onEnd);

  for (const btn of root.querySelectorAll('[data-btn]')) {
    const name = btn.dataset.btn;
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault(); e.stopPropagation();
      input.touch.buttons[name] = true;
      btn.classList.add('on');
      if (btn.dataset.once) input.pressed.add(btn.dataset.key);
    }, { passive: false });
    btn.addEventListener('touchend', (e) => {
      e.preventDefault(); e.stopPropagation();
      input.touch.buttons[name] = false;
      btn.classList.remove('on');
    });
  }
  return true;
}
