"""Tests du coeur de Temoir : python test_core.py

Ces tests ne demandent aucune interface graphique et fonctionnent sur
n'importe quel systeme.
"""

import os
import sys
import tempfile
import unittest
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import winput
from core import Profile, age_bracket, compute_age, normalize, parse_date


class TestOutils(unittest.TestCase):
    def test_normalize_enleve_accents_et_ponctuation(self):
        self.assertEqual(normalize("Adresse e-mail"), "adresse e mail")
        self.assertEqual(normalize("Numéro de téléphone"), "numero de telephone")
        self.assertEqual(normalize("  ÉTÉ  "), "ete")

    def test_parse_date_accepte_plusieurs_formats(self):
        self.assertEqual(parse_date("14/07/1985"), date(1985, 7, 14))
        self.assertEqual(parse_date("1985-07-14"), date(1985, 7, 14))
        self.assertEqual(parse_date("14.07.1985"), date(1985, 7, 14))
        self.assertIsNone(parse_date("pas une date"))
        self.assertIsNone(parse_date(""))

    def test_age_tient_compte_du_jour_anniversaire(self):
        birth = date(1990, 6, 15)
        self.assertEqual(compute_age(birth, date(2026, 6, 14)), 35)
        self.assertEqual(compute_age(birth, date(2026, 6, 15)), 36)
        self.assertEqual(compute_age(birth, date(2026, 12, 31)), 36)

    def test_tranches_age(self):
        self.assertEqual(age_bracket(17), "moins de 18")
        self.assertEqual(age_bracket(24), "18-24")
        self.assertEqual(age_bracket(25), "25-34")
        self.assertEqual(age_bracket(64), "55-64")
        self.assertEqual(age_bracket(80), "65 et plus")


class TestProfil(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.chemin = os.path.join(self.dossier.name, "profil.json")
        self.profile = Profile(self.chemin).load()

    def tearDown(self):
        self.dossier.cleanup()

    def test_premier_lancement_cree_les_champs_par_defaut(self):
        self.assertTrue(os.path.exists(self.chemin))
        self.assertTrue(len(self.profile.fields) > 20)
        self.assertTrue(all(f.value == "" for f in self.profile.fields))
        self.assertIsNotNone(self.profile.by_label("Code postal"))

    def test_sauvegarde_et_rechargement(self):
        champ = self.profile.by_label("Ville")
        self.profile.update(champ.id, value="Lyon")
        recharge = Profile(self.chemin).load()
        self.assertEqual(recharge.by_label("Ville").value, "Lyon")

    def test_valeurs_calculees_suivent_la_date_de_naissance(self):
        naissance = self.profile.by_label("Date de naissance")
        self.profile.update(naissance.id, value="15/06/1990")
        calcules = {f.label: f.value for f in self.profile.computed_fields()}
        attendu = compute_age(date(1990, 6, 15))
        self.assertEqual(calcules["Age"], str(attendu))
        self.assertEqual(calcules["Annee de naissance"], "1990")
        self.assertEqual(calcules["Tranche d'age"], age_bracket(attendu))

    def test_pas_de_valeur_calculee_sans_date(self):
        self.assertEqual(self.profile.computed_fields(), [])

    def test_recherche_trouve_le_bon_champ(self):
        resultats = self.profile.search("code postal")
        self.assertEqual(resultats[0].label, "Code postal")

        resultats = self.profile.search("zip")  # mot-cle
        self.assertEqual(resultats[0].label, "Code postal")

        resultats = self.profile.search("mail")
        self.assertEqual(resultats[0].label, "Adresse e-mail")

    def test_recherche_ignore_les_accents(self):
        self.profile.add("Numéro de sécurité sociale", "1 85 07 75", "Identite")
        resultats = self.profile.search("numero securite")
        self.assertEqual(resultats[0].label, "Numéro de sécurité sociale")

    def test_recherche_vide_classe_par_utilisation(self):
        champ = self.profile.add("Boisson preferee", "cafe", "Vie quotidienne")
        for _ in range(3):
            self.profile.record_use(champ.id)
        self.assertEqual(self.profile.search("")[0].label, "Boisson preferee")
        self.assertEqual(self.profile.by_id(champ.id).used_count, 3)

    def test_meme_reponse_a_chaque_fois(self):
        """Le coeur du besoin : la valeur ne change jamais toute seule."""
        champ = self.profile.add("Marque de voiture", "Renault", "Vehicule")
        premieres = [self.profile.by_id(champ.id).value for _ in range(5)]
        recharge = Profile(self.chemin).load()
        self.assertEqual(set(premieres), {"Renault"})
        self.assertEqual(recharge.by_id(champ.id).value, "Renault")

    def test_ajout_modification_suppression(self):
        champ = self.profile.add("Sport", "natation", "Vie quotidienne", ["nage"])
        self.assertEqual(self.profile.search("nage")[0].id, champ.id)
        self.profile.update(champ.id, value="velo")
        self.assertEqual(self.profile.by_id(champ.id).value, "velo")
        self.assertTrue(self.profile.delete(champ.id))
        self.assertIsNone(self.profile.by_id(champ.id))

    def test_ids_uniques_meme_libelle(self):
        premier = self.profile.add("Couleur", "bleu")
        second = self.profile.add("Couleur", "vert")
        self.assertNotEqual(premier.id, second.id)

    def test_ids_dupliques_corriges_au_chargement(self):
        import json
        contenu = {
            "version": 1,
            "config": {},
            "fields": [
                {"id": "ville", "label": "Ville", "value": "Lyon"},
                {"id": "ville", "label": "Ville de naissance", "value": "Brest"},
                {"id": "age_calcule", "label": "Age bricole", "value": "12"},
            ],
        }
        chemin = os.path.join(self.dossier.name, "abime.json")
        with open(chemin, "w", encoding="utf-8") as handle:
            json.dump(contenu, handle)
        profil = Profile(chemin).load()
        identifiants = [f.id for f in profil.fields]
        self.assertEqual(len(identifiants), len(set(identifiants)))
        self.assertNotIn("age_calcule", identifiants)

    def test_champ_calcule_non_modifiable(self):
        naissance = self.profile.by_label("Date de naissance")
        self.profile.update(naissance.id, value="15/06/1990")
        self.assertIsNone(self.profile.update("age_calcule", value="99"))

    def test_coherence_signale_age_contradictoire(self):
        naissance = self.profile.by_label("Date de naissance")
        self.profile.update(naissance.id, value="15/06/1990")
        self.profile.add("Age", "22", "Identite")
        messages = " ".join(self.profile.coherence_warnings())
        self.assertIn("recalcule tout seul", messages)

    def test_coherence_signale_date_invalide(self):
        naissance = self.profile.by_label("Date de naissance")
        self.profile.update(naissance.id, value="juin 1990")
        messages = " ".join(self.profile.coherence_warnings())
        self.assertIn("JJ/MM/AAAA", messages)

    def test_coherence_signale_doublon(self):
        self.profile.add("Ville", "Lyon")
        messages = " ".join(self.profile.coherence_warnings())
        self.assertIn("meme nom", messages)

    def test_export_import(self):
        champ = self.profile.by_label("Ville")
        self.profile.update(champ.id, value="Nantes")
        export = os.path.join(self.dossier.name, "export.json")
        self.profile.export_to(export)

        autre = Profile(os.path.join(self.dossier.name, "autre.json")).load()
        autre.import_from(export, replace=True)
        self.assertEqual(autre.by_label("Ville").value, "Nantes")

    def test_import_complete_sans_ecraser(self):
        export = os.path.join(self.dossier.name, "export.json")
        self.profile.add("Passion", "photo")
        self.profile.export_to(export)

        autre = Profile(os.path.join(self.dossier.name, "autre.json")).load()
        avant = len(autre.fields)
        ajoutes = autre.import_from(export, replace=False)
        self.assertEqual(ajoutes, 1)
        self.assertEqual(len(autre.fields), avant + 1)
        self.assertEqual(autre.by_label("Passion").value, "photo")

    def test_sauvegarde_de_secours(self):
        champ = self.profile.by_label("Ville")
        self.profile.update(champ.id, value="Brest")
        self.profile.update(champ.id, value="Rennes")
        self.assertTrue(os.path.exists(self.chemin + ".bak"))


class TestRaccourci(unittest.TestCase):
    def test_lecture_du_raccourci(self):
        mods, vk = winput.parse_hotkey("ctrl+alt+space")
        self.assertEqual(mods, winput.MOD_CONTROL | winput.MOD_ALT)
        self.assertEqual(vk, 0x20)

        mods, vk = winput.parse_hotkey("Ctrl+Shift+K")
        self.assertEqual(mods, winput.MOD_CONTROL | winput.MOD_SHIFT)
        self.assertEqual(vk, ord("K"))

        _, vk = winput.parse_hotkey("alt+f9")
        self.assertEqual(vk, 0x78)

    def test_raccourcis_invalides(self):
        for mauvais in ("", "space", "ctrl", "ctrl+abc", "ctrl+a+b"):
            with self.assertRaises(ValueError):
                winput.parse_hotkey(mauvais)

    def test_hors_windows_pas_de_frappe(self):
        if winput.available():
            self.skipTest("Sur Windows la frappe est reellement disponible")
        self.assertFalse(winput.type_text("test"))
        self.assertFalse(winput.paste_text("test"))
        self.assertIsNone(winput.foreground_window())


if __name__ == "__main__":
    unittest.main(verbosity=2)
