/**
 * Le joueur : déplacement à pied, conduite, armes, santé, gilet,
 * capacité spéciale propre à chaque personnage.
 */
import { drawHuman, randomLook } from './character.js';
import { WEAPONS, WEAPON_ORDER } from '../systems/weapons.js';
import { pushOutOfVehicles } from '../systems/physics.js';
import { m4compose, clamp, damp, dampAngle, lerp, color } from '../engine/math.js';

export const CHARACTERS = {
  michael: {
    name: 'Michael', full: 'Michael De Santa', color: '#5b8fd6', ability: 'Temps mort',
    hint: 'Ralentit le temps à pied', look: { skin: '#e0b088', shirt: '#2b3a4a', pants: '#26303c', hair: '#2a2118' },
    home: { x: -115, z: -440 },
  },
  franklin: {
    name: 'Franklin', full: 'Franklin Clinton', color: '#7cc36b', ability: 'Sang-froid',
    hint: 'Ralentit le temps au volant', look: { skin: '#7a4c2e', shirt: '#3f7a4f', pants: '#2f3947', hair: '#1a1410' },
    home: { x: 228, z: 370 },
  },
  trevor: {
    name: 'Trevor', full: 'Trevor Philips', color: '#d99a3c', ability: 'Fureur',
    hint: 'Dégâts doublés, dégâts subis divisés', look: { skin: '#d9a077', shirt: '#e0e0d8', pants: '#4a4a3f', hair: '#3a2a1a' },
    home: { x: -466, z: 99 },
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
    this.x = x; this.z = z;
    this.y = Math.max(0, v.y);
    if (this.y > 0.3) { this.onGround = false; this.vy = v.vy || 0; this.fallFrom = this.y; }
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
      // Le lacet croissant fait pivoter vers +X, qui est à GAUCHE de l'écran :
      // la commande du joueur est donc inversée (l'IA, elle, raisonne en lacet).
      if (v.model.fly) {
        v.collective = inp.climb;
        v.pitchInput = inp.throttle;
        v.yawInput = -inp.steer;
      } else {
        v.throttle = inp.throttle;
        v.steerInput = -inp.steer;
        v.handbrake = inp.handbrake;
      }
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

    // Repère : l'avant de la caméra est (sin, cos) et, l'espace étant direct
    // avec Y vers le haut, sa DROITE à l'écran est (-cos, sin) — et non (cos, -sin).
    const cs = Math.sin(cam.yaw), cc = Math.cos(cam.yaw);
    const wx = mz * cs - mx * cc;
    const wz = mz * cc + mx * cs;

    let speed = this.swimming ? (sprinting ? 3.4 : 2.2) : this.crouch ? 1.5 : this.aiming ? 2.1 : sprinting ? 6.4 : 4.1;
    if (len < 0.02) speed = 0;
    if (!this.swimming) this.stamina = clamp(this.stamina + (sprinting ? -dt * 0.16 : dt * 0.28), 0, 1);

    const targetVX = wx * speed, targetVZ = wz * speed;
    this.vx = damp(this.vx || 0, targetVX, 12, dt);
    this.vz = damp(this.vz || 0, targetVZ, 12, dt);

    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // saut et gravité
    if (inp.jumpPressed && this.onGround && !this.swimming) {
      this.vy = 6.2;
      this.onGround = false;
      inp.jumpPressed = false;
    }
    if (!this.onGround) {
      this.fallFrom = Math.max(this.fallFrom || this.y, this.y);
      this.vy -= 21 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.onGround = true;
        // une chute de plus de huit mètres, ça se paie
        const drop = (this.fallFrom || 0);
        if (drop > 8) this.damage(clamp((drop - 8) * 9, 0, 400), game);
        this.fallFrom = 0;
        this.vy = 0;
      }
    }

    // nage : au-delà du trait de côte, on flotte
    const wasSwimming = this.swimming;
    this.swimming = this.x < -698;
    if (this.swimming) {
      // on flotte : la surface est à -0,8, on n'a que la tête et les épaules dehors
      this.y = damp(this.y, -1.95, 4, dt);
      this.vy = 0;
      this.onGround = true;
      this.aiming = false;
      // nager épuise : à bout de souffle, on commence à boire la tasse
      this.stamina = clamp(this.stamina - dt * 0.035, 0, 1);
      if (this.stamina <= 0) this.damage(9 * dt, game);
      if (!wasSwimming) game.audio.impact(6, this.x, this.z);
    } else if (this.y < 0 && this.onGround) {
      this.y = Math.min(0, this.y + dt * 3);
    }

    const p = { x: this.x, z: this.z };
    game.world.pushCircle(p, 0.42, 2);
    pushOutOfVehicles(p, 0.42, game.vehicles);      // on ne traverse pas les voitures
    game.world.pushCircle(p, 0.42, 2);              // ni un mur en s'en écartant
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
    if (this.vehicle || game.camera.firstPerson) return;
    const w = this.weaponDef;
    drawHuman(R, {
      x: this.x, y: this.y, z: this.z, yaw: this.yaw,
      anim: this.anim, move: this.move, aim: this.aiming && !this.swimming,
      crouch: this.crouch, swimming: this.swimming, deadT: this.dead ? this.deadT : 0,
      weapon: w.melee || this.dead ? null : {
        len: w.slot >= 5 ? 0.78 : w.slot >= 4 ? 0.66 : w.slot >= 2 ? 0.5 : 0.32,
        wide: w.slot >= 4 ? 0.09 : 0.075,
      },
      ...this.look,
    }, game.camera.pitch);
  }
}
