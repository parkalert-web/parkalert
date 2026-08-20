/**
 * ParkAlert — base véhicules + identification assistée (§4).
 *
 * Règle du cahier des charges : « L'IA aide à identifier.
 * Elle ne doit JAMAIS inventer les dimensions. »
 *
 * Concrètement :
 *  - `identify()` interprète une saisie libre (« Renault Captur 2023 rouge »)
 *    et propose des véhicules de la base ci-dessous ;
 *  - les longueurs/largeurs viennent uniquement de cette base (source: 'db')
 *    ou d'une saisie explicite de l'utilisateur (source: 'manuel') ;
 *  - si rien n'est reconnu, on ne devine pas : on demande un gabarit
 *    (source: 'gabarit', signalé comme estimation) ou les cotes exactes.
 *
 * Format compact : [marque, modèle, annéeDébut, annéeFin, longueur_mm, largeur_mm]
 * Sources : fiches techniques constructeurs (dimensions hors tout, hors rétroviseurs).
 */

const RAW = [
  // ── Renault / Dacia / Alpine ────────────────────────────────────────────
  ['Renault', 'Twingo III', 2014, 2024, 3595, 1646],
  ['Renault', 'Twingo II', 2007, 2014, 3688, 1654],
  ['Renault', 'Zoe', 2012, 2024, 4084, 1730],
  ['Renault', 'Clio V', 2019, 2030, 4050, 1798],
  ['Renault', 'Clio IV', 2012, 2019, 4062, 1732],
  ['Renault', 'Clio III', 2005, 2012, 3986, 1719],
  ['Renault', 'Captur II', 2019, 2030, 4227, 1797],
  ['Renault', 'Captur I', 2013, 2019, 4122, 1778],
  ['Renault', 'Modus', 2004, 2012, 3792, 1695],
  ['Renault', 'Mégane IV', 2016, 2024, 4359, 1814],
  ['Renault', 'Mégane III', 2008, 2016, 4295, 1808],
  ['Renault', 'Mégane E-Tech', 2022, 2030, 4200, 1768],
  ['Renault', 'Scénic IV', 2016, 2022, 4406, 1866],
  ['Renault', 'Grand Scénic IV', 2016, 2022, 4634, 1866],
  ['Renault', 'Kadjar', 2015, 2022, 4449, 1836],
  ['Renault', 'Arkana', 2021, 2030, 4568, 1821],
  ['Renault', 'Austral', 2022, 2030, 4510, 1825],
  ['Renault', 'Koleos II', 2016, 2023, 4672, 1843],
  ['Renault', 'Talisman', 2015, 2022, 4848, 1869],
  ['Renault', 'Laguna III', 2007, 2015, 4695, 1811],
  ['Renault', 'Fluence', 2009, 2016, 4618, 1809],
  ['Renault', 'Espace V', 2015, 2023, 4857, 1888],
  ['Renault', 'Kangoo III', 2021, 2030, 4486, 1919],
  ['Renault', 'Kangoo II', 2008, 2021, 4282, 1829],
  ['Renault', 'Trafic III', 2014, 2030, 5080, 1956],
  ['Renault', 'Master L1H1', 2010, 2030, 5048, 2070],
  ['Renault', 'Twizy', 2012, 2024, 2338, 1237],
  ['Dacia', 'Sandero III', 2020, 2030, 4088, 1848],
  ['Dacia', 'Sandero II', 2012, 2020, 4059, 1733],
  ['Dacia', 'Logan III', 2020, 2030, 4359, 1848],
  ['Dacia', 'Duster III', 2024, 2030, 4343, 1813],
  ['Dacia', 'Duster II', 2017, 2024, 4341, 1804],
  ['Dacia', 'Duster I', 2010, 2017, 4315, 1822],
  ['Dacia', 'Spring', 2021, 2030, 3734, 1622],
  ['Dacia', 'Jogger', 2022, 2030, 4547, 1784],
  ['Dacia', 'Lodgy', 2012, 2022, 4498, 1751],
  ['Alpine', 'A110', 2017, 2030, 4180, 1798],

  // ── Stellantis (Peugeot / Citroën / DS / Opel / Fiat) ────────────────────
  ['Peugeot', '108', 2014, 2021, 3475, 1615],
  ['Peugeot', '208 II', 2019, 2030, 4055, 1745],
  ['Peugeot', '208 I', 2012, 2019, 3962, 1739],
  ['Peugeot', '207', 2006, 2012, 4030, 1748],
  ['Peugeot', '206', 1998, 2009, 3835, 1652],
  ['Peugeot', '2008 II', 2019, 2030, 4300, 1770],
  ['Peugeot', '2008 I', 2013, 2019, 4159, 1739],
  ['Peugeot', '301', 2012, 2022, 4442, 1748],
  ['Peugeot', '308 III', 2021, 2030, 4367, 1852],
  ['Peugeot', '308 II', 2013, 2021, 4253, 1804],
  ['Peugeot', '3008 II', 2016, 2030, 4447, 1841],
  ['Peugeot', '3008 I', 2009, 2016, 4365, 1837],
  ['Peugeot', '408', 2022, 2030, 4687, 1848],
  ['Peugeot', '5008 II', 2017, 2030, 4641, 1844],
  ['Peugeot', '508 II', 2018, 2030, 4750, 1859],
  ['Peugeot', '407', 2004, 2011, 4676, 1811],
  ['Peugeot', 'Rifter', 2018, 2030, 4403, 1848],
  ['Peugeot', 'Partner', 2018, 2030, 4403, 1848],
  ['Peugeot', 'Expert L1', 2016, 2030, 4609, 1920],
  ['Citroën', 'Ami', 2020, 2030, 2410, 1390],
  ['Citroën', 'C1', 2014, 2022, 3466, 1615],
  ['Citroën', 'C3 III', 2016, 2030, 3996, 1749],
  ['Citroën', 'C3 II', 2009, 2016, 3941, 1728],
  ['Citroën', 'C3 Aircross', 2017, 2030, 4154, 1756],
  ['Citroën', 'C4 III', 2020, 2030, 4360, 1800],
  ['Citroën', 'C4 Cactus', 2014, 2020, 4170, 1729],
  ['Citroën', 'C4 Picasso II', 2013, 2022, 4428, 1826],
  ['Citroën', 'Grand C4 Spacetourer', 2013, 2022, 4602, 1826],
  ['Citroën', 'C5 Aircross', 2018, 2030, 4500, 1859],
  ['Citroën', 'C5 X', 2021, 2030, 4805, 1865],
  ['Citroën', 'Berlingo III', 2018, 2030, 4403, 1848],
  ['Citroën', 'Jumpy XS', 2016, 2030, 4606, 1920],
  ['DS', 'DS3 Crossback', 2018, 2030, 4118, 1791],
  ['DS', 'DS4 II', 2021, 2030, 4400, 1830],
  ['DS', 'DS7 Crossback', 2017, 2030, 4573, 1891],
  ['Opel', 'Corsa F', 2019, 2030, 4060, 1765],
  ['Opel', 'Corsa E', 2014, 2019, 4021, 1746],
  ['Opel', 'Astra L', 2021, 2030, 4374, 1860],
  ['Opel', 'Astra K', 2015, 2021, 4370, 1809],
  ['Opel', 'Mokka B', 2020, 2030, 4151, 1791],
  ['Opel', 'Crossland', 2017, 2030, 4217, 1765],
  ['Opel', 'Vivaro L1', 2019, 2030, 4959, 1920],
  ['Fiat', '500', 2007, 2030, 3571, 1627],
  ['Fiat', '500e', 2020, 2030, 3632, 1683],
  ['Fiat', '500L', 2012, 2022, 4147, 1798],
  ['Fiat', 'Panda III', 2011, 2030, 3653, 1643],
  ['Fiat', 'Tipo', 2015, 2030, 4368, 1792],
  ['Fiat', 'Ducato L1', 2014, 2030, 4963, 2050],
  ['Jeep', 'Renegade', 2014, 2030, 4236, 1805],
  ['Jeep', 'Compass II', 2017, 2030, 4394, 1819],
  ['Alfa Romeo', 'Giulia', 2016, 2030, 4643, 1860],
  ['Alfa Romeo', 'Stelvio', 2017, 2030, 4687, 1903],
  ['Alfa Romeo', 'MiTo', 2008, 2018, 4063, 1720],

  // ── Groupe Volkswagen ───────────────────────────────────────────────────
  ['Volkswagen', 'Up!', 2011, 2023, 3600, 1645],
  ['Volkswagen', 'Polo VI', 2017, 2030, 4053, 1751],
  ['Volkswagen', 'Polo V', 2009, 2017, 3970, 1682],
  ['Volkswagen', 'Golf VIII', 2019, 2030, 4284, 1789],
  ['Volkswagen', 'Golf VII', 2012, 2019, 4258, 1799],
  ['Volkswagen', 'T-Cross', 2019, 2030, 4108, 1760],
  ['Volkswagen', 'T-Roc', 2017, 2030, 4234, 1819],
  ['Volkswagen', 'Tiguan II', 2016, 2030, 4509, 1839],
  ['Volkswagen', 'Passat B8', 2014, 2023, 4767, 1832],
  ['Volkswagen', 'Touran III', 2015, 2030, 4527, 1829],
  ['Volkswagen', 'ID.3', 2020, 2030, 4261, 1809],
  ['Volkswagen', 'ID.4', 2020, 2030, 4584, 1852],
  ['Volkswagen', 'Transporter T6 L1', 2015, 2030, 4904, 1904],
  ['Seat', 'Ibiza V', 2017, 2030, 4059, 1780],
  ['Seat', 'Leon IV', 2020, 2030, 4368, 1800],
  ['Seat', 'Leon III', 2012, 2020, 4282, 1816],
  ['Seat', 'Arona', 2017, 2030, 4138, 1780],
  ['Seat', 'Ateca', 2016, 2030, 4381, 1841],
  ['Cupra', 'Formentor', 2020, 2030, 4450, 1839],
  ['Cupra', 'Born', 2021, 2030, 4322, 1809],
  ['Skoda', 'Fabia IV', 2021, 2030, 4108, 1780],
  ['Skoda', 'Fabia III', 2014, 2021, 3992, 1732],
  ['Skoda', 'Octavia IV', 2019, 2030, 4689, 1829],
  ['Skoda', 'Kamiq', 2019, 2030, 4241, 1793],
  ['Skoda', 'Karoq', 2017, 2030, 4382, 1841],
  ['Skoda', 'Kodiaq', 2016, 2030, 4697, 1882],
  ['Audi', 'A1 GB', 2018, 2030, 4029, 1740],
  ['Audi', 'A1 8X', 2010, 2018, 3954, 1740],
  ['Audi', 'A3 8Y', 2020, 2030, 4343, 1816],
  ['Audi', 'A3 8V', 2012, 2020, 4313, 1785],
  ['Audi', 'A4 B9', 2015, 2030, 4762, 1847],
  ['Audi', 'A6 C8', 2018, 2030, 4939, 1886],
  ['Audi', 'Q2', 2016, 2030, 4208, 1794],
  ['Audi', 'Q3 F3', 2018, 2030, 4484, 1856],
  ['Audi', 'Q5 FY', 2016, 2030, 4663, 1893],
  ['Audi', 'e-tron', 2018, 2030, 4901, 1935],

  // ── Premium allemand ────────────────────────────────────────────────────
  ['BMW', 'Série 1 F40', 2019, 2030, 4319, 1799],
  ['BMW', 'Série 1 F20', 2011, 2019, 4324, 1765],
  ['BMW', 'Série 2 Active Tourer', 2014, 2030, 4386, 1824],
  ['BMW', 'Série 3 G20', 2018, 2030, 4709, 1827],
  ['BMW', 'Série 3 F30', 2011, 2018, 4633, 1811],
  ['BMW', 'Série 5 G30', 2017, 2023, 4936, 1868],
  ['BMW', 'X1 U11', 2022, 2030, 4500, 1845],
  ['BMW', 'X1 F48', 2015, 2022, 4439, 1821],
  ['BMW', 'X3 G01', 2017, 2030, 4708, 1891],
  ['BMW', 'i3', 2013, 2022, 4011, 1775],
  ['Mini', 'Cooper 3 portes F56', 2014, 2030, 3850, 1727],
  ['Mini', 'Cooper 5 portes F55', 2014, 2030, 3982, 1727],
  ['Mini', 'Countryman F60', 2017, 2030, 4299, 1822],
  ['Mercedes', 'Classe A W177', 2018, 2030, 4419, 1796],
  ['Mercedes', 'Classe A W176', 2012, 2018, 4299, 1780],
  ['Mercedes', 'Classe B W247', 2018, 2030, 4419, 1796],
  ['Mercedes', 'Classe C W206', 2021, 2030, 4751, 1820],
  ['Mercedes', 'Classe C W205', 2014, 2021, 4686, 1810],
  ['Mercedes', 'CLA C118', 2019, 2030, 4688, 1830],
  ['Mercedes', 'GLA H247', 2020, 2030, 4410, 1834],
  ['Mercedes', 'GLC X254', 2022, 2030, 4716, 1890],
  ['Mercedes', 'Vito L1', 2014, 2030, 4895, 1928],
  ['Mercedes', 'Sprinter L1', 2018, 2030, 5267, 1993],
  ['Smart', 'Fortwo III', 2014, 2024, 2695, 1663],
  ['Smart', 'Forfour III', 2014, 2021, 3495, 1665],
  ['Porsche', 'Macan', 2014, 2030, 4726, 1922],
  ['Porsche', '911 992', 2019, 2030, 4519, 1852],

  // ── Asie / autres ───────────────────────────────────────────────────────
  ['Toyota', 'Aygo X', 2022, 2030, 3700, 1740],
  ['Toyota', 'Aygo II', 2014, 2022, 3455, 1615],
  ['Toyota', 'Yaris IV', 2020, 2030, 3940, 1745],
  ['Toyota', 'Yaris III', 2011, 2020, 3945, 1695],
  ['Toyota', 'Yaris Cross', 2021, 2030, 4180, 1765],
  ['Toyota', 'Corolla XII', 2019, 2030, 4370, 1790],
  ['Toyota', 'C-HR', 2016, 2030, 4390, 1795],
  ['Toyota', 'RAV4 V', 2018, 2030, 4600, 1855],
  ['Toyota', 'Proace City', 2019, 2030, 4403, 1848],
  ['Lexus', 'UX', 2018, 2030, 4495, 1840],
  ['Nissan', 'Micra K14', 2017, 2023, 3999, 1743],
  ['Nissan', 'Juke II', 2019, 2030, 4210, 1800],
  ['Nissan', 'Qashqai III', 2021, 2030, 4425, 1835],
  ['Nissan', 'Qashqai II', 2013, 2021, 4394, 1806],
  ['Nissan', 'Leaf II', 2017, 2030, 4490, 1788],
  ['Nissan', 'Ariya', 2022, 2030, 4595, 1850],
  ['Honda', 'Jazz IV', 2020, 2030, 4044, 1694],
  ['Honda', 'Civic XI', 2022, 2030, 4551, 1802],
  ['Honda', 'HR-V III', 2021, 2030, 4340, 1790],
  ['Mazda', 'Mazda2', 2014, 2030, 4065, 1695],
  ['Mazda', 'Mazda3 IV', 2019, 2030, 4460, 1795],
  ['Mazda', 'CX-5 II', 2017, 2030, 4550, 1840],
  ['Hyundai', 'i10 III', 2019, 2030, 3670, 1680],
  ['Hyundai', 'i20 III', 2020, 2030, 4040, 1775],
  ['Hyundai', 'i30 III', 2016, 2030, 4340, 1795],
  ['Hyundai', 'Tucson IV', 2020, 2030, 4500, 1865],
  ['Hyundai', 'Kona II', 2023, 2030, 4350, 1825],
  ['Hyundai', 'Kona I', 2017, 2023, 4165, 1800],
  ['Hyundai', 'Ioniq 5', 2021, 2030, 4635, 1890],
  ['Kia', 'Picanto III', 2017, 2030, 3595, 1595],
  ['Kia', 'Rio IV', 2017, 2030, 4065, 1725],
  ['Kia', 'Ceed III', 2018, 2030, 4310, 1800],
  ['Kia', 'Sportage V', 2021, 2030, 4515, 1865],
  ['Kia', 'Niro II', 2022, 2030, 4420, 1825],
  ['Kia', 'e-Niro', 2018, 2022, 4375, 1805],
  ['Kia', 'EV6', 2021, 2030, 4695, 1890],
  ['Suzuki', 'Swift VI', 2017, 2030, 3840, 1735],
  ['Suzuki', 'Vitara IV', 2015, 2030, 4175, 1775],
  ['Mitsubishi', 'Space Star', 2013, 2030, 3845, 1665],
  ['Volvo', 'V40', 2012, 2019, 4370, 1802],
  ['Volvo', 'XC40', 2017, 2030, 4425, 1863],
  ['Volvo', 'XC60 II', 2017, 2030, 4688, 1902],
  ['Land Rover', 'Range Rover Evoque II', 2019, 2030, 4371, 1904],
  ['Tesla', 'Model 3', 2017, 2030, 4694, 1849],
  ['Tesla', 'Model Y', 2020, 2030, 4751, 1921],
  ['Tesla', 'Model S', 2012, 2030, 4979, 1964],
  ['Tesla', 'Model X', 2015, 2030, 5037, 2070],
  ['MG', 'ZS EV', 2019, 2030, 4323, 1809],
  ['MG', 'MG4', 2022, 2030, 4287, 1836],
  ['Ford', 'Fiesta VII', 2017, 2023, 4040, 1735],
  ['Ford', 'Fiesta VI', 2008, 2017, 3982, 1722],
  ['Ford', 'Focus IV', 2018, 2030, 4378, 1825],
  ['Ford', 'Focus III', 2011, 2018, 4358, 1823],
  ['Ford', 'Puma', 2019, 2030, 4186, 1805],
  ['Ford', 'Kuga III', 2019, 2030, 4614, 1883],
  ['Ford', 'Mondeo IV', 2007, 2014, 4871, 1852],
  ['Ford', 'Transit Custom L1', 2012, 2030, 4972, 1986],
];

export const VEHICLES = RAW.map(([brand, model, from, to, len, wid], i) => ({
  id: `v${i}`,
  brand,
  model,
  yearFrom: from,
  yearTo: to,
  lengthCm: Math.round(len / 10),
  widthCm: Math.round(wid / 10),
  search: `${brand} ${model}`.toLowerCase(),
}));

/**
 * Gabarits de secours (§4) — utilisés UNIQUEMENT si le véhicule n'est pas
 * dans la base et que l'utilisateur ne connaît pas ses cotes.
 * Toujours marqué comme estimation dans l'interface.
 */
export const TEMPLATES = [
  { id: 'micro', label: 'Micro-citadine (Twingo, 500…)', lengthCm: 360, widthCm: 165 },
  { id: 'citadine', label: 'Citadine (Clio, 208…)', lengthCm: 405, widthCm: 175 },
  { id: 'compacte', label: 'Compacte (Golf, 308…)', lengthCm: 435, widthCm: 181 },
  { id: 'suv', label: 'SUV compact (3008, Qashqai…)', lengthCm: 445, widthCm: 184 },
  { id: 'berline', label: 'Berline / break (Passat, 508…)', lengthCm: 478, widthCm: 186 },
  { id: 'monospace', label: 'Grand SUV / monospace', lengthCm: 490, widthCm: 190 },
  { id: 'utilitaire', label: 'Utilitaire (Kangoo, Trafic…)', lengthCm: 500, widthCm: 195 },
];

const ACCENTS = /[̀-ͯ]/g;
export const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(ACCENTS, '').replace(/[^a-z0-9]+/g, ' ').trim();

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };

/**
 * Couleurs reconnues, formes masculines/féminines/pluriels courantes.
 * Les libellés composés sont testés en premier (« bleu marine » avant « bleu »).
 */
const COLOR_FORMS = [
  ['gris clair', 'gris clair'], ['grise claire', 'gris clair'],
  ['gris fonce', 'gris foncé'], ['grise foncee', 'gris foncé'],
  ['bleu clair', 'bleu clair'], ['bleue claire', 'bleu clair'],
  ['bleu fonce', 'bleu foncé'], ['bleue foncee', 'bleu foncé'],
  ['bleu marine', 'bleu marine'], ['bleue marine', 'bleu marine'],
  ['vert fonce', 'vert foncé'], ['verte foncee', 'vert foncé'],
  ['blanche', 'blanc'], ['blanc', 'blanc'],
  ['noire', 'noir'], ['noir', 'noir'],
  ['grise', 'gris'], ['gris', 'gris'],
  ['argentee', 'argent'], ['argente', 'argent'], ['argent', 'argent'],
  ['rouge', 'rouge'], ['bordeaux', 'bordeaux'],
  ['bleue', 'bleu'], ['bleu', 'bleu'],
  ['verte', 'vert'], ['vert', 'vert'],
  ['jaune', 'jaune'], ['orange', 'orange'],
  ['marron', 'marron'], ['beige', 'beige'],
  ['violette', 'violet'], ['violet', 'violet'],
  ['rose', 'rose'], ['doree', 'or'], ['dore', 'or'], ['or', 'or'],
  ['bronze', 'bronze'],
];

/** Distance de Levenshtein bornée — tolère les fautes de frappe courantes. */
export function editDistance(a, b) {
  if (a === b) return 0;
  const m = a.length; const n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** Extrait année et couleur d'une saisie libre. */
export function extractHints(text) {
  const raw = (text || '').toLowerCase();
  const yearMatch = raw.match(/\b(19[89]\d|20[0-4]\d)\b/);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  const n = ` ${norm(raw)} `;
  // Les couleurs composées d'abord (« bleu marine » avant « bleu »).
  let color = null;
  let colorRaw = null;
  for (const [form, canon] of COLOR_FORMS) {
    if (n.includes(` ${form} `)) { color = canon; colorRaw = form; break; }
  }
  return { year, color, colorRaw };
}

function scoreEntry(entry, tokens, year) {
  const brandTokens = norm(entry.brand).split(' ');
  const modelTokens = norm(entry.model).split(' ');
  let score = 0;
  let brandHit = false;
  let modelHit = false;

  for (const t of tokens) {
    // Un token d'un seul caractère n'est utile que s'il s'agit d'un numéro
    // de génération (« clio 4 ») ; le reste est du bruit.
    if (!t || (t.length < 2 && !/^\d$/.test(t))) continue;
    if (brandTokens.some((bt) => bt === t || (t.length >= 4 && editDistance(bt, t) <= 1))) {
      score += 40; brandHit = true; continue;
    }
    for (const mt of modelTokens) {
      if (mt === t) { score += 45; modelHit = true; break; }
      if (ROMAN[mt] && (String(ROMAN[mt]) === t || t === mt)) { score += 12; break; }
      if (t.length >= 4 && editDistance(mt, t) <= 1) { score += 30; modelHit = true; break; }
      if (mt.length >= 4 && mt.startsWith(t) && t.length >= 3) { score += 18; modelHit = true; break; }
    }
  }
  if (brandHit && modelHit) score += 25;
  if (year) {
    if (year >= entry.yearFrom && year <= entry.yearTo) score += 30;
    else score -= Math.min(25, Math.abs(year - (year < entry.yearFrom ? entry.yearFrom : entry.yearTo)) * 4);
  } else {
    // Sans année précisée, on privilégie la génération la plus récente.
    score += (entry.yearTo - 1990) / 50;
  }
  return score;
}

/**
 * Identification assistée (§4).
 * @returns {{query:string, year:number|null, color:string|null, matches:Array}}
 *   `matches` = véhicules de la base, triés par pertinence, avec leurs
 *   dimensions réelles. Vide si rien n'est reconnu : on ne devine pas.
 */
export function identify(text, limit = 5) {
  const { year, color, colorRaw } = extractHints(text);
  let cleaned = norm(text);
  if (colorRaw) cleaned = cleaned.replace(new RegExp(`\\b${colorRaw}\\b`, 'g'), '');
  if (year) cleaned = cleaned.replace(new RegExp(`\\b${year}\\b`, 'g'), '');
  const tokens = cleaned.split(' ').filter(Boolean);
  if (!tokens.length) return { query: text, year, color, matches: [] };

  const scored = VEHICLES
    .map((v) => ({ vehicle: v, score: scoreEntry(v, tokens, year) }))
    .filter((r) => r.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const best = scored.length ? scored[0].score : 0;
  return {
    query: text,
    year,
    color,
    matches: scored.map((r) => ({
      ...r.vehicle,
      score: r.score,
      confidence: best ? Math.round((r.score / best) * 100) : 0,
      source: 'db',
    })),
  };
}

export function vehicleLabel(v) {
  if (!v) return '—';
  const bits = [v.brand, v.model].filter(Boolean).join(' ');
  return v.year ? `${bits} (${v.year})` : bits;
}

/** Libellé court affiché aux deux conducteurs (§17) : modèle + couleur, rien d'autre. */
export function recognitionLabel(v) {
  if (!v) return 'Véhicule non renseigné';
  const base = [v.brand, v.model].filter(Boolean).join(' ');
  return v.color ? `${base} ${v.color}` : base;
}
