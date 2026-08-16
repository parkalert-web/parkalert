"""Coeur de Temoir : profil local, recherche, valeurs calculees.

Aucune dependance externe, aucun acces reseau : tout reste sur le PC.
Ce module ne contient aucune interface graphique, il est donc testable seul
(voir test_core.py).
"""

from __future__ import annotations

import json
import os
import re
import sys
import unicodedata
import uuid
from dataclasses import dataclass, field as dataclass_field
from datetime import date, datetime

APP_NAME = "Temoir"
FORMAT_VERSION = 1

# Formats de date acceptes pour la date de naissance.
DATE_FORMATS = ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d.%m.%Y")

# Identifiant du champ qui sert de source aux valeurs calculees (age, etc.).
BIRTH_FIELD_ID = "date_naissance"

# Identifiants reserves aux valeurs recalculees : un champ enregistre ne peut
# pas les utiliser, sinon deux lignes porteraient le meme identifiant.
COMPUTED_IDS = ("age_calcule", "annee_naissance", "tranche_age")


def normalize(text: str) -> str:
    """Minuscules, sans accent, sans ponctuation : sert a la recherche."""
    text = unicodedata.normalize("NFD", text or "")
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = text.lower()
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def parse_date(value: str):
    """Renvoie un datetime.date ou None si la valeur n'est pas une date."""
    value = (value or "").strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def compute_age(birth: date, today: date | None = None) -> int:
    today = today or date.today()
    years = today.year - birth.year
    if (today.month, today.day) < (birth.month, birth.day):
        years -= 1
    return years


def age_bracket(age: int) -> str:
    """Tranche d'age telle qu'elle est demandee dans la plupart des formulaires."""
    bounds = [(18, "moins de 18"), (25, "18-24"), (35, "25-34"), (45, "35-44"),
              (55, "45-54"), (65, "55-64")]
    for limit, label in bounds:
        if age < limit:
            return label
    return "65 et plus"


@dataclass
class Field:
    """Une information reelle te concernant, saisie une fois, reutilisee partout."""

    label: str
    value: str = ""
    category: str = "Divers"
    aliases: list[str] = dataclass_field(default_factory=list)
    notes: str = ""
    id: str = ""
    updated_at: str = ""
    used_count: int = 0
    last_used_at: str = ""

    def __post_init__(self):
        if not self.id:
            self.id = normalize(self.label).replace(" ", "_") or uuid.uuid4().hex[:8]
        if not self.updated_at:
            self.updated_at = datetime.now().isoformat(timespec="seconds")

    @property
    def computed(self) -> bool:
        return False

    def touch(self) -> None:
        self.updated_at = datetime.now().isoformat(timespec="seconds")

    def haystack(self) -> str:
        parts = [self.label, self.category, self.notes, self.value] + list(self.aliases)
        return normalize(" ".join(p for p in parts if p))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "label": self.label,
            "value": self.value,
            "category": self.category,
            "aliases": self.aliases,
            "notes": self.notes,
            "updated_at": self.updated_at,
            "used_count": self.used_count,
            "last_used_at": self.last_used_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Field":
        return cls(
            label=data.get("label", ""),
            value=data.get("value", ""),
            category=data.get("category", "Divers"),
            aliases=list(data.get("aliases", [])),
            notes=data.get("notes", ""),
            id=data.get("id", ""),
            updated_at=data.get("updated_at", ""),
            used_count=int(data.get("used_count", 0)),
            last_used_at=data.get("last_used_at", ""),
        )


@dataclass
class ComputedField(Field):
    """Champ recalcule a chaque lecture (age, annee de naissance, tranche d'age).

    C'est ce qui garantit la coherence : l'age n'est jamais stocke, il est
    toujours deduit de la date de naissance, donc il ne peut pas se contredire
    d'un questionnaire a l'autre.
    """

    source: str = BIRTH_FIELD_ID

    @property
    def computed(self) -> bool:
        return True


def default_fields() -> list[Field]:
    """Champs proposes au premier lancement, valeurs vides : a toi de les remplir."""
    raw = [
        # (categorie, libelle, mots-cles)
        ("Identite", "Prenom", ["first name", "prenom"]),
        ("Identite", "Nom", ["last name", "nom de famille", "surname"]),
        ("Identite", "Date de naissance", ["birth", "ne le", "anniversaire", "dob"]),
        ("Identite", "Genre", ["sexe", "homme", "femme", "gender"]),
        ("Identite", "Situation familiale", ["marie", "celibataire", "couple", "statut marital"]),
        ("Identite", "Nombre d'enfants", ["enfants", "children"]),
        ("Identite", "Nationalite", ["nationality"]),

        ("Contact", "Adresse e-mail", ["mail", "courriel", "email"]),
        ("Contact", "Telephone mobile", ["portable", "gsm", "numero"]),
        ("Contact", "Adresse", ["rue", "street", "domicile"]),
        ("Contact", "Code postal", ["cp", "zip", "postal"]),
        ("Contact", "Ville", ["city", "commune"]),
        ("Contact", "Pays", ["country"]),
        ("Contact", "Region", ["departement", "province"]),

        ("Foyer", "Nombre de personnes dans le foyer", ["foyer", "menage", "household"]),
        ("Foyer", "Type de logement", ["maison", "appartement", "logement"]),
        ("Foyer", "Proprietaire ou locataire", ["proprietaire", "locataire"]),
        ("Foyer", "Revenu annuel du foyer", ["revenu", "salaire du foyer", "income"]),
        ("Foyer", "Animaux de compagnie", ["chien", "chat", "animal"]),

        ("Vie quotidienne", "Operateur mobile", ["forfait", "sfr", "orange", "free"]),
        ("Vie quotidienne", "Banque principale", ["banque", "bank"]),
        ("Vie quotidienne", "Supermarche habituel", ["courses", "magasin", "enseigne"]),
        ("Vie quotidienne", "Fumeur", ["cigarette", "tabac", "smoker"]),
        ("Vie quotidienne", "Regime alimentaire", ["vegetarien", "alimentation", "diet"]),
        ("Vie quotidienne", "Sport pratique", ["sport", "activite physique"]),
        ("Vie quotidienne", "Loisirs", ["hobbies", "passe-temps"]),

        ("Vehicule", "Possede une voiture", ["voiture", "auto", "vehicule"]),
        ("Vehicule", "Marque du vehicule", ["marque", "modele"]),
        ("Vehicule", "Annee du vehicule", ["annee voiture"]),

        ("Numerique", "Systeme du telephone", ["android", "iphone", "ios"]),
        ("Numerique", "Reseaux sociaux utilises", ["facebook", "instagram", "tiktok"]),
        ("Numerique", "Fournisseur internet", ["box", "internet", "fai"]),
    ]
    return [Field(label=label, category=cat, aliases=aliases) for cat, label, aliases in raw]


def default_config() -> dict:
    return {
        "hotkey": "ctrl+alt+space",
        "input_mode": "frappe",    # "frappe" (clavier simule) ou "collage" (Ctrl+V)
        "tab_after_fill": False,   # appuyer sur Tab apres avoir tape la valeur
        "type_delay_ms": 120,      # attente avant frappe, le temps que la fenetre revienne
        "close_after_fill": True,
    }


def data_dir() -> str:
    """Dossier de stockage local (aucune synchronisation, aucun envoi)."""
    override = os.environ.get("TEMOIR_HOME")
    if override:
        return override
    if sys.platform.startswith("win"):
        base = os.environ.get("APPDATA") or os.path.expanduser("~")
        return os.path.join(base, APP_NAME)
    base = os.environ.get("XDG_CONFIG_HOME") or os.path.join(os.path.expanduser("~"), ".config")
    return os.path.join(base, "temoir")


class Profile:
    """L'ensemble de tes informations + la configuration de l'application."""

    def __init__(self, path: str | None = None):
        self.path = path or os.path.join(data_dir(), "profil.json")
        self.fields: list[Field] = []
        self.config: dict = default_config()

    # ---------------------------------------------------------------- fichier
    def load(self) -> "Profile":
        if not os.path.exists(self.path):
            self.fields = default_fields()
            self.config = default_config()
            self.save()
            return self
        with open(self.path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        self.fields = [Field.from_dict(item) for item in data.get("fields", [])]
        config = default_config()
        config.update(data.get("config", {}))
        self.config = config
        self._ensure_unique_ids()
        return self

    def _ensure_unique_ids(self) -> None:
        """Deux champs ne doivent jamais partager un identifiant (fichier bricole
        a la main, import d'un autre profil, identifiant reserve...)."""
        seen = set(COMPUTED_IDS)
        for item in self.fields:
            if not item.id or item.id in seen:
                item.id = f"{item.id or 'champ'}_{uuid.uuid4().hex[:4]}"
            seen.add(item.id)

    def save(self) -> None:
        os.makedirs(os.path.dirname(self.path) or ".", exist_ok=True)
        payload = {
            "version": FORMAT_VERSION,
            "saved_at": datetime.now().isoformat(timespec="seconds"),
            "config": self.config,
            "fields": [f.to_dict() for f in self.fields],
        }
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
        if os.path.exists(self.path):
            backup = self.path + ".bak"
            try:
                if os.path.exists(backup):
                    os.remove(backup)
                os.replace(self.path, backup)
            except OSError:
                pass
        os.replace(tmp, self.path)

    def export_to(self, path: str) -> None:
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(
                {
                    "version": FORMAT_VERSION,
                    "config": self.config,
                    "fields": [f.to_dict() for f in self.fields],
                },
                handle,
                ensure_ascii=False,
                indent=2,
            )

    def import_from(self, path: str, replace: bool = False) -> int:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        imported = [Field.from_dict(item) for item in data.get("fields", [])]
        if replace:
            self.fields = imported
            added = len(imported)
        else:
            added = 0
            for item in imported:
                existing = self.by_label(item.label)
                if existing:
                    existing.value = item.value or existing.value
                    existing.aliases = sorted(set(existing.aliases) | set(item.aliases))
                    existing.touch()
                else:
                    self.fields.append(item)
                    added += 1
        self._ensure_unique_ids()
        self.save()
        return added

    # ---------------------------------------------------------------- lecture
    def by_id(self, field_id: str) -> Field | None:
        for item in self.all_fields():
            if item.id == field_id:
                return item
        return None

    def by_label(self, label: str) -> Field | None:
        target = normalize(label)
        for item in self.fields:
            if normalize(item.label) == target:
                return item
        return None

    def birth_date(self) -> date | None:
        item = self.by_label("Date de naissance")
        return parse_date(item.value) if item else None

    def computed_fields(self) -> list[Field]:
        """Valeurs deduites de la date de naissance, toujours a jour."""
        birth = self.birth_date()
        if not birth:
            return []
        age = compute_age(birth)
        return [
            ComputedField(id="age_calcule", label="Age", value=str(age),
                          category="Identite", aliases=["age", "quel age", "how old"]),
            ComputedField(id="annee_naissance", label="Annee de naissance",
                          value=str(birth.year), category="Identite",
                          aliases=["annee naissance", "birth year"]),
            ComputedField(id="tranche_age", label="Tranche d'age",
                          value=age_bracket(age), category="Identite",
                          aliases=["tranche", "age range", "categorie age"]),
        ]

    def all_fields(self) -> list[Field]:
        return self.fields + self.computed_fields()

    def categories(self) -> list[str]:
        seen: list[str] = []
        for item in self.all_fields():
            if item.category not in seen:
                seen.append(item.category)
        return seen

    # -------------------------------------------------------------- recherche
    def search(self, query: str, only_filled: bool = False) -> list[Field]:
        """Classe les champs du plus pertinent au moins pertinent.

        Une requete vide renvoie les champs les plus souvent utilises en premier.
        """
        items = [f for f in self.all_fields() if not only_filled or f.value.strip()]
        query = normalize(query)
        if not query:
            return sorted(items, key=lambda f: (-f.used_count, normalize(f.label)))

        words = query.split()
        scored: list[tuple[int, Field]] = []
        for item in items:
            label = normalize(item.label)
            aliases = [normalize(a) for a in item.aliases]
            hay = item.haystack()
            score = 0
            for word in words:
                if label == word:
                    score += 100
                elif label.startswith(word):
                    score += 60
                elif any(a == word for a in aliases):
                    score += 55
                elif any(a.startswith(word) for a in aliases):
                    score += 40
                elif word in label:
                    score += 30
                elif word in hay:
                    score += 15
                else:
                    score -= 40
            if item.value.strip():
                score += 5
            score += min(item.used_count, 10)
            if score > 0:
                scored.append((score, item))
        scored.sort(key=lambda pair: (-pair[0], normalize(pair[1].label)))
        return [item for _, item in scored]

    # -------------------------------------------------------------- ecriture
    def add(self, label: str, value: str = "", category: str = "Divers",
            aliases: list[str] | None = None, notes: str = "") -> Field:
        item = Field(label=label, value=value, category=category,
                     aliases=aliases or [], notes=notes)
        if self.by_id(item.id):
            item.id = f"{item.id}_{uuid.uuid4().hex[:4]}"
        self.fields.append(item)
        self.save()
        return item

    def update(self, field_id: str, **changes) -> Field | None:
        item = self.by_id(field_id)
        if item is None or item.computed:
            return None
        for key, value in changes.items():
            if hasattr(item, key):
                setattr(item, key, value)
        item.touch()
        self.save()
        return item

    def delete(self, field_id: str) -> bool:
        before = len(self.fields)
        self.fields = [f for f in self.fields if f.id != field_id]
        if len(self.fields) != before:
            self.save()
            return True
        return False

    def record_use(self, field_id: str) -> None:
        item = self.by_id(field_id)
        if item is None or item.computed:
            return
        item.used_count += 1
        item.last_used_at = datetime.now().isoformat(timespec="seconds")
        self.save()

    # ------------------------------------------------------------ coherence
    def coherence_warnings(self) -> list[str]:
        """Signale ce qui pourrait te faire repondre deux choses differentes."""
        warnings: list[str] = []

        seen: dict[str, str] = {}
        for item in self.fields:
            key = normalize(item.label)
            if key in seen:
                warnings.append(
                    f"Deux champs portent le meme nom : « {item.label} ». "
                    "Supprime celui qui ne sert plus."
                )
            seen[key] = item.value

        birth_field = self.by_label("Date de naissance")
        if birth_field and birth_field.value.strip() and not parse_date(birth_field.value):
            warnings.append(
                "La date de naissance n'est pas reconnue "
                f"(« {birth_field.value} »). Utilise le format JJ/MM/AAAA."
            )

        birth = self.birth_date()
        if birth:
            age = compute_age(birth)
            manual_age = self.by_label("Age")
            if manual_age and manual_age.value.strip().isdigit():
                if int(manual_age.value.strip()) != age:
                    warnings.append(
                        f"Ton champ « Age » dit {manual_age.value}, mais ta date de "
                        f"naissance donne {age}. Supprime le champ manuel : l'age est "
                        "recalcule tout seul."
                    )
            if not 5 < age < 120:
                warnings.append(f"L'age calcule ({age} ans) semble impossible, verifie la date.")

        empty = [f.label for f in self.fields if not f.value.strip()]
        if empty:
            preview = ", ".join(empty[:6])
            suite = "..." if len(empty) > 6 else ""
            warnings.append(f"{len(empty)} champ(s) encore vide(s) : {preview}{suite}")

        return warnings
