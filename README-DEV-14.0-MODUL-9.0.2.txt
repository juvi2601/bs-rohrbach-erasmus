DEV 14.0 – Modul 9.0.2 Brüssel-Routing-Reihenfolge

Fehlerursache:
Cloudflare Static Assets hat /bruessel-2026/ bereits als nicht vorhandene Datei behandelt
und die 404-Seite ausgeliefert, bevor der Worker die Weiterleitung ausführen konnte.

Fix:
- run_worker_first enthält jetzt zusätzlich:
  /bruessel-2026
  /bruessel-2026/
- Die bestehende Worker-Weiterleitung auf / kann damit tatsächlich greifen.
- Keine öffentliche HTML/CSS/JS-Datei wurde verändert.
- Die Hauptadresse / bleibt unverändert die bestätigte Brüssel-Seite.
