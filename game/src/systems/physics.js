/**
 * Collisions entre corps mobiles : véhicule contre véhicule, et personnage
 * contre véhicule. Le monde statique est traité par world/collide.js.
 *
 * Un véhicule est une boîte orientée. On l'approche par son « rayon d'appui »
 * dans une direction donnée : la demi-longueur et la demi-largeur projetées sur
 * cette direction. Un simple cercle laissait les voitures s'enfoncer les unes
 * dans les autres de plus d'un mètre.
 */

/** Demi-encombrement du véhicule dans la direction (nx, nz), normalisée. */
export function supportRadius(v, nx, nz) {
  const s = Math.sin(v.yaw), c = Math.cos(v.yaw);
  const alongForward = Math.abs(nx * s + nz * c);
  const alongSide = Math.abs(nx * c - nz * s);
  return v.hl * alongForward + v.hw * alongSide;
}

/**
 * Sépare les véhicules qui se chevauchent et échange leur quantité de mouvement.
 * @param {Array} list véhicules
 * @param {(a, b, force: number, x: number, z: number) => void} [onCrash]
 */
export function resolveVehicleCollisions(list, onCrash) {
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      let dx = b.x - a.x, dz = b.z - a.z;
      let d = Math.hypot(dx, dz);
      const reach = a.hl + b.hl;
      if (d > reach) continue;                       // trop loin pour se toucher
      if (d < 1e-4) { dx = 1; dz = 0; d = 1e-4; }
      const nx = dx / d, nz = dz / d;
      const minD = supportRadius(a, nx, nz) + supportRadius(b, nx, nz);
      if (d >= minD) continue;

      const overlap = minD - d;
      const ma = a.mass, mb = b.mass, total = ma + mb;
      a.x -= nx * overlap * (mb / total); a.z -= nz * overlap * (mb / total);
      b.x += nx * overlap * (ma / total); b.z += nz * overlap * (ma / total);

      const vn = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (vn > 0) continue;                          // ils s'éloignent déjà
      const imp = -1.35 * vn / (1 / ma + 1 / mb);
      a.vx -= (imp * nx) / ma; a.vz -= (imp * nz) / ma;
      b.vx += (imp * nx) / mb; b.vz += (imp * nz) / mb;
      const force = Math.abs(vn);
      if (force > 3.5) {
        a.damage(force * 4); b.damage(force * 4);
        if (onCrash) onCrash(a, b, force, (a.x + b.x) / 2, (a.z + b.z) / 2);
      }
    }
  }
}

/**
 * Repousse un disque (piéton, joueur) hors d'un véhicule.
 * @returns {boolean} vrai si la position a été corrigée
 */
export function pushOutOfVehicle(p, r, v) {
  const s = Math.sin(v.yaw), c = Math.cos(v.yaw);
  const dx = p.x - v.x, dz = p.z - v.z;
  // coordonnées dans le repère du véhicule : avant (s, c), côté (c, -s)
  const along = dx * s + dz * c;
  const side = dx * c - dz * s;
  const penF = v.hl + r - Math.abs(along);
  const penS = v.hw + r - Math.abs(side);
  if (penF <= 0 || penS <= 0) return false;
  if (penF < penS) {
    const sign = along >= 0 ? 1 : -1;
    p.x += s * sign * penF;
    p.z += c * sign * penF;
  } else {
    const sign = side >= 0 ? 1 : -1;
    p.x += c * sign * penS;
    p.z -= s * sign * penS;
  }
  return true;
}

/** Repousse un disque hors de tous les véhicules proches. */
export function pushOutOfVehicles(p, r, vehicles) {
  let touched = false;
  for (const v of vehicles) {
    if (Math.abs(p.x - v.x) > v.hl + r + 1 || Math.abs(p.z - v.z) > v.hl + r + 1) continue;
    if (pushOutOfVehicle(p, r, v)) touched = true;
  }
  return touched;
}

/**
 * Écarte les personnages qui se chevauchent. Sans cela, piétons et joueur se
 * traversent comme des fantômes dès qu'ils se croisent.
 * @param {Array} peds
 * @param {object} [player] traité comme un piéton un peu plus lourd
 */
export function separateCharacters(peds, player) {
  const R = 0.44;
  const push = (a, b, weightA, weightB) => {
    let dx = b.x - a.x, dz = b.z - a.z;
    let d = Math.hypot(dx, dz);
    if (d > R * 2 || d < 1e-5) {
      if (d >= R * 2) return;
      dx = 0.01; dz = 0; d = 0.01;
    }
    const push2 = (R * 2 - d) / d;
    a.x -= dx * push2 * weightA; a.z -= dz * push2 * weightA;
    b.x += dx * push2 * weightB; b.z += dz * push2 * weightB;
  };
  for (let i = 0; i < peds.length; i++) {
    const a = peds[i];
    if (a.dead || a.inVehicle) continue;
    for (let j = i + 1; j < peds.length; j++) {
      const b = peds[j];
      if (b.dead || b.inVehicle) continue;
      if (Math.abs(a.x - b.x) > 1 || Math.abs(a.z - b.z) > 1) continue;
      push(a, b, 0.5, 0.5);
    }
    if (player && player.onFoot && !player.dead
      && Math.abs(a.x - player.x) < 1 && Math.abs(a.z - player.z) < 1) {
      push(a, player, 0.75, 0.25);           // le joueur bouscule plus qu'il n'est bousculé
    }
  }
}
