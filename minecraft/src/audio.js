/**
 * Minecraft JS — sons, synthétisés à la volée avec l'API Web Audio.
 *
 * Aucun fichier audio n'est chargé : chaque bruit est fabriqué à partir de
 * bruit blanc filtré (pas, minage) ou d'oscillateurs (blessure, ramassage).
 * Le matériau du bloc change le filtre, ce qui donne des timbres distincts
 * pour la pierre, le bois, l'herbe, le sable ou le verre.
 */

const MATERIALS = {
  stone: { type: 'noise', freq: 900, q: 1.2, dur: 0.16, gain: 0.5, filter: 'bandpass' },
  wood: { type: 'noise', freq: 520, q: 2.2, dur: 0.15, gain: 0.55, filter: 'bandpass' },
  grass: { type: 'noise', freq: 2600, q: 0.7, dur: 0.13, gain: 0.32, filter: 'lowpass' },
  gravel: { type: 'noise', freq: 1400, q: 0.8, dur: 0.16, gain: 0.42, filter: 'bandpass' },
  sand: { type: 'noise', freq: 3800, q: 0.5, dur: 0.14, gain: 0.3, filter: 'highpass' },
  wool: { type: 'noise', freq: 380, q: 0.6, dur: 0.15, gain: 0.3, filter: 'lowpass' },
  glass: { type: 'noise', freq: 4200, q: 3, dur: 0.2, gain: 0.4, filter: 'bandpass' },
  snow: { type: 'noise', freq: 2200, q: 0.6, dur: 0.12, gain: 0.28, filter: 'lowpass' },
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.7;
    this.enabled = true;
    this.listener = { x: 0, y: 0, z: 0 };
  }

  /** Le contexte audio ne peut démarrer qu'après un geste de l'utilisateur. */
  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  /** Atténuation selon la distance à l'auditeur. */
  gainFor(pos) {
    if (!pos) return 1;
    const d = Math.hypot(pos.x - this.listener.x, (pos.y ?? 0) - this.listener.y, pos.z - this.listener.z);
    if (d > 32) return 0;
    return Math.max(0, 1 - d / 32) ** 1.6;
  }

  noiseBuffer(dur) {
    const n = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  playNoise({ freq, q, dur, gain, filter, sweep = 0 }, vol = 1) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(dur);
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain * vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
    src.stop(ctx.currentTime + dur + 0.02);
  }

  playTone(freq, dur, type = 'square', vol = 0.25, slide = 1) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  /**
   * Joue un effet.
   * @param {string} name identifiant du son
   * @param {{x,y,z}} [pos] position dans le monde (atténuation)
   * @param {string} [material] matériau du bloc concerné
   */
  play(name, pos, material = 'stone') {
    if (!this.enabled || !this.ctx) return;
    const vol = this.gainFor(pos);
    if (vol <= 0.001) return;
    const mat = MATERIALS[material] || MATERIALS.stone;

    switch (name) {
      case 'dig':
        this.playNoise({ ...mat, dur: mat.dur * 0.6, gain: mat.gain * 0.5 }, vol);
        break;
      case 'break':
        this.playNoise({ ...mat, dur: mat.dur * 1.4, gain: mat.gain, sweep: 0.5 }, vol);
        if (material === 'glass') this.playNoise({ freq: 5200, q: 2, dur: 0.25, gain: 0.35, filter: 'highpass' }, vol);
        break;
      case 'place':
        this.playNoise({ ...mat, dur: mat.dur, gain: mat.gain * 0.8 }, vol);
        break;
      case 'step':
        this.playNoise({ ...mat, dur: 0.08, gain: mat.gain * 0.35, freq: mat.freq * 0.8 }, vol * 0.8);
        break;
      case 'pop':
        this.playTone(760, 0.09, 'sine', 0.16 * vol, 1.5);
        break;
      case 'xp':
        this.playTone(900 + Math.random() * 300, 0.1, 'sine', 0.12 * vol, 1.8);
        break;
      case 'hurt':
        this.playTone(280, 0.16, 'square', 0.16 * vol, 0.55);
        break;
      case 'playerHurt':
        this.playTone(210, 0.22, 'sawtooth', 0.2 * vol, 0.5);
        break;
      case 'death':
        this.playTone(180, 0.5, 'sawtooth', 0.2 * vol, 0.3);
        break;
      case 'explode':
        this.playNoise({ freq: 260, q: 0.4, dur: 1.1, gain: 0.9, filter: 'lowpass', sweep: 0.12 }, vol);
        break;
      case 'fall':
        this.playNoise({ freq: 180, q: 0.7, dur: 0.2, gain: 0.5, filter: 'lowpass' }, vol);
        break;
      case 'splash':
        this.playNoise({ freq: 1800, q: 0.6, dur: 0.3, gain: 0.4, filter: 'lowpass', sweep: 0.3 }, vol);
        break;
      case 'bow':
        this.playNoise({ freq: 2400, q: 1.5, dur: 0.14, gain: 0.35, filter: 'bandpass', sweep: 0.4 }, vol);
        break;
      case 'arrowHit':
        this.playNoise({ freq: 1200, q: 2.4, dur: 0.1, gain: 0.3, filter: 'bandpass' }, vol);
        break;
      case 'eat':
        this.playNoise({ freq: 700, q: 1.4, dur: 0.12, gain: 0.3, filter: 'bandpass' }, vol);
        break;
      case 'equip':
        this.playNoise({ freq: 1600, q: 2, dur: 0.12, gain: 0.28, filter: 'bandpass' }, vol);
        break;
      case 'click':
        this.playTone(520, 0.05, 'square', 0.1 * vol);
        break;
      case 'levelUp':
        this.playTone(660, 0.12, 'sine', 0.18);
        setTimeout(() => this.ctx && this.playTone(880, 0.18, 'sine', 0.16), 90);
        break;
      case 'craft':
        this.playNoise({ freq: 900, q: 1, dur: 0.14, gain: 0.3, filter: 'bandpass' }, vol);
        break;
      case 'door':
        this.playNoise({ freq: 420, q: 3, dur: 0.3, gain: 0.3, filter: 'bandpass', sweep: 0.7 }, vol);
        break;
      case 'fizz':
        this.playNoise({ freq: 3000, q: 0.5, dur: 0.5, gain: 0.35, filter: 'highpass', sweep: 0.2 }, vol);
        break;
      default:
        break;
    }
  }
}
