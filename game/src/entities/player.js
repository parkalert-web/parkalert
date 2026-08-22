/**
 * Le joueur : déplacement à pied, conduite, armes, santé, gilet,
 * capacité spéciale propre à chaque personnage.
 */
import { drawHuman, randomLook } from './character.js';
import { WEAPONS, WEAPON_ORDER } from '../systems/weapons.js';
import { m4compose, clamp, damp, dampAngle, lerp, color } from '../engine/math.js';

export const CHARACTERS = {
  michael: {
    name: 'Michael', full: 'Michael De Santa', color: '#5b8fd6', ability: 'Temps mort',
    hint: 'Ralentit le temps à pied', look: { skin: '#e0b088', shirt: '#2b3a4a', pants: '#26303c', hair: '#2a2118' },
    home: { x: -140, z: -420 },
  },
  franklin: {
    name: 'Franklin', full: 'Franklin Clinton', color: '#7cc36b', ability: 'Sang-froid',
    hint: 'Ralentit le temps au volant', look: { skin: '#7a4c2e', shirt: '#3f7a4f', pants: '#2f3947', hair: '#1a1410' },
    home: { x: 200, z: 380 },
  },
  trevor: {
    name: 'Trevor', full: 'Trevor Philips', color: '#d99a3c', ability: 'Fureur',
    hint: 'Dégâts doublés, dégâts subis divisés', look: { skin: '#d9a077', shirt: '#e0e0d8', pants: '#4a4a3f', hair: '#3a2a1a' },
    home: { x: -480, z: 120 },
  },
};

export class Player {
  constructor(charKey = 'franklin') {
    this.x = 0; this.y = 0; this.z = 0;
    this.yaw = 0;
    this.vy = 0;
    this.onGround = true;
    this.anim = 0;
    this.move = 0;
    this.crouch = false;
    this.aiming = false;
    this.scoped = false;
    this.vehicle = null;
    this.seat = 0;
    this.dead = false;
    this.deadT = 0;
    this.health = 200;
    this.maxHealth = 200;
    this.armor = 0;
    this.maxArmor = 100;
    this.stamina = 1;
    this.money = 12500;
    this.wanted = 0;
    this.weapon = 'pistol';
    this.ammo = {};
    this.mags = {};
    this.owned = { fist: true, pistol: true };
    this.fireCooldown = 0;
    this.reloadT = 0;
    this.ability = 0.5;
    this.abilityActive = 0;
    this.setCharacter(charKey);
    for (const k of WEAPON_ORDER) {
      const w = WEAPONS[k];
      this.ammo[k] = w.ammo || 0;
      this.mags[k] = w.mag || 0;
    }
    this.lastDamage = 0;
    this.enterCooldown = 0;
  }

  setCharacter(key) {
    this.character = key;
    const c = CHARACTERS[key];
    this.look = {
      skin: color(c.look.skin), shirt: color(c.look.shirt),
      pants: color(c.look.pants), hair: color(c.look.hair),
      hat: key === 'trevor', hatColor: color('#2a2a2a'),
    };
  }

  get onFoot() { return !this.vehicle; }
  get weaponDef() { return WEAPONS[this.weapon]; }

  giveWeapon(key, ammo = 0) {
    this.owned[key] = true;
    this.ammo[key] = (this.ammo[key] || 0) + ammo;
    if (!this.mags[key]) this.mags[key] = Math.min(WEAPONS[key].mag || 0, this.ammo[key]);
  }

  heal(v) { this.health = Math.min(this.maxHealth, this.health + v); }

  damage(v, game, src) {
    if (this.dead) return;
    if (this.character === 'trevor' && this.abilityActive > 0) v *= 0.45;
    if (this.armor > 0) {
      const a = Math.min(this.armor, v * 0.7);
      this.armor -= a; v -= a;
    }
    this.health -= v;
    this.lastDamage = 0;
    if (game) game.onPlayerHurt(v, src);
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.deadT = 0;
      if (game) game.onPlayerDied();
    }
  }

  /** Entrée/sortie de véhicule. */
  enterVehicle(v, seat = 0) {
    this.vehicle = v;
    this.seat = seat;
    v.driver = seat === 0 ? this : v.driver;
    v.occupants.push(this);
    v.ai = null;
    v.parked = false;
    this.aiming = false;
    this.enterCooldown = 0.45;
  }

  exitVehicle(world) {
    const v = this.vehicle;
    if (!v) return;
    const [x, z] = v.exitPos(world);
    this.x = x; this.z = z; this.y = 0;
    this.yaw = v.yaw + Math.PI / 2;
    v.driver = v.driver === this ? null : v.driver;
    v.occupants = v.occupants.filter((o) => o !== this);
    v.throttle = 0; v.steerInput = 0;
    this.vehicle = null;
    this.enterCooldown = 0.45;
  }

  update(dt, game) {
    const inp = game.input;
    this.enterCooldown = Math.max(0, this.enterCooldown - dt);
    this.lastDamage += dt;
    if (this.lastDamage > 6 && this.health < this.maxHealth && !this.dead) {
      this.health = Math.min(this.maxHealth, this.health + 6 * dt);   // régénération lente
    }
    if (this.abilityActive > 0) {
      this.abilityActive -= dt;
      this.ability = Math.max(0, this.ability - dt * 0.34);
      if (this.ability <= 0) this.abilityActive = 0;
    } else {
      this.ability = Math.min(1, this.ability + dt * 0.012);
    }

    if (this.dead) { this.deadT += dt; this.move = 0; return; }

    if (this.vehicle) {
      this.updateDriving(dt, game);
    } else {
      this.updateOnFoot(dt, game);
    }
    this.fireCooldown -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.finishReload();
    }
  }

  updateDriving(dt, game) {
    const v = this.vehicle;
    const inp = game.input;
    if (this.seat === 0) {
      v.throttle = inp.throttle;
      v.steerInput = inp.steer;
      v.handbrake = inp.handbrake;
      if (inp.horn) v.horn = 0.2;
    }
    this.x = v.x; this.z = v.z; this.y = v.y;
    this.yaw = v.yaw;
    if (v.dead && v.burnTime > 0.5) {
      // on saute d'une épave en flammes
      this.exitVehicle(game.world);
      this.damage(12, game);
    }
  }

  updateOnFoot(dt, game) {
    const inp = game.input;
    const cam = game.camera;
    let mx = inp.moveX, mz = inp.moveY;
    const len = Math.hypot(mx, mz);
    const sprinting = inp.sprint && len > 0.1 && !this.aiming && this.stamina > 0;
    if (len > 1) { mx /= len; mz /= len; }

    const cs = Math.sin(cam.yaw), cc = Math.cos(cam.yaw);
    const wx = mx * cc + mz * cs;
    const wz = -mx * cs + mz * cc;

    let speed = this.crouch ? 1.5 : this.aiming ? 2.1 : sprinting ? 6.4 : 4.1;
    if (len < 0.02) speed = 0;
    this.stamina = clamp(this.stamina + (sprinting ? -dt * 0.16 : dt * 0.28), 0, 1);

    const targetVX = wx * speed, targetVZ = wz * speed;
    this.vx = damp(this.vx || 0, targetVX, 12, dt);
    this.vz = damp(this.vz || 0, targetVZ, 12, dt);

    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // saut et gravité
    if (inp.jumpPressed && this.onGround) {
      this.vy = 6.2;
      this.onGround = false;
      inp.jumpPressed = false;
    }
    if (!this.onGround) {
      this.vy -= 21 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; this.onGround = true; }
    }

    const p = { x: this.x, z: this.z };
    game.world.pushCircle(p, 0.42, 2);
    this.x = p.x; this.z = p.z;
    const B = 1080;
    this.x = clamp(this.x, -B, B); this.z = clamp(this.z, -B, B);

    // orientation : vers la caméra en visée, sinon vers le déplacement
    if (this.aiming) {
      this.yaw = dampAngle(this.yaw, cam.yaw, 18, dt);
    } else if (len > 0.05) {
      this.yaw = dampAngle(this.yaw, Math.atan2(wx, wz), 12, dt);
    }
    const sp = Math.hypot(this.vx, this.vz);
    this.move = clamp(sp / 4.1, 0, 1.6);
    this.anim += sp * dt * 0.62;
  }

  startReload() {
    const w = this.weaponDef;
    if (!w.mag || this.reloadT > 0) return;
    if (this.mags[this.weapon] >= w.mag) return;
    if ((this.ammo[this.weapon] || 0) <= 0) return;
    this.reloadT = w.mag > 20 ? 2.1 : 1.5;
  }

  finishReload() {
    const w = this.weaponDef;
    const need = w.mag - this.mags[this.weapon];
    const take = Math.min(need, this.ammo[this.weapon]);
    this.mags[this.weapon] += take;
    this.ammo[this.weapon] -= take;
  }

  canFire() {
    const w = this.weaponDef;
    if (this.fireCooldown > 0 || this.reloadT > 0) return false;
    if (w.melee) return true;
    return this.mags[this.weapon] > 0;
  }

  consumeAmmo() {
    const w = this.weaponDef;
    if (!w.melee) {
      this.mags[this.weapon]--;
      if (this.mags[this.weapon] <= 0 && this.ammo[this.weapon] > 0) this.startReload();
    }
    this.fireCooldown = w.rate;
  }

  switchWeapon(key) {
    if (!this.owned[key]) return false;
    this.weapon = key;
    this.reloadT = 0;
    return true;
  }

  draw(R, game) {
    if (this.vehicle) return;
    drawHuman(R, {
      x: this.x, y: this.y, z: this.z, yaw: this.yaw,
      anim: this.anim, move: this.move, aim: this.aiming,
      crouch: this.crouch, deadT: this.dead ? this.deadT : 0,
      ...this.look,
    }, game.camera.pitch);
    const w = this.weaponDef;
    if (!w.melee && !this.dead) {
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      const lx = 0.3, lz = this.aiming ? 0.55 : 0.12;
      const len = w.slot >= 4 ? 0.72 : w.slot >= 2 ? 0.5 : 0.34;
      const mat = m4compose(R.tmpMat || (R.tmpMat = new Float32Array(16)),
        this.x + lx * c + lz * s, 1.3 - (this.crouch ? 0.24 : 0), this.z - lx * s + lz * c,
        this.yaw, 0.09, 0.15, len, this.aiming ? game.camera.pitch * 0.6 : 0);
      R.cube(mat, [0.13, 0.13, 0.15]);
    }
  }
}
