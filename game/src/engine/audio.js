/**
 * Son entièrement synthétisé (aucun fichier audio) : moteurs, armes,
 * explosions, sirènes, impacts, et cinq stations de radio générées en direct.
 */

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioEngine {
  constructor() {
    this.ready = false;
    this.ctx = null;
    this.volume = 0.85;
    this.musicVolume = 0.5;
    this.station = 1;
    this.stationNames = ['Radio éteinte', 'Los Santos Rock', 'West Coast Classics', 'Non Stop Pop FM', 'Blaine County FM', 'Space 103.2'];
    this.engines = new Map();
    this.sirens = new Map();
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
    this.nextBeat = 0;
    this.beat = 0;
  }

  init() {
    if (this.ready) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.volume;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -12;
    this.comp.ratio.value = 8;
    this.master.connect(this.comp);
    this.comp.connect(c.destination);

    this.sfx = c.createGain(); this.sfx.gain.value = 1; this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = this.musicVolume; this.music.connect(this.master);
    this.musicFilter = c.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 18000;
    this.musicFilter.connect(this.music);

    // bruit blanc réutilisable
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.shaper = c.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 512) - 1;
      curve[i] = Math.tanh(x * 3.2);
    }
    this.shaper.curve = curve;

    this.ready = true;
    this.nextBeat = c.currentTime + 0.1;
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  setMusicVolume(v) { this.musicVolume = v; if (this.music) this.music.gain.value = v; }

  setListener(x, y, z, yaw) { this.listener = { x, y, z, yaw }; }

  /** Atténuation et panoramique selon la position dans le monde. */
  spatial(x, z, refDist = 30) {
    const l = this.listener;
    const dx = x - l.x, dz = z - l.z;
    const d = Math.hypot(dx, dz);
    const gain = Math.min(1, refDist / Math.max(d, 1.2)) * Math.max(0, 1 - d / 260);
    const s = Math.sin(l.yaw), c = Math.cos(l.yaw);
    const right = (dx * c - dz * s) / Math.max(d, 0.001);
    return { gain, pan: Math.max(-1, Math.min(1, right)) };
  }

  node(gain, pan) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = gain;
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = pan || 0;
      g.connect(p); p.connect(this.sfx);
      return g;
    }
    g.connect(this.sfx);
    return g;
  }

  noise(dur, gain, filterType, freq, q = 1, pan = 0) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = this.node(0, pan);
    src.connect(f); f.connect(g);
    const t = c.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.start(t); src.stop(t + dur + 0.02);
    return { f, g };
  }

  tone(type, freq, dur, gain, pan = 0, sweep = null) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    const t = c.currentTime;
    o.frequency.setValueAtTime(freq, t);
    if (sweep) o.frequency.exponentialRampToValueAtTime(Math.max(20, sweep), t + dur);
    const g = this.node(0, pan);
    o.connect(g);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
    return o;
  }

  /* ------------------------------------------------------------ effets jeu */

  gunshot(kind, x, z) {
    if (!this.ready) return;
    const { gain, pan } = this.spatial(x, z, 45);
    if (gain < 0.02) return;
    const cfg = {
      pistol: [0.18, 1400, 0.55], smg: [0.12, 1900, 0.42], rifle: [0.2, 1100, 0.62],
      shotgun: [0.34, 700, 0.8], sniper: [0.5, 500, 0.95], rpg: [0.6, 300, 1],
    }[kind] || [0.18, 1400, 0.5];
    this.noise(cfg[0], gain * cfg[2] * 0.9, 'bandpass', cfg[1], 0.8, pan);
    this.noise(cfg[0] * 2.4, gain * cfg[2] * 0.35, 'lowpass', 260, 1, pan);
    this.tone('square', 120, 0.07, gain * 0.25 * cfg[2], pan, 45);
  }

  explosion(x, z) {
    if (!this.ready) return;
    const { gain, pan } = this.spatial(x, z, 90);
    if (gain < 0.02) return;
    this.noise(1.5, gain * 0.9, 'lowpass', 420, 1, pan);
    this.noise(0.35, gain * 0.7, 'highpass', 1800, 0.7, pan);
    this.tone('sine', 90, 1.2, gain * 0.8, pan, 24);
  }

  impact(force, x, z) {
    if (!this.ready || force < 1.5) return;
    const { gain, pan } = this.spatial(x, z, 35);
    if (gain < 0.02) return;
    const g = Math.min(1, force / 18);
    this.noise(0.12 + g * 0.2, gain * g * 0.85, 'bandpass', 220 + Math.random() * 260, 1.4, pan);
    this.tone('triangle', 90 + Math.random() * 60, 0.16, gain * g * 0.4, pan, 40);
  }

  skid(x, z, amount) {
    if (!this.ready || amount < 0.15) return;
    const now = this.ctx.currentTime;
    if (this._lastSkid && now - this._lastSkid < 0.09) return;
    this._lastSkid = now;
    const { gain, pan } = this.spatial(x, z, 25);
    this.noise(0.16, gain * amount * 0.35, 'bandpass', 1300, 3, pan);
  }

  footstep(x, z) {
    if (!this.ready) return;
    const { gain, pan } = this.spatial(x, z, 8);
    this.noise(0.07, gain * 0.22, 'bandpass', 900, 2, pan);
  }

  hornSound(x, z) {
    if (!this.ready) return;
    const { gain, pan } = this.spatial(x, z, 40);
    this.tone('square', 320, 0.35, gain * 0.18, pan);
    this.tone('square', 402, 0.35, gain * 0.14, pan);
  }

  pickup(up = true) {
    if (!this.ready) return;
    this.tone('sine', up ? 660 : 300, 0.12, 0.2, 0, up ? 1320 : 180);
  }

  ui(freq = 520, dur = 0.06, gain = 0.12) {
    if (!this.ready) return;
    this.tone('sine', freq, dur, gain);
  }

  /* ------------------------------------------------------------- ambiance */

  /** Deux nappes de bruit filtré : rumeur de la ville et ressac de l'océan. */
  startAmbience() {
    if (!this.ready || this.amb) return;
    const c = this.ctx;
    const mk = (type, freq, q) => {
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain();
      g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start();
      return { src, f, g };
    };
    this.amb = { city: mk('bandpass', 260, 0.6), sea: mk('lowpass', 520, 0.7) };
    this.ambPhase = 0;
  }

  updateAmbience(dt, city, sea) {
    if (!this.ready) return;
    this.startAmbience();
    if (!this.amb) return;
    const t = this.ctx.currentTime;
    this.ambPhase += dt;
    const swell = 0.55 + 0.45 * Math.sin(this.ambPhase * 0.42) * Math.sin(this.ambPhase * 0.17);
    this.amb.city.g.gain.setTargetAtTime(city * 0.05, t, 0.6);
    this.amb.sea.g.gain.setTargetAtTime(sea * swell * 0.085, t, 0.4);
    this.amb.sea.f.frequency.setTargetAtTime(420 + swell * 500, t, 0.5);
  }

  /* ----------------------------------------------------------- moteur auto */

  engineFor(v) {
    if (!this.ready) return null;
    let e = this.engines.get(v.id);
    if (!e) {
      const c = this.ctx;
      const o1 = c.createOscillator(); o1.type = 'sawtooth';
      const o2 = c.createOscillator(); o2.type = 'square';
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 4;
      const g = c.createGain(); g.gain.value = 0;
      const p = c.createStereoPanner ? c.createStereoPanner() : null;
      o1.connect(f); o2.connect(f); f.connect(g);
      if (p) { g.connect(p); p.connect(this.sfx); } else g.connect(this.sfx);
      o1.start(); o2.start();
      e = { o1, o2, f, g, p };
      this.engines.set(v.id, e);
    }
    return e;
  }

  updateEngine(v, isPlayer, dt) {
    if (!this.ready) return;
    const e = this.engineFor(v);
    if (!e) return;
    const sp = Math.abs(v.speed);
    const gearSpan = v.model.top / 5;
    const gear = Math.min(4, Math.floor(sp / gearSpan));
    const rpm = 0.22 + ((sp - gear * gearSpan) / gearSpan) * 0.78 + Math.abs(v.throttle) * 0.15;
    const base = (v.model.cls === 'truck' || v.model.cls === 'bus') ? 38 : 62;
    const freq = base * (0.7 + rpm * 1.9);
    const { gain, pan } = isPlayer ? { gain: 1, pan: 0 } : this.spatial(v.x, v.z, 22);
    const target = Math.min(0.5, (isPlayer ? 0.16 : 0.1) + rpm * 0.14) * gain * (v.dead ? 0 : 1);
    const t = this.ctx.currentTime;
    e.o1.frequency.setTargetAtTime(freq, t, 0.05);
    e.o2.frequency.setTargetAtTime(freq * 0.5, t, 0.05);
    e.f.frequency.setTargetAtTime(420 + rpm * 2200 + (isPlayer ? 400 : 0), t, 0.06);
    e.g.gain.setTargetAtTime(target, t, 0.08);
    if (e.p) e.p.pan.setTargetAtTime(pan, t, 0.1);
  }

  /** Coupe les moteurs qui ne sont plus entretenus (véhicules éloignés). */
  pruneEngines(activeIds) {
    for (const id of [...this.engines.keys()]) {
      if (!activeIds.has(id)) this.stopEngine(id);
    }
    for (const id of [...this.sirens.keys()]) {
      if (!activeIds.has(id)) {
        const s2 = this.sirens.get(id);
        try { s2.o.stop(); } catch (e) { /* déjà arrêté */ }
        this.sirens.delete(id);
      }
    }
  }

  stopEngine(id) {
    const e = this.engines.get(id);
    if (!e) return;
    try { e.o1.stop(); e.o2.stop(); } catch (err) { /* déjà arrêté */ }
    this.engines.delete(id);
  }

  updateSiren(v) {
    if (!this.ready) return;
    let s = this.sirens.get(v.id);
    if (!v.siren || v.dead) {
      if (s) { try { s.o.stop(); } catch (e) {} this.sirens.delete(v.id); }
      return;
    }
    if (!s) {
      const c = this.ctx;
      const o = c.createOscillator(); o.type = 'triangle';
      const g = c.createGain(); g.gain.value = 0;
      const p = c.createStereoPanner ? c.createStereoPanner() : null;
      o.connect(g);
      if (p) { g.connect(p); p.connect(this.sfx); } else g.connect(this.sfx);
      o.start();
      s = { o, g, p };
      this.sirens.set(v.id, s);
    }
    const { gain, pan } = this.spatial(v.x, v.z, 45);
    const t = this.ctx.currentTime;
    const wob = Math.sin(v.sirenPhase * 3.4) > 0 ? 760 : 560;
    s.o.frequency.setTargetAtTime(wob, t, 0.02);
    s.g.gain.setTargetAtTime(gain * 0.09, t, 0.1);
    if (s.p) s.p.pan.setTargetAtTime(pan, t, 0.15);
  }

  /* ---------------------------------------------------------------- radio */

  setStation(i) {
    this.station = ((i % this.stationNames.length) + this.stationNames.length) % this.stationNames.length;
    this.beat = 0;
    if (this.ready) this.nextBeat = this.ctx.currentTime + 0.05;
    return this.stationNames[this.station];
  }

  /** Filtre passe-bas quand on n'est pas dans une voiture. */
  setMuffled(m) {
    if (!this.ready) return;
    this.musicFilter.frequency.setTargetAtTime(m ? 420 : 18000, this.ctx.currentTime, 0.2);
    this.music.gain.setTargetAtTime(this.musicVolume * (m ? 0.22 : 1), this.ctx.currentTime, 0.2);
  }

  mnote(type, freq, start, dur, gain, dest) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    const g = c.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, start + dur);
    o.connect(g); g.connect(dest || this.musicFilter);
    o.start(start); o.stop(start + dur + 0.02);
    return o;
  }

  mdrum(kind, start, gain) {
    const c = this.ctx;
    if (kind === 'kick') {
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(150, start);
      o.frequency.exponentialRampToValueAtTime(42, start + 0.13);
      const g = c.createGain();
      g.gain.setValueAtTime(gain, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
      o.connect(g); g.connect(this.musicFilter);
      o.start(start); o.stop(start + 0.26);
    } else {
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf; src.loop = true;
      const f = c.createBiquadFilter();
      const g = c.createGain();
      if (kind === 'snare') { f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.9; }
      else { f.type = 'highpass'; f.frequency.value = 7200; }
      const dur = kind === 'snare' ? 0.17 : 0.05;
      g.gain.setValueAtTime(gain, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur);
      src.connect(f); f.connect(g); g.connect(this.musicFilter);
      src.start(start); src.stop(start + dur + 0.02);
    }
  }

  /** Séquenceur : appelé chaque image, planifie les notes en avance. */
  tickMusic() {
    if (!this.ready || this.station === 0) return;
    const c = this.ctx;
    const S = STATIONS[this.station - 1];
    const spb = 60 / S.bpm / 4;              // durée d'un seizième
    let guard = 48;                          // onglet en arrière-plan : on ne rattrape pas tout
    while (this.nextBeat < c.currentTime + 0.25 && guard-- > 0) {
      const t = Math.max(this.nextBeat, c.currentTime + 0.01);
      const b = this.beat;
      S.play(this, t, b, spb);
      this.beat = (b + 1) % 64;
      this.nextBeat += spb;
    }
    if (this.nextBeat < c.currentTime) this.nextBeat = c.currentTime + 0.05;
  }
}

/* ------------------------------------------------------------- stations */

const SCALE_MIN = [0, 3, 5, 7, 10, 12, 15];
const SCALE_MAJ = [0, 2, 4, 5, 7, 9, 11, 12];

const STATIONS = [
  { // Los Santos Rock
    bpm: 128,
    play(a, t, b, spb) {
      const prog = [40, 40, 45, 43];
      const root = prog[Math.floor(b / 16) % 4];
      if (b % 4 === 0) a.mdrum('kick', t, 0.5);
      if (b % 8 === 4) a.mdrum('snare', t, 0.34);
      if (b % 2 === 0) a.mdrum('hat', t, 0.09);
      if (b % 4 === 0) {
        a.mnote('sawtooth', NOTE(root), t, spb * 3.6, 0.11);
        a.mnote('sawtooth', NOTE(root + 7), t, spb * 3.6, 0.075);
        a.mnote('square', NOTE(root - 12), t, spb * 3.6, 0.12);
      }
      if (b % 16 === 12) a.mnote('sawtooth', NOTE(root + 12), t, spb * 2, 0.1);
      if (b % 8 === 6) a.mnote('sawtooth', NOTE(root + 15), t, spb * 1.5, 0.08);
    },
  },
  { // West Coast Classics
    bpm: 92,
    play(a, t, b, spb) {
      const prog = [33, 33, 36, 31];
      const root = prog[Math.floor(b / 16) % 4];
      if (b % 8 === 0 || b % 16 === 11) a.mdrum('kick', t, 0.62);
      if (b % 8 === 4) a.mdrum('snare', t, 0.4);
      if (b % 2 === 0) a.mdrum('hat', t, 0.07);
      if (b % 4 === 0) a.mnote('triangle', NOTE(root), t, spb * 3.4, 0.2);
      const lead = [0, 3, 7, 10, 7, 3];
      if (b % 2 === 0) a.mnote('square', NOTE(root + 24 + lead[(b / 2) % 6]), t, spb * 1.4, 0.05);
    },
  },
  { // Non Stop Pop FM
    bpm: 126,
    play(a, t, b, spb) {
      const prog = [45, 40, 43, 38];
      const root = prog[Math.floor(b / 16) % 4];
      if (b % 4 === 0) a.mdrum('kick', t, 0.5);
      if (b % 8 === 4) a.mdrum('snare', t, 0.28);
      if (b % 2 === 1) a.mdrum('hat', t, 0.08);
      const arp = SCALE_MAJ[b % 8];
      a.mnote('sawtooth', NOTE(root + 12 + arp), t, spb * 0.9, 0.055);
      if (b % 8 === 0) {
        a.mnote('sawtooth', NOTE(root), t, spb * 7, 0.07);
        a.mnote('sawtooth', NOTE(root + 4), t, spb * 7, 0.05);
        a.mnote('sawtooth', NOTE(root + 7), t, spb * 7, 0.05);
      }
    },
  },
  { // Blaine County FM
    bpm: 104,
    play(a, t, b, spb) {
      const prog = [38, 38, 43, 45];
      const root = prog[Math.floor(b / 16) % 4];
      if (b % 8 === 0) a.mdrum('kick', t, 0.42);
      if (b % 8 === 4) a.mdrum('snare', t, 0.3);
      if (b % 3 === 0) a.mdrum('hat', t, 0.05);
      if (b % 4 === 0) a.mnote('triangle', NOTE(root - 12), t, spb * 3.5, 0.16);
      const lick = [0, 4, 7, 9, 7, 4, 0, -3];
      if (b % 2 === 0) a.mnote('triangle', NOTE(root + 12 + lick[(b / 2) % 8]), t, spb * 1.8, 0.07);
    },
  },
  { // Space 103.2
    bpm: 116,
    play(a, t, b, spb) {
      const prog = [36, 41, 43, 39];
      const root = prog[Math.floor(b / 16) % 4];
      if (b % 4 === 0) a.mdrum('kick', t, 0.44);
      if (b % 8 === 4) a.mdrum('snare', t, 0.26);
      if (b % 2 === 0) a.mdrum('hat', t, 0.06);
      if (b % 2 === 0) a.mnote('square', NOTE(root + SCALE_MIN[(b / 2) % 7]), t, spb * 1.6, 0.07);
      if (b % 16 === 0) {
        a.mnote('sawtooth', NOTE(root + 12), t, spb * 12, 0.045);
        a.mnote('sawtooth', NOTE(root + 19), t, spb * 12, 0.035);
      }
    },
  },
];
