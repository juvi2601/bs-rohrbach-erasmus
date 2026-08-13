DEV 14.0 – Modul 9.1.0 Echte Reise-Veröffentlichung

Prinzip:
- Brüssel bleibt auf / unverändert.
- Neue Reise /linz-2027/ wird nur ausgeliefert, wenn ein veröffentlichter Snapshot existiert.
- Der Admin-Button „Reise veröffentlichen“ ist nur bei vollständigem Entwurf aktiv.
- Veröffentlichung erzeugt einen Snapshot der Reisedaten in R2.
- Verwendete Bilder werden in einen eigenen Published-Asset-Bereich kopiert.
- Spätere Änderungen am Entwurf verändern die öffentliche Reise NICHT automatisch.
- Erneutes Veröffentlichen aktualisiert den öffentlichen Snapshot bewusst.

Neue öffentliche Datei:
- public/reise.html (eigener Shell für neue Reisen)

Neue APIs:
- POST /api/trips/publish
- GET /api/trips/public-resource
- GET /api/trips/public-image

Sicherheitsgrenze:
- public/index.html unverändert
- public/app.js unverändert
- public/styles.css unverändert
- public/app-dynamic.js unverändert
- public/styles-dynamic.css unverändert
