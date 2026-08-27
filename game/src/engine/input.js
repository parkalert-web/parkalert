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
    /**
     * La souris est capturée pendant le jeu : c'est la seule façon de tourner
     * la tête sans buter contre le bord de l'écran. Revers de la médaille, le
     * curseur appartient alors au canevas et aucun bouton n'est cliquable —
     * d'où la touche Alt, qui rend le curseur le temps qu'on la garde.
     */
    this.pointerLockWanted = true;
    this.cursorFreed = false;      // Alt maintenu : curseur rendu à l'écran
    this.canLock = null;           // le jeu y branche « aucun écran n'est ouvert »
    this.lockDenied = false;       // capture refusée (page embarquée) : on vise à la souris tenue
    this.dragging = false;
    this.dragX = 0; this.dragY = 0;
    this.enabled = true;
    this.sensitivity = 0.0022;
    this.invertY = false;
    this.touch = { active: false, moveX: 0, moveY: 0, lookX: 0, lookY: 0, buttons: {} };
    this.gamepadIndex = null;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1'].includes(e.code)) e.preventDefault();
      // Alt maintenu : on rend le curseur pour atteindre les boutons d'écran.
      if (e.code === 'AltLeft' || e.code === 'AltRight') {
        e.preventDefault();
        this.freeCursor(true);
      }
      this.keys.add(e.code);
      this.pressed.add(e.code);
    });
    addEventListener('keyup', (e) => {
      if (e.code === 'AltLeft' || e.code === 'AltRight') this.freeCursor(false);
      this.keys.delete(e.code);
    });
    addEventListener('blur', () => { this.keys.clear(); });

    canvas.addEventListener('mousedown', (e) => {
      this.dragX = e.clientX; this.dragY = e.clientY;
      this.dragging = true;
      // Premier clic : on tente la capture du pointeur, et ce clic-là ne tire pas.
      if (this.pointerLockWanted && !this.locked && this.enabled && !this.lockDenied) {
        this.requestLock();
        return;
      }
      if (e.button === 0) this.mouse.left = true;
      if (e.button === 2) this.mouse.right = true;
    });
    addEventListener('mouseup', (e) => {
      this.dragging = false;
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY * (this.invertY ? -1 : 1);
        return;
      }
      // Sans capture : on tourne la tête en gardant le bouton enfoncé.
      if (!this.dragging || !this.enabled) return;
      const dx = e.clientX - this.dragX, dy = e.clientY - this.dragY;
      this.dragX = e.clientX; this.dragY = e.clientY;
      this.mouseDX += dx;
      this.mouseDY += dy * (this.invertY ? -1 : 1);
    });
    addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.locked) this.lockDenied = false;
    });
    document.addEventListener('pointerlockerror', () => { this.lockDenied = true; });
    addEventListener('gamepadconnected', (e) => { this.gamepadIndex = e.gamepad.index; });
    addEventListener('gamepaddisconnected', () => { this.gamepadIndex = null; });
  }

  /**
   * La capture du pointeur peut être refusée (appel trop rapproché, onglet sans
   * le focus). Le navigateur rejette alors une promesse : on l'absorbe, sinon
   * elle remonte en erreur non gérée.
   */
  /** Alt maintenu : le curseur revient, les boutons redeviennent cliquables. */
  freeCursor(on) {
    if (this.cursorFreed === on) return;
    this.cursorFreed = on;
    if (on) this.releaseLock();
    else this.requestLock();
  }

  requestLock() {
    // `canLock` est fourni par le jeu et consulté à l'instant même : un
    // drapeau calculé en début d'image aurait empêché de reprendre la souris
    // juste après avoir refermé un écran.
    if (this.canLock && !this.canLock()) return;
    if (!this.pointerLockWanted || this.cursorFreed || !this.enabled || this.locked) return;
    const refuse = () => { this.lockDenied = true; };
    try {
      const r = this.canvas.requestPointerLock();
      if (r && typeof r.catch === 'function') r.catch(refuse);
      // Certains navigateurs échouent sans rien rejeter (cadre embarqué) :
      // si la capture n'a pas pris, on passe définitivement en souris tenue.
      setTimeout(() => { if (!this.locked) refuse(); }, 600);
    } catch (e) { refuse(); }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

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
export function setupTouchControls(input, root) {
  if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return null;
  input.touch.active = true;
  root.classList.add('touch');
  const stick = root.querySelector('#stick');
  const knob = root.querySelector('#stick-knob');
  let stickId = null, sx = 0, sy = 0;
  let lookId = null, lx = 0, ly = 0;

  const onStart = (e) => {
    for (const t of e.changedTouches) {
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
