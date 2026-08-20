/**
 * Règles de priorité et de refus, sur trois téléphones :
 *  §14 « Maintenant » -> le plus rapide passe devant celui qui a le plus de points ;
 *  §15 une proposition refusée passe immédiatement au candidat suivant.
 */

import {
  launch, openPhone, signUp, startSearch, announceDeparture,
  waitModal, clickAction, cleanup, sleep, log, north, assert,
} from './harness.mjs';

const SPOT = { latitude: 48.8566, longitude: 2.3522 };
const rig = await launch();
const paul = await openPhone(rig, { tag: 'PAUL (donne)', geo: SPOT });
const proche = await openPhone(rig, { tag: 'PROCHE', geo: north(SPOT, 150) });
const loin = await openPhone(rig, { tag: 'LOIN', geo: north(SPOT, 900) });

const modalVisible = (p) => p.page.locator('#modal-back.show').count().then((n) => n > 0);

try {
  await signUp(paul, { pseudo: 'Paul', vehicle: 'Renault Captur 2023 rouge' });
  await signUp(proche, { pseudo: 'Proche', vehicle: 'Fiat 500 rouge' });
  await signUp(loin, { pseudo: 'Loin', vehicle: 'Toyota Yaris grise' });

  // On offre des points au conducteur le plus éloigné : « Maintenant » doit
  // malgré tout privilégier celui qui arrive le plus vite (§14).
  await loin.page.evaluate(async () => {
    const m = await import('./src/backend.js');
    await m.addPoints(m.auth.currentUser.uid, 600);
  });
  await sleep(1500);

  await proche.page.locator('#panel').waitFor();
  await startSearch(proche, { radius: 1000 });
  await startSearch(loin, { radius: 1000 });
  await sleep(1500);

  await announceDeparture(paul, 'MAINTENANT');

  // §14 — le plus rapide reçoit la proposition en premier, malgré ses 0 point.
  await waitModal(proche.page, /place compatible va se libérer/i, 45000);
  assert(!(await modalVisible(loin)), '« Maintenant » : le plus rapide est sollicité avant le mieux doté en points (§14)');

  // §15 — refus : la place passe au candidat suivant sans attendre l'expiration.
  await clickAction(proche.page, 'NON MERCI');
  await waitModal(loin.page, /place compatible va se libérer/i, 45000);
  assert(true, 'après un refus, la proposition passe au candidat suivant (§15)');
  await clickAction(loin.page, 'JE VEUX CETTE PLACE');

  await waitModal(paul.page, /souhaite récupérer votre place/i, 30000);
  await clickAction(paul.page, 'REFUSER');
  await sleep(2500);
  const panel = await paul.page.locator('#panel').innerText();
  assert(/plus rapide/i.test(panel), 'un refus du donneur relance la recherche en mode urgence (§24)');

  assert([paul, proche, loin].every((p) => p.errors.length === 0), 'aucune erreur JavaScript pendant le scénario');
  console.log('\n=== SCÉNARIO PRIORITÉS RÉUSSI ===');
} catch (e) {
  console.error('\n=== ÉCHEC ===', e.message);
  for (const p of [paul, proche, loin]) {
    console.log(p.tag, '→', await p.page.locator('#panel').innerText().catch(() => '?'));
    console.log(p.tag, 'modale →', await p.page.locator('#modal-title').textContent().catch(() => '?'));
  }
  process.exitCode = 1;
} finally {
  for (const p of [paul, proche, loin]) await cleanup(p);
  await rig.browser.close();
}
