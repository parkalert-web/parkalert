/**
 * Vérifie les deux garde-fous de temps ajoutés côté conducteurs :
 *
 *  1. celui qui attend dans sa voiture qu'on veuille sa place reçoit
 *     régulièrement la main : continuer d'attendre, ou partir ;
 *  2. celui qui roule peut corriger son heure d'arrivée, et celui qui
 *     attend en est informé.
 *
 * Le rappel est raccourci par l'adresse (« ?waitPromptS=3 ») pour ne pas
 * attendre une vraie minute.
 */

import {
  launch, openPhone, signUp, startSearch, announceDeparture,
  waitModal, clickAction, cleanup, sleep, log, north, assert,
} from './harness.mjs';

const PARIS = { latitude: 48.8566, longitude: 2.3522 };
const app = await launch();
let paul; let lea;

try {
  /* ── 1. Attendre seul : la question doit revenir toute seule ── */

  paul = await openPhone(app, { tag: 'PAUL (donne)', geo: PARIS, query: 'waitPromptS=3' });
  await signUp(paul, { pseudo: 'Paul', vehicle: 'Renault Captur 2023 rouge' });
  // « Maintenant » : Paul est dans sa voiture et attend réellement. C'est la
  // situation où la question a un sens — pendant un délai annoncé, il vaque
  // encore à ses occupations et on ne le dérange pas.
  await announceDeparture(paul, 'Maintenant');

  // Personne ne cherche : la question doit arriver d'elle-même.
  await waitModal(paul.page, /Personne pour l’instant/i, 25000);
  log('PAUL', 'la question « continuer ou partir ? » est arrivée seule');
  assert(true, 'le conducteur qui attend reprend la main sans rien faire');

  const corps = await paul.page.locator('#modal').innerText();
  assert(/pars maintenant/i.test(corps) && /continue d’attendre/i.test(corps),
    'les deux issues sont proposées : attendre, ou partir');

  await clickAction(paul.page, 'Je continue d’attendre');
  await sleep(800);
  assert(await paul.page.locator('#panel').isVisible(),
    'choisir d’attendre laisse l’annonce active');

  // Elle doit revenir tant que personne ne se manifeste.
  await waitModal(paul.page, /Personne pour l’instant/i, 25000);
  assert(true, 'la question revient tant que personne ne se manifeste');
  await clickAction(paul.page, 'Je continue d’attendre');

  /* ── 2. Corriger son heure d'arrivée ── */

  // Léa est à 150 m : assez loin pour ne pas être « arrivée » (le bouton de
  // correction d'horaire n'a plus de sens une fois sur place), assez près pour
  // rester dans le rayon de recherche.
  lea = await openPhone(app, { tag: 'LÉA (cherche)', geo: north(PARIS, 150), query: 'waitPromptS=3' });
  await signUp(lea, { pseudo: 'Lea', vehicle: 'Peugeot 208 2022 blanche' });
  await startSearch(lea);

  await waitModal(lea.page, /place compatible va se libérer/i, 45000);
  await clickAction(lea.page, 'Je veux cette place');
  await waitModal(paul.page, /souhaite récupérer votre place/i, 30000);
  await clickAction(paul.page, 'Accepter');

  await lea.page.waitForSelector('#panel .btn:has-text("Je serai plus tôt ou plus tard")', { timeout: 25000 });
  assert(true, 'le conducteur qui roule peut corriger son heure d’arrivée');

  await lea.page.click('#panel .btn:has-text("Je serai plus tôt ou plus tard")');
  await waitModal(lea.page, /Dans combien de temps arrivez-vous/i);
  await lea.page.click('#modal-body .choice:has-text("15 min")');
  await clickAction(lea.page, 'Valider');
  await sleep(2500);

  const panneauLea = await lea.page.locator('#panel').innerText();
  assert(/1[45] min|Vous êtes attendu/i.test(panneauLea), 'la nouvelle heure est prise en compte');

  const panneauPaul = await paul.page.locator('#panel').innerText();
  assert(/corrigé son heure d’arrivée/i.test(panneauPaul),
    'le conducteur qui attend est informé du changement');
  log('PAUL', 'informé de la correction d’horaire');

  assert([paul, lea].every((p) => p.errors.length === 0), 'aucune erreur JavaScript pendant le scénario');
  console.log('\n=== SCÉNARIO ATTENTE ET HORAIRE RÉUSSI ===');
} catch (e) {
  console.error('\n=== ÉCHEC ===', e.message);
  for (const p of [paul, lea]) {
    if (p) console.log(p.tag, '→', await p.page.locator('#panel').innerText().catch(() => '?'));
  }
  process.exitCode = 1;
} finally {
  for (const p of [paul, lea]) { if (p) await cleanup(p).catch(() => {}); }
  await app.browser.close();
}
