"""Temoir - tes vraies informations, saisies une fois, remplies automatiquement.

Lancement :  python temoir.py
Raccourci global (Windows) : Ctrl+Alt+Espace ouvre la recherche rapide,
Entree ecrit la valeur dans le champ ou se trouve deja ton curseur.

Tout est stocke en local dans un simple fichier JSON. Aucune connexion reseau.
"""

from __future__ import annotations

import os
import queue
import subprocess
import sys
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import winput  # noqa: E402
from core import Field, Profile, data_dir  # noqa: E402

APP_TITLE = "Temoir"
ACCENT = "#2563eb"
MUTED = "#64748b"


def short_date(iso: str) -> str:
    if not iso:
        return "-"
    return iso.replace("T", " ")[:16]


class FieldDialog(tk.Toplevel):
    """Creation / modification d'une information."""

    def __init__(self, parent, profile: Profile, field: Field | None = None,
                 preset_label: str = ""):
        super().__init__(parent)
        self.profile = profile
        self.field = field
        self.result: Field | None = None

        self.title("Modifier l'information" if field else "Nouvelle information")
        self.transient(parent)
        self.resizable(False, False)

        body = ttk.Frame(self, padding=16)
        body.grid(row=0, column=0, sticky="nsew")

        ttk.Label(body, text="Nom du champ").grid(row=0, column=0, sticky="w")
        self.label_var = tk.StringVar(value=field.label if field else preset_label)
        label_entry = ttk.Entry(body, textvariable=self.label_var, width=46)
        label_entry.grid(row=1, column=0, sticky="ew", pady=(2, 10))

        ttk.Label(body, text="Ta reponse (ta vraie information)").grid(
            row=2, column=0, sticky="w")
        self.value_text = tk.Text(body, width=46, height=3, wrap="word")
        self.value_text.grid(row=3, column=0, sticky="ew", pady=(2, 10))
        if field:
            self.value_text.insert("1.0", field.value)

        ttk.Label(body, text="Categorie").grid(row=4, column=0, sticky="w")
        self.category_var = tk.StringVar(value=field.category if field else "Divers")
        ttk.Combobox(body, textvariable=self.category_var,
                     values=profile.categories() or ["Divers"], width=44).grid(
            row=5, column=0, sticky="ew", pady=(2, 10))

        ttk.Label(body, text="Mots-cles pour la recherche (separes par des virgules)").grid(
            row=6, column=0, sticky="w")
        self.aliases_var = tk.StringVar(value=", ".join(field.aliases) if field else "")
        ttk.Entry(body, textvariable=self.aliases_var, width=46).grid(
            row=7, column=0, sticky="ew", pady=(2, 10))

        ttk.Label(body, text="Note personnelle (facultatif)").grid(row=8, column=0, sticky="w")
        self.notes_var = tk.StringVar(value=field.notes if field else "")
        ttk.Entry(body, textvariable=self.notes_var, width=46).grid(
            row=9, column=0, sticky="ew", pady=(2, 14))

        buttons = ttk.Frame(body)
        buttons.grid(row=10, column=0, sticky="e")
        ttk.Button(buttons, text="Annuler", command=self.destroy).pack(side="left", padx=(0, 8))
        ttk.Button(buttons, text="Enregistrer", command=self.save).pack(side="left")

        self.bind("<Escape>", lambda _event: self.destroy())
        label_entry.focus_set()
        self.grab_set()
        self.wait_window(self)

    def save(self):
        label = self.label_var.get().strip()
        if not label:
            messagebox.showwarning(APP_TITLE, "Donne un nom au champ.", parent=self)
            return
        value = self.value_text.get("1.0", "end").strip()
        category = self.category_var.get().strip() or "Divers"
        aliases = [a.strip() for a in self.aliases_var.get().split(",") if a.strip()]
        notes = self.notes_var.get().strip()

        if self.field:
            self.result = self.profile.update(self.field.id, label=label, value=value,
                                              category=category, aliases=aliases, notes=notes)
        else:
            self.result = self.profile.add(label=label, value=value, category=category,
                                           aliases=aliases, notes=notes)
        self.destroy()


class SettingsDialog(tk.Toplevel):
    """Reglages : raccourci, mode de saisie, comportement apres remplissage."""

    def __init__(self, parent, app: "TemoirApp"):
        super().__init__(parent)
        self.app = app
        self.title("Reglages")
        self.transient(parent)
        self.resizable(False, False)

        config = app.profile.config
        body = ttk.Frame(self, padding=16)
        body.grid(row=0, column=0, sticky="nsew")

        ttk.Label(body, text="Raccourci global (ex : ctrl+alt+space)").grid(
            row=0, column=0, sticky="w")
        self.hotkey_var = tk.StringVar(value=config.get("hotkey", "ctrl+alt+space"))
        ttk.Entry(body, textvariable=self.hotkey_var, width=34).grid(
            row=1, column=0, sticky="ew", pady=(2, 12))

        ttk.Label(body, text="Maniere d'ecrire dans le champ").grid(row=2, column=0, sticky="w")
        self.mode_var = tk.StringVar(value=config.get("input_mode", "frappe"))
        ttk.Radiobutton(body, text="Frappe clavier simulee (par defaut)",
                        variable=self.mode_var, value="frappe").grid(row=3, column=0, sticky="w")
        ttk.Radiobutton(body,
                        text="Collage Ctrl+V (si la frappe ne passe pas : emulateur, jeu...)",
                        variable=self.mode_var, value="collage").grid(
            row=4, column=0, sticky="w", pady=(0, 12))

        self.tab_var = tk.BooleanVar(value=bool(config.get("tab_after_fill", False)))
        ttk.Checkbutton(body, text="Appuyer sur Tab apres avoir rempli (champ suivant)",
                        variable=self.tab_var).grid(row=5, column=0, sticky="w")

        self.close_var = tk.BooleanVar(value=bool(config.get("close_after_fill", True)))
        ttk.Checkbutton(body, text="Fermer la recherche rapide apres remplissage",
                        variable=self.close_var).grid(row=6, column=0, sticky="w", pady=(0, 12))

        ttk.Label(body, text="Delai avant la frappe (millisecondes)").grid(
            row=7, column=0, sticky="w")
        self.delay_var = tk.IntVar(value=int(config.get("type_delay_ms", 120)))
        ttk.Spinbox(body, from_=0, to=1500, increment=20, textvariable=self.delay_var,
                    width=10).grid(row=8, column=0, sticky="w", pady=(2, 14))

        buttons = ttk.Frame(body)
        buttons.grid(row=9, column=0, sticky="e")
        ttk.Button(buttons, text="Annuler", command=self.destroy).pack(side="left", padx=(0, 8))
        ttk.Button(buttons, text="Enregistrer", command=self.save).pack(side="left")

        self.bind("<Escape>", lambda _event: self.destroy())
        self.grab_set()
        self.wait_window(self)

    def save(self):
        hotkey = self.hotkey_var.get().strip().lower()
        try:
            winput.parse_hotkey(hotkey)
        except ValueError as exc:
            messagebox.showwarning(APP_TITLE, f"Raccourci invalide : {exc}", parent=self)
            return
        self.app.profile.config.update({
            "hotkey": hotkey,
            "input_mode": self.mode_var.get(),
            "tab_after_fill": bool(self.tab_var.get()),
            "close_after_fill": bool(self.close_var.get()),
            "type_delay_ms": int(self.delay_var.get()),
        })
        self.app.profile.save()
        self.app.restart_hotkey()
        self.destroy()


class QuickPanel(tk.Toplevel):
    """Petite fenetre de recherche appelee par le raccourci global.

    Elle est rattachee a la fenetre racine (invisible) et non a la fenetre
    principale : elle s'ouvre donc meme si Temoir est reduit dans la barre
    des taches.
    """

    def __init__(self, app: "TemoirApp"):
        super().__init__(app.root)
        self.app = app
        self.matches: list[Field] = []
        self.target = None

        self.title("Temoir - recherche rapide")
        self.attributes("-topmost", True)
        self.protocol("WM_DELETE_WINDOW", self.hide)

        frame = ttk.Frame(self, padding=12)
        frame.pack(fill="both", expand=True)

        self.query_var = tk.StringVar()
        self.entry = ttk.Entry(frame, textvariable=self.query_var, font=("Segoe UI", 13))
        self.entry.pack(fill="x")
        self.query_var.trace_add("write", lambda *_: self.refresh())

        self.listbox = tk.Listbox(frame, height=9, activestyle="none", font=("Segoe UI", 11))
        self.listbox.pack(fill="both", expand=True, pady=(8, 6))
        self.listbox.bind("<Double-Button-1>", self.validate)

        bottom = ttk.Frame(frame)
        bottom.pack(fill="x")
        ttk.Label(bottom, foreground=MUTED,
                  text="Entree = ecrire dans le champ actif   |   Ctrl+Entree = copier   "
                       "|   Echap = fermer").pack(side="left")
        ttk.Button(bottom, text="Ouvrir Temoir",
                   command=self.app.show_main).pack(side="right")

        for widget in (self.entry, self.listbox):
            widget.bind("<Return>", self.validate)
            widget.bind("<Control-Return>", self.copy_only)
            widget.bind("<Escape>", lambda _event: self.hide())
            widget.bind("<Down>", self.move_down)
            widget.bind("<Up>", self.move_up)

        self.withdraw()

    # ------------------------------------------------------------- affichage
    def show(self, target=None):
        self.target = target
        self.query_var.set("")
        self.refresh()
        self.deiconify()
        self.update_idletasks()
        width, height = 580, 350
        pos_x = (self.winfo_screenwidth() - width) // 2
        pos_y = (self.winfo_screenheight() - height) // 3
        self.geometry(f"{width}x{height}+{pos_x}+{pos_y}")
        self.lift()
        self.focus_force()
        self.entry.focus_set()

    def hide(self):
        self.withdraw()

    def refresh(self):
        query = self.query_var.get()
        self.matches = self.app.profile.search(query)[:40]
        self.listbox.delete(0, "end")
        for item in self.matches:
            value = item.value.replace("\n", " ") or "(vide)"
            if len(value) > 48:
                value = value[:45] + "..."
            suffix = "   [calcule]" if item.computed else ""
            self.listbox.insert("end", f"{item.label} : {value}{suffix}")
        if not self.matches and query.strip():
            self.listbox.insert("end", f"+ Ajouter « {query.strip()} » a mon profil")
        if self.listbox.size():
            self.listbox.selection_clear(0, "end")
            self.listbox.selection_set(0)
            self.listbox.activate(0)

    def move_down(self, _event=None):
        self._move(1)
        return "break"

    def move_up(self, _event=None):
        self._move(-1)
        return "break"

    def _move(self, step: int):
        size = self.listbox.size()
        if not size:
            return
        current = self.listbox.curselection()
        index = max(0, min(size - 1, (current[0] if current else 0) + step))
        self.listbox.selection_clear(0, "end")
        self.listbox.selection_set(index)
        self.listbox.activate(index)
        self.listbox.see(index)

    # -------------------------------------------------------------- actions
    def selected_field(self) -> Field | None:
        selection = self.listbox.curselection()
        if not selection or not self.matches:
            return None
        index = selection[0]
        return self.matches[index] if index < len(self.matches) else None

    def validate(self, _event=None):
        field = self.selected_field()
        if field is None:
            self.create_from_query()
            return "break"
        if not field.value.strip():
            self.fill_or_edit_empty(field)
            return "break"
        self.dispatch(field)
        return "break"

    def dispatch(self, field: Field):
        """Ferme le panneau (pour rendre le focus) puis ecrit la valeur."""
        target = self.target
        if self.app.profile.config.get("close_after_fill", True):
            self.hide()
            self.update_idletasks()
        self.app.fill_target(field, target)
        if not self.winfo_viewable():
            return
        self.refresh()

    def fill_or_edit_empty(self, field: Field):
        if not messagebox.askyesno(
                APP_TITLE, f"« {field.label} » est vide. Le remplir maintenant ?", parent=self):
            return
        dialog = FieldDialog(self, self.app.profile, field)
        self.app.refresh_table()
        if dialog.result and dialog.result.value.strip():
            self.dispatch(dialog.result)

    def copy_only(self, _event=None):
        field = self.selected_field()
        if field and field.value.strip():
            self.app.copy_value(field)
            self.hide()
        return "break"

    def create_from_query(self):
        query = self.query_var.get().strip()
        if not query:
            return
        dialog = FieldDialog(self, self.app.profile, preset_label=query)
        self.app.refresh_table()
        if dialog.result and dialog.result.value.strip():
            self.dispatch(dialog.result)
        else:
            self.refresh()


class TemoirApp:
    """Fenetre principale : le profil, ses categories, ses valeurs."""

    def __init__(self):
        self.profile = Profile().load()
        self.profile.config.setdefault("input_mode", "frappe")

        # La racine reste invisible : la fenetre principale peut donc etre
        # reduite ou fermee sans empecher la recherche rapide de s'ouvrir.
        self.root = tk.Tk()
        self.root.withdraw()

        self.win = tk.Toplevel(self.root)
        self.win.title(APP_TITLE)
        self.win.geometry("940x580")
        self.win.minsize(720, 420)
        self.win.protocol("WM_DELETE_WINDOW", self.close_main)

        self.events: queue.Queue = queue.Queue()
        self.listener: winput.HotkeyListener | None = None

        self._build_menu()
        self._build_body()

        self.panel = QuickPanel(self)
        self.refresh_table()
        self.restart_hotkey()
        self.root.after(60, self._poll_events)
        self._first_run_hint()

    # ---------------------------------------------------------- construction
    def _build_menu(self):
        menu = tk.Menu(self.win)

        file_menu = tk.Menu(menu, tearoff=0)
        file_menu.add_command(label="Exporter mon profil...", command=self.export_profile)
        file_menu.add_command(label="Importer un profil...", command=self.import_profile)
        file_menu.add_separator()
        file_menu.add_command(label="Ouvrir le dossier de mes donnees", command=self.open_data_dir)
        file_menu.add_separator()
        file_menu.add_command(label="Quitter Temoir", command=self.quit)
        menu.add_cascade(label="Fichier", menu=file_menu)

        tools_menu = tk.Menu(menu, tearoff=0)
        tools_menu.add_command(label="Recherche rapide", command=self.open_panel)
        tools_menu.add_command(label="Verifier la coherence", command=self.show_coherence)
        tools_menu.add_command(label="Reglages...", command=self.open_settings)
        menu.add_cascade(label="Outils", menu=tools_menu)

        help_menu = tk.Menu(menu, tearoff=0)
        help_menu.add_command(label="Comment ca marche", command=self.show_help)
        menu.add_cascade(label="Aide", menu=help_menu)

        self.win.config(menu=menu)

    def _build_body(self):
        top = ttk.Frame(self.win, padding=(12, 12, 12, 6))
        top.pack(fill="x")

        ttk.Label(top, text="Rechercher :").pack(side="left")
        self.search_var = tk.StringVar()
        ttk.Entry(top, textvariable=self.search_var, width=36).pack(side="left", padx=8)
        self.search_var.trace_add("write", lambda *_: self.refresh_table())

        ttk.Button(top, text="Nouvelle information", command=self.new_field).pack(side="left")
        ttk.Button(top, text="Recherche rapide", command=self.open_panel).pack(side="left", padx=8)

        container = ttk.Frame(self.win)
        container.pack(fill="both", expand=True, padx=12, pady=6)

        columns = ("valeur", "categorie", "maj")
        self.tree = ttk.Treeview(container, columns=columns, show="tree headings",
                                 selectmode="browse")
        self.tree.heading("#0", text="Information")
        self.tree.heading("valeur", text="Ma reponse")
        self.tree.heading("categorie", text="Categorie")
        self.tree.heading("maj", text="Mise a jour")
        self.tree.column("#0", width=260, anchor="w")
        self.tree.column("valeur", width=350, anchor="w")
        self.tree.column("categorie", width=150, anchor="w")
        self.tree.column("maj", width=130, anchor="w")
        self.tree.tag_configure("calcule", foreground=ACCENT)
        self.tree.tag_configure("vide", foreground=MUTED)

        scrollbar = ttk.Scrollbar(container, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)
        self.tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        self.tree.bind("<Double-Button-1>", lambda _event: self.edit_field())

        actions = ttk.Frame(self.win, padding=(12, 0, 12, 8))
        actions.pack(fill="x")
        ttk.Button(actions, text="Modifier", command=self.edit_field).pack(side="left")
        ttk.Button(actions, text="Copier la valeur", command=self.copy_selected).pack(
            side="left", padx=8)
        ttk.Button(actions, text="Supprimer", command=self.delete_field).pack(side="left")
        ttk.Button(actions, text="Verifier la coherence", command=self.show_coherence).pack(
            side="right")

        self.status = tk.StringVar(value="")
        ttk.Label(self.win, textvariable=self.status, foreground=MUTED,
                  padding=(12, 0, 12, 10)).pack(fill="x")

        self.win.bind("<Control-k>", lambda _event: self.open_panel())

    # -------------------------------------------------------------- donnees
    def refresh_table(self):
        for row in self.tree.get_children():
            self.tree.delete(row)
        query = self.search_var.get()
        fields = self.profile.search(query) if query.strip() else self.profile.all_fields()

        by_category: dict[str, list[Field]] = {}
        for item in fields:
            by_category.setdefault(item.category, []).append(item)

        for category, items in by_category.items():
            parent = self.tree.insert("", "end", text=category, open=True, values=("", "", ""))
            for item in sorted(items, key=lambda f: f.label.lower()):
                tags = []
                if item.computed:
                    tags.append("calcule")
                elif not item.value.strip():
                    tags.append("vide")
                value = item.value.replace("\n", " ") or "(a remplir)"
                self.tree.insert(parent, "end", iid=item.id, text=item.label,
                                 values=(value, item.category, short_date(item.updated_at)),
                                 tags=tuple(tags))
        self.update_status()

    def update_status(self):
        filled = sum(1 for f in self.profile.fields if f.value.strip())
        total = len(self.profile.fields)
        warnings = len(self.profile.coherence_warnings())
        if self.listener and self.listener.registered:
            hotkey = f"raccourci {self.profile.config.get('hotkey')} actif"
        elif winput.available():
            error = self.listener.error if self.listener else "non demarre"
            hotkey = f"raccourci inactif ({error})"
        else:
            hotkey = "frappe automatique : Windows uniquement (ici, mode copier-coller)"
        self.status.set(f"{filled}/{total} informations remplies   -   "
                        f"{warnings} point(s) a verifier   -   {hotkey}")

    def selected_field(self) -> Field | None:
        selection = self.tree.selection()
        return self.profile.by_id(selection[0]) if selection else None

    def new_field(self):
        FieldDialog(self.win, self.profile)
        self.refresh_table()

    def edit_field(self):
        field = self.selected_field()
        if field is None:
            return
        if field.computed:
            messagebox.showinfo(
                APP_TITLE,
                "Cette valeur est calculee a partir de ta date de naissance : "
                "elle se met a jour toute seule, il n'y a rien a modifier.",
                parent=self.win)
            return
        FieldDialog(self.win, self.profile, field)
        self.refresh_table()

    def delete_field(self):
        field = self.selected_field()
        if field is None or field.computed:
            return
        if messagebox.askyesno(APP_TITLE, f"Supprimer « {field.label} » ?", parent=self.win):
            self.profile.delete(field.id)
            self.refresh_table()

    def copy_selected(self):
        field = self.selected_field()
        if field and field.value.strip():
            self.copy_value(field)

    def copy_value(self, field: Field):
        self.root.clipboard_clear()
        self.root.clipboard_append(field.value)
        self.profile.record_use(field.id)
        self.status.set(f"« {field.label} » copie dans le presse-papier.")

    # ------------------------------------------------------------ remplissage
    def fill_target(self, field: Field, target=None):
        """Ecrit la valeur dans la fenetre qui avait le focus avant Temoir."""
        self.profile.record_use(field.id)
        self.refresh_table()

        if not winput.available():
            self.copy_value(field)
            messagebox.showinfo(
                APP_TITLE,
                "La frappe automatique fonctionne sous Windows. "
                "La valeur a ete copiee : colle-la avec Ctrl+V.",
                parent=self.win)
            return

        if target:
            winput.focus_window(target)
        delay = max(int(self.profile.config.get("type_delay_ms", 120)), 20)
        self.root.after(delay, lambda: self._write(field))

    def _write(self, field: Field):
        mode = self.profile.config.get("input_mode", "frappe")
        written = (winput.paste_text(field.value) if mode == "collage"
                   else winput.type_text(field.value))
        if written and self.profile.config.get("tab_after_fill", False):
            winput.press_tab()
        if written:
            self.status.set(f"« {field.label} » ecrit dans la fenetre active.")
        else:
            self.copy_value(field)
            self.status.set(f"Impossible d'ecrire ici : « {field.label} » a ete copie "
                            "(Ctrl+V pour coller).")

    # -------------------------------------------------------------- raccourci
    def restart_hotkey(self):
        if self.listener:
            self.listener.stop()
            self.listener = None
        listener = winput.HotkeyListener(
            self.profile.config.get("hotkey", "ctrl+alt+space"), self._on_hotkey)
        listener.start()
        self.listener = listener
        self.update_status()

    def _on_hotkey(self):
        """Appele depuis le thread du raccourci : on note la fenetre active."""
        self.events.put(("panel", winput.foreground_window()))

    def _poll_events(self):
        try:
            while True:
                kind, payload = self.events.get_nowait()
                if kind == "panel":
                    self.panel.show(payload)
        except queue.Empty:
            pass
        self.root.after(60, self._poll_events)

    def open_panel(self):
        self.panel.show(None)

    def open_settings(self):
        SettingsDialog(self.win, self)

    def show_main(self):
        self.win.deiconify()
        self.win.lift()
        self.win.focus_force()

    def close_main(self):
        if not (self.listener and self.listener.registered):
            self.quit()
            return
        self.win.withdraw()
        messagebox.showinfo(
            APP_TITLE,
            "Temoir continue en arriere-plan.\n\n"
            f"Le raccourci {self.profile.config.get('hotkey')} ouvre toujours la recherche "
            "rapide, et le bouton « Ouvrir Temoir » de cette recherche ramene cette fenetre.\n\n"
            "Pour quitter vraiment : menu Fichier > Quitter Temoir.")

    # ------------------------------------------------------------- fichiers
    def export_profile(self):
        path = filedialog.asksaveasfilename(
            parent=self.win, title="Exporter mon profil", defaultextension=".json",
            initialfile="temoir-profil.json", filetypes=[("Fichier JSON", "*.json")])
        if path:
            self.profile.export_to(path)
            messagebox.showinfo(APP_TITLE, f"Profil exporte :\n{path}", parent=self.win)

    def import_profile(self):
        path = filedialog.askopenfilename(parent=self.win, title="Importer un profil",
                                          filetypes=[("Fichier JSON", "*.json")])
        if not path:
            return
        replace = messagebox.askyesno(
            APP_TITLE,
            "Remplacer entierement le profil actuel ?\n\n"
            "Oui = tout remplacer\nNon = completer les champs manquants",
            parent=self.win)
        added = self.profile.import_from(path, replace=replace)
        self.refresh_table()
        messagebox.showinfo(APP_TITLE, f"{added} champ(s) importe(s).", parent=self.win)

    def open_data_dir(self):
        folder = data_dir()
        os.makedirs(folder, exist_ok=True)
        try:
            if sys.platform.startswith("win"):
                os.startfile(folder)  # type: ignore[attr-defined]
            elif sys.platform == "darwin":
                subprocess.Popen(["open", folder])
            else:
                subprocess.Popen(["xdg-open", folder])
        except Exception:
            messagebox.showinfo(APP_TITLE, f"Tes donnees sont ici :\n{folder}", parent=self.win)

    # ----------------------------------------------------------------- aide
    def show_coherence(self):
        warnings = self.profile.coherence_warnings()
        if not warnings:
            messagebox.showinfo(APP_TITLE,
                                "Tout est coherent : aucune contradiction, aucun champ vide.",
                                parent=self.win)
            return
        messagebox.showwarning(APP_TITLE, "\n\n".join(f"- {w}" for w in warnings),
                               parent=self.win)

    def show_help(self):
        hotkey = self.profile.config.get("hotkey", "ctrl+alt+space")
        messagebox.showinfo(
            APP_TITLE,
            "1. Remplis une fois tes vraies informations dans cette fenetre "
            "(double-clic sur une ligne).\n"
            "2. Laisse Temoir ouvert, tu peux le reduire.\n"
            f"3. Devant un formulaire, clique dans le champ a remplir puis fais {hotkey}.\n"
            "4. Tape un mot (ex : « code postal ») puis Entree : ta valeur s'ecrit toute seule.\n\n"
            "L'age, l'annee de naissance et la tranche d'age sont recalcules a partir de ta date "
            "de naissance : ils ne peuvent pas se contredire d'un formulaire a l'autre.\n\n"
            "Si une reponse n'existe pas encore, tape-la dans la recherche rapide puis choisis "
            "« Ajouter » : elle sera reutilisee a l'identique les fois suivantes.",
            parent=self.win)

    def _first_run_hint(self):
        if any(f.value.strip() for f in self.profile.fields):
            return
        self.root.after(400, lambda: messagebox.showinfo(
            APP_TITLE,
            "Bienvenue. Commence par remplir tes vraies informations : "
            "double-clique sur une ligne pour saisir ta reponse.\n\n"
            f"Ensuite, le raccourci {self.profile.config.get('hotkey', 'ctrl+alt+space')} "
            "les ecrira automatiquement dans n'importe quel formulaire.",
            parent=self.win))

    # ----------------------------------------------------------------- cycle
    def quit(self):
        if self.listener:
            self.listener.stop()
        self.profile.save()
        self.root.destroy()

    def run(self):
        self.root.mainloop()


def main():
    try:
        TemoirApp().run()
    except tk.TclError as exc:
        print(f"Interface graphique indisponible : {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
