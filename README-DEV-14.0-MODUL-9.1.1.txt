DEV 14.0 – Modul 9.1.1 Published-Snapshot Shell-Fix

Beobachtung nach 9.1.0:
- /linz-2027/ war veröffentlicht, zeigte aber Brüssel.
- Der neue Shell und die Published-Data-Provider-Logik waren vorhanden.
- Der bestehende Root-Service-Worker konnte Navigationen jedoch weiterhin mit gecachtem Brüssel-/index.html bedienen.

Fix:
- Öffentliche Einzelreise-Shell deaktiviert/entfernt Root-Service-Worker-Registrierungen.
- app-dynamic.js registriert in TRAVEL_PUBLIC_MODE keinen Service Worker.
- /linz-2027/ liefert reise.html explizit no-store/no-cache aus.
- Diagnose-Header x-bsr-trip-shell: linz-2027/9.1.1.
- Published Snapshot/API bleibt unverändert.

Brüssel-Schutz:
- public/index.html, public/app.js, public/styles.css und public/404.html unverändert.
- Brüssel-Routing unverändert.
