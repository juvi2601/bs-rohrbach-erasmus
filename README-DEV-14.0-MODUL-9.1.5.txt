DEV 14.0 – Modul 9.1.5 Eigene Upload-URL pro Reise

Brüssel:
- /upload.html bleibt der bestehende Brüssel-Upload.

Linz:
- /linz-2027/upload/ ist die eindeutige Linz-Upload-URL.
- Linz-Hauptseite verlinkt auf diesen Pfad.
- upload.js erkennt die Reise aus dem URL-Pfad.
- API-Aufrufe tragen weiterhin trip=linz-2027.
- Uploads werden unter linz-2027/pending/... gespeichert.
- Rücksprung, Texte, Farben und Titelbild kommen aus dem veröffentlichten Linz-Snapshot.

Zusätzlich:
- public/version.json auf 9.1.5 synchronisiert.
- Brüssel-Hauptseite und dynamisches Template unverändert.
