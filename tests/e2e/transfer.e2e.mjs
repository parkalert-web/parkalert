/**
 * Scénario complet du cahier des charges (§36) sur deux téléphones :
 * annonce → proposition → réservation → suivi → prêt → arrivée → double confirmation → points.
 */

import {
  launch, openPhone, signUp, startSearch, announceDeparture,
  waitModal, clickAction, modalTitle, cleanup, sleep, log, north, assert,
} from './harness.mjs';

const SPOT = { latitude: 48.8566, longitude: 2.3522 };
const rig = await launch();
const paul = await openPhone(rig, { tag: 'PAUL (donne)', geo: SPOT });
const lea = await openPhone(rig, { tag: 'LÉA (cherche)', geo: north(SPOT, 200) });

try {
  await signUp(paul, { pseudo: 'Paul', vehicle: 'Renault Captur 2023 rouge' });
  await signUp(lea, { pseudo: 'Lea', vehicle: 'Peugeot 208 blanche' });

  await startSearch(lea);
  await announceDeparture(paul, '10 min');

  // §15 — proposition reçue par le conducteur compatible
  await waitModal(lea.page, /place compatible va se libérer/i, 40000);
  const offer = await lea.page.locator('.offer-hero').innerText();
  log('LÉA', offer.replace(/\n/g, ' | '));
  assert(/de votre destination/.test(offer), 'la proposition annonce la distance à la destination');
  assert(/environ \d+ min/.test(offer), 'la proposition annonce le temps d’arrivée');
  await clickAction(lea.page, 'JE VEUX CETTE PLACE');

  // §16/§17 — le donneur voit modèle + couleur, puis accepte
  await waitModal(paul.page, /souhaite récupérer votre place/i, 30000);
  const who = await modalTitle(paul.page);
  assert(/208/.test(who) && /blanc/i.test(who), `le donneur voit le modèle et la couleur : « ${who} »`);
  await clickAction(paul.page, 'ACCEPTER');

  await paul.page.waitForSelector('#panel .btn:has-text("JE SUIS DANS MA VOITURE")', { timeout: 25000 });
  await lea.page.waitForSelector('#panel .btn:has-text("JE SUIS GARÉ")', { timeout: 25000 });
  assert(true, 'réservation active des deux côtés (§18)');

  // §26 — le motif « je ne peux pas me garer » est refusé tant que le GPS ne confirme rien
  await lea.page.click('#panel .btn:has-text("JE NE PEUX PAS ME GARER")');
  await waitModal(lea.page, /pas encore sur place/i, 15000);
  assert(true, '« je ne peux pas me garer » refusé à distance, sans malus possible (§26)');
  await clickAction(lea.page, 'J’AI COMPRIS');

  // §20 — le donneur se déclare prêt
  await paul.page.click('#panel .btn:has-text("JE SUIS DANS MA VOITURE")');
  await sleep(2000);
  const seen = await lea.page.locator('#panel').innerText();
  assert(/prêt/i.test(seen), 'le conducteur qui arrive voit que la place peut être libérée (§20)');

  // §22 — arrivée réelle confirmée par le GPS, puis double confirmation (§28)
  await lea.ctx.setGeolocation(SPOT);
  await sleep(3000);
  await lea.page.click('#panel .btn:has-text("JE SUIS GARÉ")');
  await sleep(1500);
  await paul.page.click('#panel .btn:has-text("PLACE TRANSMISE")');

  await waitModal(paul.page, /Transmission réussie/i, 25000);
  await clickAction(paul.page, 'J’AI COMPRIS');
  await sleep(1200);
  const points = await paul.page.locator('#hdr-points').textContent();
  assert(points === '10', `le donneur gagne exactement 10 points (§29) — obtenu : ${points}`);

  await waitModal(lea.page, /Bon stationnement/i, 25000);
  const closing = await lea.page.locator('#modal-body').innerText();
  assert(/points de cette transmission reviennent/i.test(closing), 'le conducteur qui récupère la place ne gagne pas de points (§29)');
  await clickAction(lea.page, 'J’AI COMPRIS');

  assert(paul.errors.length === 0 && lea.errors.length === 0, 'aucune erreur JavaScript pendant le scénario');
  console.log('\n=== SCÉNARIO §36 RÉUSSI ===');
} catch (e) {
  console.error('\n=== ÉCHEC ===', e.message);
  await paul.page.screenshot({ path: 'fail-donneur.png' }).catch(() => {});
  await lea.page.screenshot({ path: 'fail-chercheur.png' }).catch(() => {});
  console.log('panneau donneur   :', await paul.page.locator('#panel').innerText().catch(() => '?'));
  console.log('panneau chercheur :', await lea.page.locator('#panel').innerText().catch(() => '?'));
  process.exitCode = 1;
} finally {
  await cleanup(paul); await cleanup(lea);
  await rig.browser.close();
}
