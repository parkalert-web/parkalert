#!/usr/bin/env node
/**
 * ParkAlert Shorts — robot de publication quotidienne.
 *
 *   node youtube-autopost/src/publish.mjs            publie la prochaine vidéo
 *   node youtube-autopost/src/publish.mjs --dry-run  montre ce qui serait publié
 *   node youtube-autopost/src/publish.mjs --preview=30  aperçu de 30 jours de titres
 *   node youtube-autopost/src/publish.mjs --check    vérifie les accès Google
 *
 * Aucune dépendance npm : uniquement Node 20+ et l'API YouTube Data v3.
 */

import { readFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, loadState, saveState, recentTitles, ROOT } from './config.mjs';
import { makeTitle, previewTitles, fillTemplate, rng, countDistinctTitles } from './titles.mjs';
import { credentialsFromEnv, accessToken } from './google.mjs';
import { uploadVideo, videoResource, myChannel } from './youtube.mjs';
import { nextVideo, pending, readVideo, archive } from './queue.mjs';

/* ─────────────────────────── Petits utilitaires ─────────────────────────── */

const args = process.argv.slice(2);
const flag = (nom) => args.some((a) => a === `--${nom}` || a.startsWith(`--${nom}=`));
const value = (nom, defaut) => {
  const a = args.find((x) => x.startsWith(`--${nom}=`));
  return a ? a.slice(nom.length + 3) : defaut;
};
const log = (...m) => console.log(...m);
const octets = (n) => `${(n / 1024 / 1024).toFixed(1)} Mo`;

/** Charge youtube-autopost/.env en local (sur GitHub, ce sont les Secrets). */
async function loadDotEnv() {
  const fichier = path.join(ROOT, '.env');
  if (!existsSync(fichier)) return;
  for (const ligne of (await readFile(fichier, 'utf8')).split('\n')) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

/** Résumé affiché dans l'onglet Actions de GitHub. */
async function resume(texte) {
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${texte}\n`);
}

/** Variables exposées à l'étape suivante du workflow. */
async function sortie(cle, valeur) {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${cle}=${valeur}\n`);
}

/* ─────────────────────────── Composition du texte ─────────────────────────── */

/** Titre + description + mots-clés de la publication du jour. */
export function compose(config, state, video, quand = new Date()) {
  const jour = quand.toISOString().slice(0, 10);
  const numero = state.publications.length + 1;
  const sujet = video?.fiche?.sujet || video?.sujet || config.titre.sujetParDefaut;

  const titre = video?.fiche?.titre
    ? { titre: String(video.fiche.titre).slice(0, config.titre.longueurMax || 100), modele: '(fiche)', repete: false, manquantes: [] }
    : makeTitle({
      titre: config.titre,
      seed: `${jour}#${numero}`,
      subject: sujet,
      index: numero,
      date: quand,
      recent: recentTitles(state, config.titre.eviterRepetitionJours),
    });

  const rand = rng(`${jour}#${numero}#desc`);
  const modelesDesc = (config.description.modeles || ['']).filter((m) => m != null);
  const modele = modelesDesc[Math.floor(rand() * modelesDesc.length) % modelesDesc.length] || '';
  const corps = fillTemplate(modele, {
    sujet, titre: titre.titre, numero: String(numero),
    ...(config.description.variables || {}),
  }, rand, { clean: false }).text;

  const description = [video?.fiche?.description ?? corps, config.description.signature]
    .filter((p) => String(p || '').trim()).join('\n\n').slice(0, 4900);

  const tags = [...new Set([...(config.tags || []), ...(video?.fiche?.tags || [])])]
    .map((t) => String(t).trim()).filter(Boolean);

  return { titre: titre.titre, infoTitre: titre, description, tags, sujet, numero };
}

/* ─────────────────────────── Commandes ─────────────────────────── */

async function commandePreview(config) {
  const jours = Number(value('preview', '14')) || 14;
  const possibles = countDistinctTitles(config.titre);
  log(`\n${possibles} titres différents possibles, soit ${possibles} jours avant la moindre répétition.\n`);
  for (const t of previewTitles(config.titre, jours, { subject: config.titre.sujetParDefaut })) {
    log(`  ${t.date}  ${t.titre}${t.repete ? '   ⚠ répétition' : ''}`);
  }
  log('');
  if (possibles < 60) {
    log(`⚠ Seulement ${possibles} titres possibles : ajoutez des accroches, ou des modèles qui`);
    log('  croisent deux variables (« {accroche} : {sujet} en {duree} » en fabrique bien plus).\n');
  }
}

async function commandeCheck(config) {
  log('• Configuration : valide.');
  const identifiants = credentialsFromEnv();
  const token = await accessToken(identifiants);
  log('• Jeton Google : obtenu.');
  const chaine = await myChannel(token);
  if (!chaine) throw new Error("Aucune chaîne YouTube sur ce compte Google.");
  log(`• Chaîne YouTube : ${chaine.snippet.title}`);
  const file = await pending(config, await loadState(), token);
  log(`• File d'attente : ${file.length} vidéo(s) — ${file.slice(0, 5).map((v) => v.nom).join(', ') || 'vide'}`);
  log('\nTout est prêt. ✅');
}

async function commandePublish(config, { dryRun }) {
  const state = await loadState();
  const identifiants = dryRun && !process.env.YT_REFRESH_TOKEN ? null : credentialsFromEnv();
  const token = identifiants ? await accessToken(identifiants) : null;

  const video = await nextVideo(config, state, token);
  if (!video) {
    const message = "File d'attente vide : ajoutez des vidéos dans "
      + `${config.dossierVideos}/ (ou dans le dossier Drive) pour que la publication reprenne.`;
    await resume(`### 📭 Rien à publier\n${message}`);
    await sortie('publie', 'false');
    if (config.quandLaFileEstVide === 'echouer') throw new Error(message);
    log(`⚠ ${message}`);
    return;
  }

  const texte = compose(config, state, video, new Date());
  log(`\nVidéo   : ${video.nom} (${octets(video.taille)})`);
  log(`Titre   : ${texte.titre}`);
  log(`Mots-clés : ${texte.tags.join(', ') || '—'}`);
  log(`Description :\n${texte.description.split('\n').map((l) => `  │ ${l}`).join('\n')}\n`);
  if (texte.infoTitre.repete) log('⚠ Toutes les combinaisons de titres ont déjà servi : ajoutez des variantes.');
  if (texte.infoTitre.manquantes?.length) log(`⚠ Variables inconnues dans le modèle : ${texte.infoTitre.manquantes.join(', ')}`);

  if (dryRun) {
    log('— Essai à blanc (--dry-run) : rien n\'a été envoyé sur YouTube. —');
    await resume(`### 🧪 Essai à blanc\n**${texte.titre}**\n\n\`${video.nom}\``);
    return;
  }

  const bytes = await readVideo(video, token);
  const publication = { ...config.publication, ...(video.fiche.publication || {}) };
  log(`Envoi en cours (${octets(bytes.length)})…`);
  const { id, url, video: envoyee } = await uploadVideo({
    token,
    bytes,
    mime: video.mime,
    resource: videoResource({ ...texte, publication }),
    notifySubscribers: config.publication.notifierAbonnes,
    log,
  });
  log(`✅ Publié : ${url}`);

  // Un projet Google Cloud qui n'a pas passé l'audit YouTube voit TOUTES ses
  // vidéos forcées en « privé », quelle que soit la confidentialité demandée.
  const obtenue = envoyee?.status?.privacyStatus;
  if (obtenue && obtenue !== publication.confidentialite) {
    const alerte = `⚠ YouTube a mis la vidéo en « ${obtenue} » alors que vous demandiez `
      + `« ${publication.confidentialite} ». C'est la restriction imposée aux projets API non audités : `
      + 'demandez l\'audit (gratuit) sur https://support.google.com/youtube/contact/yt_api_form '
      + '— en attendant, la vidéo est en ligne mais invisible du public.';
    log(alerte);
    await resume(`> ${alerte}`);
  }

  const range = await archive(video, config);
  state.publications.push({
    date: new Date().toISOString(),
    videoId: id, url, titre: texte.titre,
    fichier: video.cle, sujet: texte.sujet, source: video.source,
    ...(range ? { archive: range } : {}),
  });
  await saveState(state);

  const restantes = (await pending(config, state, token)).length;
  await resume(`### ✅ Short publié\n[${texte.titre}](${url})\n\n\`${video.nom}\` — ${restantes} vidéo(s) encore en file.`);
  await sortie('publie', 'true');
  await sortie('url', url);
  await sortie('titre', texte.titre);
  log(`Il reste ${restantes} vidéo(s) dans la file.`);
}

/* ─────────────────────────── Entrée ─────────────────────────── */

async function main() {
  await loadDotEnv();
  const config = await loadConfig(value('config', undefined));
  if (flag('preview')) return commandePreview(config);
  if (flag('check')) return commandeCheck(config);
  return commandePublish(config, { dryRun: flag('dry-run') });
}

// Exécuté seulement en ligne de commande : les tests importent `compose`
// sans déclencher de publication.
const appeleDirectement = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (appeleDirectement) {
  main().catch(async (err) => {
    console.error(`\n❌ ${err.message}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY, `### ❌ Échec\n\`\`\`\n${err.message}\n\`\`\`\n`).catch(() => {});
    }
    process.exitCode = 1;
  });
}
