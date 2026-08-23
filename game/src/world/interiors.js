/**
 * Intérieurs.
 *
 * Le monde est une seule grande dalle découpée en tuiles : y greffer des
 * pièces sous les immeubles obligerait à revoir le découpage, l'éclairage et
 * les collisions. On fait donc ce que faisaient les GTA de l'époque — les
 * pièces sont bâties **à l'écart de la ville**, très loin au nord, et franchir
 * une porte téléporte le joueur. De l'intérieur on ne voit que la pièce ; de
 * la ville on ne les voit jamais.
 */
/**
 * Coin de carte réservé aux intérieurs : au-delà de la ville (qui s'arrête à
 * 540 m) mais sur la terre ferme — l'océan commence à x = −700, une pièce
 * posée au large serait engloutie sous le plan d'eau.
 */
export const INTERIOR_X = 880;
export const INTERIOR_Z = 880;
const ESPACEMENT = 80;
const PAR_RANGEE = 3;

/**
 * Catalogue. `door` est renseigné à la génération, à partir des lieux réels.
 *   w, d   dimensions de la pièce
 *   kind   habillage : boutique, bureau, appartement, entrepôt
 */
export const INTERIOR_DEFS = [
  {
    id: 'ammunation', name: 'Ammu-Nation', kind: 'boutique', w: 22, d: 16,
    shop: 'guns', spot: 'ammunation',
    hint: 'Comptoir au fond : armes, munitions et gilets.',
  },
  {
    id: 'hospital', name: 'Hôpital de Pillbox Hill', kind: 'bureau', w: 26, d: 18,
    shop: 'health', spot: 'hospital',
    hint: 'Accueil au fond : soins et gilet pare-balles.',
  },
  {
    id: 'garage', name: 'Los Santos Customs', kind: 'entrepot', w: 30, d: 22,
    spot: 'garage',
    hint: 'L’atelier. Amenez une voiture devant pour la faire réparer.',
  },
  {
    id: 'safehouse', name: 'Votre appartement', kind: 'appartement', w: 20, d: 15,
    save: true, spot: 'safehouse',
    hint: 'Chez vous. Le lit enregistre la partie.',
  },
];

/** Position du centre de la pièce `i` dans la zone réservée. */
export function interiorOrigin(i) {
  return {
    x: INTERIOR_X + (i % PAR_RANGEE) * ESPACEMENT,
    z: INTERIOR_Z + Math.floor(i / PAR_RANGEE) * ESPACEMENT,
  };
}

/**
 * Prépare les intérieurs pour un monde donné : position de la pièce, porte
 * dans la ville, point d'apparition, point de sortie.
 */
export function buildInteriors(spots) {
  const out = [];
  INTERIOR_DEFS.forEach((def, i) => {
    const o = interiorOrigin(i);
    // porte : le parvis du lieu correspondant
    const s = spots[def.spot];
    if (!s) throw new Error(`intérieur « ${def.id} » : aucun lieu « ${def.spot} » dans le monde`);
    const door = { x: s.entrance.x, z: s.entrance.z };
    out.push({
      ...def,
      x: o.x, z: o.z,
      door,
      // on entre en bas de la pièce et on ressort par là
      spawn: { x: o.x, z: o.z + def.d / 2 - 2.2 },
      exit: { x: o.x, z: o.z + def.d / 2 - 1.2 },
      counter: { x: o.x, z: o.z - def.d / 2 + 2.6 },
    });
  });
  return out;
}

/** Murs et sol : des boîtes pleines, ajoutées aux collisions du monde. */
export function interiorColliders(list) {
  const c = [];
  for (const it of list) {
    const hw = it.w / 2, hd = it.d / 2;
    const EP = 0.6;                       // épaisseur des murs
    c.push({ x: it.x, z: it.z - hd - EP, hw: hw + EP * 2, hd: EP, h: 4, kind: 'interior' });
    c.push({ x: it.x - hw - EP, z: it.z, hw: EP, hd: hd + EP * 2, h: 4, kind: 'interior' });
    c.push({ x: it.x + hw + EP, z: it.z, hw: EP, hd: hd + EP * 2, h: 4, kind: 'interior' });
    // mur d'entrée, percé d'une porte au milieu
    const trou = 2.6;
    const pan = (hw - trou / 2) / 2;
    for (const s of [-1, 1]) {
      c.push({ x: it.x + s * (trou / 2 + pan), z: it.z + hd + EP, hw: pan, hd: EP, h: 4, kind: 'interior' });
    }
    // comptoir
    c.push({ x: it.counter.x, z: it.counter.z, hw: it.w * 0.3, hd: 0.5, h: 1.1, kind: 'interior' });
  }
  return c;
}
