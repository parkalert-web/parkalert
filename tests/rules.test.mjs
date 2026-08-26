/**
 * Vérifie les RÈGLES DE SÉCURITÉ de la base contre l'émulateur local.
 *
 *   npm run test:rules
 *
 * Deux questions, aussi importantes l'une que l'autre :
 *   — est-ce qu'un inconnu est bien bloqué ? (sinon la base est ouverte à tous)
 *   — est-ce que l'application marche encore ? (sinon on casse tout le monde)
 *
 * Les tests parlent à la base comme un vrai téléphone : avec un compte, et
 * sans les droits d'administration dont bénéficient les fonctions serveur.
 */

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import { ref, set, update, get, remove } from 'firebase/database';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let env;
let paul;      // le conducteur qui donne sa place
let lea;       // celle qui la reprend
let inconnu;   // quelqu'un qui n'a rien à voir avec eux
let anonyme;   // pas de compte du tout

const PAUL = 'paul';
const LEA = 'lea';

/** Une place valide telle que l'application l'écrit. */
const place = (extra = {}) => ({
  spotId: PAUL, donorUid: PAUL, donorPseudo: 'Paul',
  lat: 48.8566, lng: 2.3522, spotCm: 600, status: 'open',
  mode: 'timed', readyAt: Date.now() + 600_000, createdAt: Date.now(),
  ...extra,
});

/** Une recherche valide telle que l'application l'écrit. */
const recherche = (uid = LEA) => ({
  uid, pseudo: 'Léa', points: 0, reliability: 100,
  lat: 48.857, lng: 2.352, destLat: 48.8566, destLng: 2.3522,
  radiusM: 400, neededCm: 467, state: 'searching', ts: Date.now(),
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-parkalert',
    database: {
      host: '127.0.0.1',
      port: 9000,
      rules: readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8'),
    },
  });
  paul = env.authenticatedContext(PAUL).database();
  lea = env.authenticatedContext(LEA).database();
  inconnu = env.authenticatedContext('inconnu').database();
  anonyme = env.unauthenticatedContext().database();
}, { timeout: 60_000 });

after(async () => { await env?.cleanup(); });

beforeEach(async () => { await env.clearDatabase(); });

/* ══════════════ Ce qui doit être BLOQUÉ ══════════════ */

test('un inconnu sans compte ne peut rien lire ni écrire', async () => {
  await assertFails(get(ref(anonyme, 'users')));
  await assertFails(get(ref(anonyme, 'spots')));
  await assertFails(get(ref(anonyme, 'seekers')));
  await assertFails(set(ref(anonyme, 'spots/paul'), place()));
  await assertFails(get(ref(anonyme, 'sessions')));
});

test('la base entière n’est jamais lisible d’un coup', async () => {
  await assertFails(get(ref(anonyme, '/')));
  await assertFails(get(ref(lea, '/')));
});

test('personne ne peut lire le compte d’un autre', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await set(ref(ctx.database(), `users/${PAUL}`), { pseudo: 'Paul', points: 40, email: 'x@y.z' });
  });
  await assertFails(get(ref(lea, `users/${PAUL}`)));
  // Seuls le pseudonyme et les points sont publics : les autres conducteurs en
  // ont besoin pour la mise en relation.
  await assertSucceeds(get(ref(lea, `users/${PAUL}/pseudo`)));
  await assertSucceeds(get(ref(lea, `users/${PAUL}/points`)));
});

test('on ne peut pas annoncer une place au nom de quelqu’un d’autre', async () => {
  await assertFails(set(ref(lea, `spots/${PAUL}`), place()));
  // Ni se déguiser en un autre dans sa propre place.
  await assertFails(set(ref(lea, `spots/${LEA}`), place({ spotId: LEA, donorUid: PAUL })));
});

test('on ne peut pas lancer une recherche au nom de quelqu’un d’autre', async () => {
  await assertFails(set(ref(inconnu, `seekers/${LEA}`), recherche(LEA)));
});

test('une réservation n’est visible que de ses deux participants', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await set(ref(ctx.database(), 'sessions/s1'), {
      donorUid: PAUL, seekerUid: LEA, spotLat: 48.8566, spotLng: 2.3522, status: 'active',
    });
  });
  await assertSucceeds(get(ref(paul, 'sessions/s1')));
  await assertSucceeds(get(ref(lea, 'sessions/s1')));
  await assertFails(get(ref(inconnu, 'sessions/s1')));
  await assertFails(update(ref(inconnu, 'sessions/s1'), { status: 'cancelled' }));
});

test('la clé privée des notifications n’est lisible par personne', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await set(ref(ctx.database(), 'config'), {
      vapid: { publicKey: 'pub', privateKey: 'PRIVÉ' },
      vapidPublicKey: 'pub',
      serverMatching: true,
    });
  });
  await assertFails(get(ref(lea, 'config/vapid')));
  await assertFails(get(ref(lea, 'config')));
  // Mais l'application doit pouvoir lire ce dont elle a besoin.
  await assertSucceeds(get(ref(lea, 'config/vapidPublicKey')));
  await assertSucceeds(get(ref(anonyme, 'config/serverMatching')));
});

test('personne ne peut s’écrire des points depuis un autre compte', async () => {
  await assertFails(set(ref(lea, `users/${PAUL}/points`), 9999));
});

test('la marque « déjà récompensé ensemble » ne peut pas être effacée par l’autre', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await set(ref(ctx.database(), `users/${PAUL}/rewardedPartners/${LEA}`), Date.now());
  });
  // Léa ne peut ni l'effacer ni la réécrire pour regagner des points en boucle.
  await assertFails(remove(ref(lea, `users/${PAUL}/rewardedPartners/${LEA}`)));
  await assertFails(set(ref(lea, `users/${PAUL}/rewardedPartners/${LEA}`), 0));
  // Et elle ne peut pas non plus toucher à la marque d'un tiers.
  await assertFails(set(ref(inconnu, `users/${PAUL}/rewardedPartners/${LEA}`), Date.now()));
});

/* ══════════════ Ce qui doit CONTINUER DE MARCHER ══════════════ */

test('le parcours complet reste possible pour les deux conducteurs', async () => {
  // 1. Paul crée son compte et enregistre sa voiture.
  await assertSucceeds(set(ref(paul, `users/${PAUL}`), {
    pseudo: 'Paul', points: 0, createdAt: Date.now(), lastRewardAt: 0,
  }));
  await assertSucceeds(set(ref(paul, `users/${PAUL}/vehicles/v1`), {
    brand: 'Renault', model: 'Captur', lengthCm: 423, widthCm: 180,
  }));

  // 2. Léa cherche une place.
  await assertSucceeds(set(ref(lea, `seekers/${LEA}`), recherche()));
  await assertSucceeds(update(ref(lea, `seekers/${LEA}`), { lat: 48.858, lng: 2.353 }));

  // 3. Paul annonce son départ, puis met sa place à jour.
  await assertSucceeds(set(ref(paul, `spots/${PAUL}`), place()));
  await assertSucceeds(update(ref(paul, `spots/${PAUL}`), { status: 'offering', offeredTo: LEA }));
  await assertSucceeds(set(ref(paul, `spots/${PAUL}/excluded/${'autre'}`), Date.now()));

  // 4. Paul propose la place à Léa ; Léa répond.
  await assertSucceeds(set(ref(paul, `offers/${LEA}`), {
    donorUid: PAUL, spotId: PAUL, expiresAt: Date.now() + 45_000, response: 'pending', etaMin: 5,
  }));
  await assertSucceeds(get(ref(lea, `offers/${LEA}`)));
  await assertSucceeds(set(ref(lea, `offers/${LEA}/response`), 'accepted'));

  // 5. Paul confirme et crée la réservation.
  await assertSucceeds(update(ref(paul, `offers/${LEA}`), { response: 'confirmed', sessionId: 's1' }));
  await assertSucceeds(set(ref(paul, 'sessions/s1'), {
    donorUid: PAUL, seekerUid: LEA, spotLat: 48.8566, spotLng: 2.3522,
    status: 'active', donorState: 'away', seekerState: 'enroute',
    etaMin: 5, dueAt: Date.now() + 300_000,
  }));

  // 6. Les deux se suivent et avancent dans la réservation.
  await assertSucceeds(update(ref(paul, 'sessions/s1'), { donorState: 'ready', donorPos: { lat: 48.8566, lng: 2.3522 } }));
  await assertSucceeds(update(ref(lea, 'sessions/s1'), { seekerState: 'nearby', seekerPos: { lat: 48.8566, lng: 2.3522 } }));

  // 7. Léa corrige son heure d'arrivée.
  await assertSucceeds(update(ref(lea, 'sessions/s1'), {
    etaMin: 12, dueAt: Date.now() + 720_000, etaUpdatedAt: Date.now(), etaDirection: 'later',
  }));

  // 8. Double confirmation, puis clôture.
  await assertSucceeds(update(ref(paul, 'sessions/s1'), { confirmDonor: true }));
  await assertSucceeds(update(ref(lea, 'sessions/s1'), { confirmSeeker: true }));
  await assertSucceeds(update(ref(paul, 'sessions/s1'), { status: 'completed' }));

  // 9. Paul touche ses points et note l'entraide des deux côtés.
  await assertSucceeds(set(ref(paul, `users/${PAUL}/points`), 10));
  await assertSucceeds(set(ref(paul, `users/${PAUL}/rewardedPartners/${LEA}`), Date.now()));
  await assertSucceeds(set(ref(paul, `users/${LEA}/rewardedPartners/${PAUL}`), Date.now()));
  await assertSucceeds(set(ref(paul, `users/${PAUL}/history/h1`), {
    ts: Date.now(), action: 'Place transmise avec succès', delta: 10, detail: '',
  }));

  // 10. Les compteurs des deux conducteurs sont mis à jour par celui qui clôture.
  await assertSucceeds(set(ref(paul, `users/${PAUL}/stats/given`), 1));
  await assertSucceeds(set(ref(paul, `users/${LEA}/stats/taken`), 1));

  // 11. Chacun range ses affaires.
  await assertSucceeds(remove(ref(paul, `spots/${PAUL}`)));
  await assertSucceeds(remove(ref(lea, `seekers/${LEA}`)));
  await assertSucceeds(remove(ref(lea, `offers/${LEA}`)));
});

test('la carte reste visible : places, recherches et signalements', async () => {
  await assertSucceeds(get(ref(lea, 'spots')));
  await assertSucceeds(get(ref(lea, 'seekers')));
  await assertSucceeds(get(ref(lea, 'freespots')));
});

test('signaler une place libre, la remercier, la signaler comme fausse', async () => {
  await assertSucceeds(set(ref(paul, 'freespots/f1'), {
    uid: PAUL, lat: 48.8566, lng: 2.3522, expiresAt: Date.now() + 420_000, qual: 'normal',
  }));
  await assertSucceeds(set(ref(lea, `freespots/f1/thanks/${LEA}`), true));
  await assertSucceeds(set(ref(lea, `freespots/f1/reports/${LEA}`), true));
  // Seul son auteur peut le retirer.
  await assertFails(remove(ref(lea, 'freespots/f1')));
  await assertSucceeds(remove(ref(paul, 'freespots/f1')));
});

test('l’abonnement aux notifications et la suppression du compte fonctionnent', async () => {
  await assertSucceeds(set(ref(lea, `users/${LEA}/pushSubs/appareil1`), {
    endpoint: 'https://push.example/abc', keys: { p256dh: 'a', auth: 'b' }, updatedAt: Date.now(),
  }));
  await assertFails(get(ref(paul, `users/${LEA}/pushSubs`)));
  await assertSucceeds(remove(ref(lea, `users/${LEA}`)));
});
