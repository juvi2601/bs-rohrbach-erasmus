DEV 14.0 – Modul 6.2: Token-Fix
Behoben: `const token = await token()` verursachte den Fehler
"Cannot access 'token' before initialization".
Die lokale Variable heißt nun `accessToken`.
Gilt für Titelbild, Hotelbild und Programmbild.
