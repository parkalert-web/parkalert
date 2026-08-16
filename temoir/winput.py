"""Couche Windows de Temoir : raccourci global, frappe clavier, presse-papier.

Tout passe par ctypes (aucune dependance a installer). Sur un autre systeme
que Windows, les fonctions renvoient False proprement : l'application reste
utilisable en mode copier-coller.
"""

from __future__ import annotations

import ctypes
import threading
import time

IS_WINDOWS = hasattr(ctypes, "windll")

# --- constantes Windows -----------------------------------------------------
MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_WIN = 0x0008
MOD_NOREPEAT = 0x4000

WM_HOTKEY = 0x0312
WM_QUIT = 0x0012
PM_NOREMOVE = 0x0000

INPUT_KEYBOARD = 1
KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_UNICODE = 0x0004

SW_RESTORE = 9
CF_UNICODETEXT = 13
GMEM_MOVEABLE = 0x0002

VK_TAB = 0x09
VK_RETURN = 0x0D
VK_CONTROL = 0x11
VK_V = 0x56

NAMED_KEYS = {
    "space": 0x20, "espace": 0x20, "tab": VK_TAB, "enter": VK_RETURN,
    "entree": VK_RETURN, "escape": 0x1B, "echap": 0x1B, "insert": 0x2D,
    "delete": 0x2E, "home": 0x24, "end": 0x23, "pageup": 0x21,
    "pagedown": 0x22, "left": 0x25, "up": 0x26, "right": 0x27, "down": 0x28,
}
NAMED_KEYS.update({f"f{n}": 0x6F + n for n in range(1, 13)})

MODIFIERS = {
    "ctrl": MOD_CONTROL, "control": MOD_CONTROL, "alt": MOD_ALT,
    "shift": MOD_SHIFT, "maj": MOD_SHIFT, "win": MOD_WIN, "windows": MOD_WIN,
}

if IS_WINDOWS:  # pragma: no cover - depend du systeme
    from ctypes import wintypes

    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32

    class KEYBDINPUT(ctypes.Structure):
        _fields_ = [
            ("wVk", wintypes.WORD),
            ("wScan", wintypes.WORD),
            ("dwFlags", wintypes.DWORD),
            ("time", wintypes.DWORD),
            ("dwExtraInfo", wintypes.WPARAM),
        ]

    class MOUSEINPUT(ctypes.Structure):
        _fields_ = [
            ("dx", wintypes.LONG),
            ("dy", wintypes.LONG),
            ("mouseData", wintypes.DWORD),
            ("dwFlags", wintypes.DWORD),
            ("time", wintypes.DWORD),
            ("dwExtraInfo", wintypes.WPARAM),
        ]

    class HARDWAREINPUT(ctypes.Structure):
        _fields_ = [
            ("uMsg", wintypes.DWORD),
            ("wParamL", wintypes.WORD),
            ("wParamH", wintypes.WORD),
        ]

    class _INPUTUNION(ctypes.Union):
        _fields_ = [("ki", KEYBDINPUT), ("mi", MOUSEINPUT), ("hi", HARDWAREINPUT)]

    class INPUT(ctypes.Structure):
        _anonymous_ = ("u",)
        _fields_ = [("type", wintypes.DWORD), ("u", _INPUTUNION)]

    user32.SendInput.argtypes = (wintypes.UINT, ctypes.POINTER(INPUT), ctypes.c_int)
    user32.SendInput.restype = wintypes.UINT
    user32.GetMessageW.argtypes = (ctypes.POINTER(wintypes.MSG), wintypes.HWND,
                                   wintypes.UINT, wintypes.UINT)
    user32.GetMessageW.restype = ctypes.c_int
    user32.PeekMessageW.argtypes = (ctypes.POINTER(wintypes.MSG), wintypes.HWND,
                                    wintypes.UINT, wintypes.UINT, wintypes.UINT)
    user32.RegisterHotKey.argtypes = (wintypes.HWND, ctypes.c_int, wintypes.UINT, wintypes.UINT)
    user32.UnregisterHotKey.argtypes = (wintypes.HWND, ctypes.c_int)
    user32.PostThreadMessageW.argtypes = (wintypes.DWORD, wintypes.UINT,
                                          wintypes.WPARAM, wintypes.LPARAM)
    user32.GetForegroundWindow.restype = wintypes.HWND
    user32.SetForegroundWindow.argtypes = (wintypes.HWND,)
    user32.ShowWindow.argtypes = (wintypes.HWND, ctypes.c_int)
    user32.IsIconic.argtypes = (wintypes.HWND,)
    user32.OpenClipboard.argtypes = (wintypes.HWND,)
    user32.SetClipboardData.argtypes = (wintypes.UINT, wintypes.HANDLE)
    user32.SetClipboardData.restype = wintypes.HANDLE
    kernel32.GlobalAlloc.argtypes = (wintypes.UINT, ctypes.c_size_t)
    kernel32.GlobalAlloc.restype = wintypes.HGLOBAL
    kernel32.GlobalLock.argtypes = (wintypes.HGLOBAL,)
    kernel32.GlobalLock.restype = ctypes.c_void_p
    kernel32.GlobalUnlock.argtypes = (wintypes.HGLOBAL,)
else:  # pragma: no cover - hors Windows
    user32 = None
    kernel32 = None


def available() -> bool:
    """True si la frappe automatique et le raccourci global sont utilisables."""
    return IS_WINDOWS


def parse_hotkey(text: str) -> tuple[int, int]:
    """« ctrl+alt+space » -> (modificateurs, code touche). Leve ValueError."""
    parts = [p.strip().lower() for p in (text or "").split("+") if p.strip()]
    if not parts:
        raise ValueError("Raccourci vide")
    mods = 0
    key = None
    for part in parts:
        if part in MODIFIERS:
            mods |= MODIFIERS[part]
        elif key is None:
            key = part
        else:
            raise ValueError(f"Deux touches principales dans « {text} »")
    if key is None:
        raise ValueError("Il manque une touche apres les modificateurs")
    if key in NAMED_KEYS:
        vk = NAMED_KEYS[key]
    elif len(key) == 1 and (key.isalpha() or key.isdigit()):
        vk = ord(key.upper())
    else:
        raise ValueError(f"Touche inconnue : « {key} »")
    if not mods:
        raise ValueError("Ajoute au moins Ctrl, Alt ou Shift au raccourci")
    return mods, vk


class HotkeyListener:
    """Ecoute un raccourci global dans un thread dedie (Windows uniquement).

    Le callback est appele depuis ce thread : l'interface doit repasser par
    la boucle Tk (via after) avant de toucher aux widgets.
    """

    _next_id = 1

    def __init__(self, hotkey: str, callback):
        self.hotkey = hotkey
        self.callback = callback
        self.error: str | None = None
        self.registered = False
        self._thread: threading.Thread | None = None
        self._thread_id = 0
        self._ready = threading.Event()
        self._id = HotkeyListener._next_id
        HotkeyListener._next_id += 1

    def start(self, timeout: float = 2.0) -> bool:
        if not IS_WINDOWS:
            self.error = "Raccourci global disponible uniquement sous Windows."
            return False
        try:
            self._mods, self._vk = parse_hotkey(self.hotkey)
        except ValueError as exc:
            self.error = str(exc)
            return False
        self._thread = threading.Thread(target=self._run, daemon=True,
                                        name="temoir-hotkey")
        self._thread.start()
        self._ready.wait(timeout)
        return self.registered

    def _run(self):  # pragma: no cover - depend du systeme
        self._thread_id = kernel32.GetCurrentThreadId()
        msg = wintypes.MSG()
        # Force la creation de la file de messages du thread avant RegisterHotKey.
        user32.PeekMessageW(ctypes.byref(msg), None, 0, 0, PM_NOREMOVE)
        if not user32.RegisterHotKey(None, self._id, self._mods | MOD_NOREPEAT, self._vk):
            self.error = (f"Windows refuse le raccourci « {self.hotkey} » : "
                          "il est deja pris par un autre programme.")
            self._ready.set()
            return
        self.registered = True
        self.error = None
        self._ready.set()
        try:
            while True:
                result = user32.GetMessageW(ctypes.byref(msg), None, 0, 0)
                if result in (0, -1):
                    break
                if msg.message == WM_HOTKEY:
                    try:
                        self.callback()
                    except Exception:
                        pass
        finally:
            user32.UnregisterHotKey(None, self._id)
            self.registered = False

    def stop(self) -> None:
        if IS_WINDOWS and self._thread and self._thread.is_alive() and self._thread_id:
            user32.PostThreadMessageW(self._thread_id, WM_QUIT, 0, 0)
            self._thread.join(timeout=1.0)


# --- fenetres ---------------------------------------------------------------
def foreground_window():
    """Poignee de la fenetre active (celle qui contient le champ a remplir)."""
    if not IS_WINDOWS:
        return None
    return user32.GetForegroundWindow()


def focus_window(handle) -> bool:
    """Redonne le focus a une fenetre memorisee avant l'ouverture de Temoir."""
    if not IS_WINDOWS or not handle:
        return False
    if user32.IsIconic(handle):
        user32.ShowWindow(handle, SW_RESTORE)
    return bool(user32.SetForegroundWindow(handle))


# --- clavier ----------------------------------------------------------------
def _key_input(vk: int, scan: int, flags: int):  # pragma: no cover
    item = INPUT()
    item.type = INPUT_KEYBOARD
    item.ki = KEYBDINPUT(wVk=vk, wScan=scan, dwFlags=flags, time=0, dwExtraInfo=0)
    return item


def _send(items) -> bool:  # pragma: no cover
    if not items:
        return True
    array = (INPUT * len(items))(*items)
    sent = user32.SendInput(len(items), array, ctypes.sizeof(INPUT))
    return sent == len(items)


def type_text(text: str) -> bool:
    """Tape le texte caractere par caractere dans la fenetre active."""
    if not IS_WINDOWS or not text:
        return False
    items = []
    for char in text:
        codes = [ord(char)]
        if ord(char) > 0xFFFF:  # emoji et compagnie : paire de substitution
            value = ord(char) - 0x10000
            codes = [0xD800 + (value >> 10), 0xDC00 + (value & 0x3FF)]
        for code in codes:
            items.append(_key_input(0, code, KEYEVENTF_UNICODE))
            items.append(_key_input(0, code, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP))
    return _send(items)


def press_key(vk: int) -> bool:
    """Appuie puis relache une touche (Tab, Entree...)."""
    if not IS_WINDOWS:
        return False
    return _send([_key_input(vk, 0, 0), _key_input(vk, 0, KEYEVENTF_KEYUP)])


def press_tab() -> bool:
    return press_key(VK_TAB)


def set_clipboard(text: str) -> bool:  # pragma: no cover - depend du systeme
    """Place le texte dans le presse-papier Windows."""
    if not IS_WINDOWS:
        return False
    for _ in range(5):
        if user32.OpenClipboard(None):
            break
        time.sleep(0.05)
    else:
        return False
    try:
        user32.EmptyClipboard()
        buffer = ctypes.create_unicode_buffer(text)
        size = ctypes.sizeof(buffer)
        handle = kernel32.GlobalAlloc(GMEM_MOVEABLE, size)
        if not handle:
            return False
        pointer = kernel32.GlobalLock(handle)
        if not pointer:
            return False
        ctypes.memmove(pointer, buffer, size)
        kernel32.GlobalUnlock(handle)
        return bool(user32.SetClipboardData(CF_UNICODETEXT, handle))
    finally:
        user32.CloseClipboard()


def paste_text(text: str) -> bool:
    """Colle via Ctrl+V : utile pour les fenetres qui ignorent la frappe simulee
    (emulateurs Android, certains jeux, applications distantes)."""
    if not IS_WINDOWS or not set_clipboard(text):
        return False
    items = [
        _key_input(VK_CONTROL, 0, 0),
        _key_input(VK_V, 0, 0),
        _key_input(VK_V, 0, KEYEVENTF_KEYUP),
        _key_input(VK_CONTROL, 0, KEYEVENTF_KEYUP),
    ]
    return _send(items)
