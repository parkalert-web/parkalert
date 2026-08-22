/**
 * Caméra à la troisième personne : suivi souple, mode visée par-dessus l'épaule,
 * mode véhicule aligné sur la trajectoire, évitement des murs, secousses.
 */
import { clamp, lerp, damp, dampAngle, wrapAngle, angleDelta } from '../engine/math.js';

export class Camera {
  constructor() {
    this.yaw = 0;
    this.pitch = -0.19;
    this.dist = 5.2;
    this.height = 1.5;
    this.eye = [0, 3, -6];
    this.target = [0, 1.4, 0];
    this.focus = [0, 1, 0];
    this.fov = 1.12;
    this.shake = 0;
    this.shakeT = 0;
    this.mode = 'foot';
    this.autoAlign = 0;
    this.firstPerson = false;
  }

  addShake(v) { this.shake = Math.min(1.2, this.shake + v); }

  input(dx, dy, sens) {
    this.yaw -= dx * sens;
    this.pitch = clamp(this.pitch - dy * sens, -1.32, 1.15);
  }

  update(dt, game) {
    const p = game.player;
    const veh = p.vehicle;
    this.shakeT += dt;
    this.shake = Math.max(0, this.shake - dt * 1.8);

    const mode = game.cameraMode || 0;      // 0 rapprochée, 1 large, 2 première personne
    this.firstPerson = mode === 2 && !p.aiming;
    let tx = p.x, ty = p.y + 1.5, tz = p.z;
    let dist = p.aiming ? 2.5 : 5.6 * (mode === 1 ? 1.75 : 1);
    let fov = 1.12;

    if (veh) {
      const sp = Math.abs(veh.speed);
      tx = veh.x; ty = veh.y + veh.model.h * 0.75; tz = veh.z;
      ty = veh.y + veh.model.h * 1.15;
      dist = (6.6 + veh.model.len * 0.5 + sp * 0.05) * (mode === 1 ? 1.6 : 1);
      fov = 1.1 + clamp(sp / 90, 0, 1) * 0.24;
      // alignement automatique derrière le véhicule quand il avance
      if (!game.input.lookFree) {
        const behind = veh.yaw + (veh.speed < -1.2 ? Math.PI : 0);
        const rate = clamp(1.6 + Math.abs(veh.speed) * 0.2, 0, 4.5);
        this.yaw = dampAngle(this.yaw, behind, rate, dt);
        this.pitch = damp(this.pitch, -0.2, 2.4, dt);
      }
    } else if (p.aiming) {
      fov = p.weapon === 'sniper' && p.scoped ? 0.34 : 0.95;
    }

    if (game.cinematic) {
      fov = 0.9;
    }

    if (mode === 2) {
      // première personne : l'œil est dans la tête, ou au poste de conduite
      // Au volant, l'œil se place à hauteur de pare-brise et légèrement en
      // avant : nos carrosseries n'ont pas d'habitacle à montrer.
      const eyeY = veh
        ? veh.y + veh.geo.floor + veh.geo.bodyH * (veh.model.fly ? 0.75 : 0.92)
        : p.y + 1.62 - (p.crouch ? 0.24 : 0);
      const fx = Math.sin(veh ? veh.yaw : this.yaw), fz = Math.cos(veh ? veh.yaw : this.yaw);
      const ahead = veh ? veh.model.len * (veh.model.fly ? 0.16 : 0.22) : 0.28;
      const ex = (veh ? veh.x : p.x) + fx * ahead;
      const ez = (veh ? veh.z : p.z) + fz * ahead;
      this.fov = damp(this.fov, p.aiming ? 0.8 : 1.28, 6, dt);
      this.dist = 0;
      this.focus = [ex, eyeY, ez];
      this.eye = [ex, eyeY, ez];
      const cy2 = Math.cos(this.pitch);
      this.dir = [Math.sin(this.yaw) * cy2, Math.sin(this.pitch), Math.cos(this.yaw) * cy2];
      this.target = [ex + this.dir[0] * 12, eyeY + this.dir[1] * 12, ez + this.dir[2] * 12];
      if (this.shake > 0.001) {
        const sh = this.shake * 0.22;
        this.eye[0] += Math.sin(this.shakeT * 61) * sh;
        this.eye[1] += Math.sin(this.shakeT * 47 + 1.3) * sh;
      }
      return;
    }

    this.fov = damp(this.fov, fov, 6, dt);
    this.dist = damp(this.dist, dist, 8, dt);
    this.focus = [tx, ty, tz];

    // décalage épaule en visée
    let ox = 0, oy = 0;
    if (p.aiming && !veh) { ox = 0.65; oy = 0.12; }

    const cy = Math.cos(this.pitch);
    const dirX = Math.sin(this.yaw) * cy;
    const dirY = Math.sin(this.pitch);
    const dirZ = Math.cos(this.yaw) * cy;
    const rightX = Math.cos(this.yaw), rightZ = -Math.sin(this.yaw);

    const targetX = tx + rightX * ox, targetY = ty + oy, targetZ = tz + rightZ * ox;
    let d = this.dist;
    // ne pas traverser les murs
    const wall = game.world.raycast(targetX, targetY, targetZ, -dirX, -dirY, -dirZ, d + 0.6);
    if (wall !== Infinity) d = Math.max(0.9, wall - 0.55);

    let ex = targetX - dirX * d;
    let ey = targetY - dirY * d;
    let ez = targetZ - dirZ * d;
    ey = Math.max(ey, 0.55);

    if (this.shake > 0.001) {
      const s = this.shake * 0.35;
      ex += Math.sin(this.shakeT * 61) * s;
      ey += Math.sin(this.shakeT * 47 + 1.3) * s;
      ez += Math.cos(this.shakeT * 53 + 0.7) * s;
    }

    this.eye = [ex, ey, ez];
    this.target = [targetX, targetY, targetZ];
    this.dir = [dirX, dirY, dirZ];
  }

  /** Direction de visée (depuis l'œil vers le réticule). */
  aimRay() {
    const cy = Math.cos(this.pitch);
    return [Math.sin(this.yaw) * cy, Math.sin(this.pitch), Math.cos(this.yaw) * cy];
  }
}
