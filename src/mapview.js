/**
 * ParkAlert — carte (Leaflet + tuiles OpenStreetMap, sans clé ni abonnement).
 * Le géocodage de la destination utilise Nominatim, le service public d'OSM.
 */

import { distanceM } from './core.js';

const TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

function dot(color, { pulse = false, size = 22, glyph = '' } = {}) {
  const anim = pulse ? `animation:pulse 1.4s infinite;` : '';
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 2],
    html: `<div class="pin" style="--c:${color};width:${size}px;height:${size}px;${anim}">${glyph}</div>`,
  });
}

export const ICONS = {
  me: dot('#818cf8', { size: 18 }),
  spot: dot('#f59e0b', { pulse: true, size: 26, glyph: 'P' }),
  spotReserved: dot('#64748b', { size: 24, glyph: 'P' }),
  seeker: dot('#38bdf8', { size: 18 }),
  signal: dot('#a855f7', { pulse: true, size: 22, glyph: '!' }),
  dest: dot('#4ade80', { size: 20, glyph: '◎' }),
  partner: dot('#f472b6', { pulse: true, size: 24, glyph: '▲' }),
};

export class MapView {
  constructor(nodeId) {
    this.map = L.map(nodeId, { zoomControl: true, attributionControl: true })
      .setView([48.8566, 2.3522], 14);
    L.tileLayer(TILE, { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(this.map);
    this.layers = {};
    this.groups = { spots: {}, seekers: {}, signals: {} };
    this.followMe = true;
    this.map.on('dragstart', () => { this.followMe = false; });
    this._pickHandler = null;
    // Le panneau d'action change de hauteur au fil des étapes : Leaflet doit suivre.
    const host = document.getElementById(nodeId);
    if (host && 'ResizeObserver' in window) {
      new ResizeObserver(() => this.map.invalidateSize({ animate: false })).observe(host);
    }
  }

  invalidate() { setTimeout(() => this.map.invalidateSize(), 60); }

  center(pos, zoom) {
    if (!pos) return;
    this.map.setView([pos.lat, pos.lng], zoom || Math.max(this.map.getZoom(), 16));
  }

  fit(points) {
    const pts = points.filter(Boolean).map((p) => [p.lat, p.lng]);
    if (pts.length < 2) return this.center(points.find(Boolean));
    this.map.fitBounds(L.latLngBounds(pts).pad(0.35));
    return undefined;
  }

  setMe(pos) {
    if (!pos) return;
    if (!this.layers.me) {
      this.layers.me = L.marker([pos.lat, pos.lng], { icon: ICONS.me, zIndexOffset: 900 }).addTo(this.map);
      this.layers.me.bindPopup('<b style="color:#818cf8">Vous êtes ici</b>');
      this.center(pos, 16);
    } else {
      this.layers.me.setLatLng([pos.lat, pos.lng]);
      if (this.followMe) this.map.panTo([pos.lat, pos.lng], { animate: true, duration: 0.4 });
    }
  }

  setDestination(pos, radiusM) {
    ['dest', 'destCircle'].forEach((k) => { if (this.layers[k]) { this.layers[k].remove(); this.layers[k] = null; } });
    if (!pos) return;
    this.layers.dest = L.marker([pos.lat, pos.lng], { icon: ICONS.dest }).addTo(this.map);
    this.layers.dest.bindPopup('<b style="color:#4ade80">Votre destination</b>');
    if (radiusM) {
      this.layers.destCircle = L.circle([pos.lat, pos.lng], {
        radius: radiusM, color: '#4ade80', weight: 1, fillColor: '#4ade80', fillOpacity: 0.06,
      }).addTo(this.map);
    }
  }

  setPartner(pos, label) {
    if (!pos) {
      if (this.layers.partner) { this.layers.partner.remove(); this.layers.partner = null; }
      return;
    }
    if (!this.layers.partner) {
      this.layers.partner = L.marker([pos.lat, pos.lng], { icon: ICONS.partner, zIndexOffset: 800 }).addTo(this.map);
    } else this.layers.partner.setLatLng([pos.lat, pos.lng]);
    this.layers.partner.bindPopup(`<b style="color:#f472b6">${label || 'Correspondant'}</b>`);
  }

  /** Synchronise un groupe de marqueurs avec une liste d'objets {key,lat,lng}. */
  sync(group, items, iconFor, popupFor) {
    const store = this.groups[group];
    const seen = new Set();
    for (const it of items) {
      if (!it || it.lat == null) continue;
      seen.add(it.key);
      const icon = iconFor(it);
      if (store[it.key]) {
        store[it.key].setLatLng([it.lat, it.lng]);
        store[it.key].setIcon(icon);
      } else {
        store[it.key] = L.marker([it.lat, it.lng], { icon }).addTo(this.map);
      }
      store[it.key].bindPopup(popupFor(it));
    }
    for (const k of Object.keys(store)) {
      if (!seen.has(k)) { store[k].remove(); delete store[k]; }
    }
  }

  /** Un appui sur la carte renvoie les coordonnées (choix de destination). */
  pick() {
    return new Promise((resolve) => {
      this.cancelPick();
      document.body.classList.add('picking');
      this._pickHandler = (e) => {
        this.cancelPick();
        resolve({ lat: e.latlng.lat, lng: e.latlng.lng });
      };
      this.map.once('click', this._pickHandler);
    });
  }

  cancelPick() {
    document.body.classList.remove('picking');
    if (this._pickHandler) { this.map.off('click', this._pickHandler); this._pickHandler = null; }
  }
}

/** Géocodage d'adresse (Nominatim, usage raisonnable). */
export async function geocode(query, near) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('accept-language', 'fr');
  if (near) {
    const d = 0.15;
    url.searchParams.set('viewbox', `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
  }
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('geocode');
  const data = await res.json();
  return data.map((r) => ({
    label: r.display_name,
    short: r.name || r.display_name.split(',')[0],
    lat: Number(r.lat),
    lng: Number(r.lon),
    distM: near ? distanceM(near, { lat: Number(r.lat), lng: Number(r.lon) }) : null,
  }));
}

/** Adresse approximative d'un point (utilisée pour nommer une destination pointée). */
export async function reverseGeocode(pos) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${pos.lat}&lon=${pos.lng}&format=jsonv2&accept-language=fr`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const d = await res.json();
    const a = d.address || {};
    return [a.road, a.suburb || a.city_district, a.city || a.town || a.village].filter(Boolean).join(', ') || d.display_name || null;
  } catch { return null; }
}
