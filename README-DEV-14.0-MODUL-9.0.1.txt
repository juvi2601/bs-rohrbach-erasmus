DEV 14.0 – Modul 9.0.1 Multi-Reise-Routing-Grundlage

Zielstruktur:
- /                         bleibt vorerst die bestehende Brüssel-2026-Seite
- /bruessel-2026/           ist ab jetzt als künftige Reise-URL reserviert
- /<reise-id>/              Schema für weitere veröffentlichte Reisen

In diesem Schritt:
- KEINE Veröffentlichung neuer Reisen
- KEINE neue Übersichtsseite
- KEINE Änderung an Brüssel-HTML/CSS/JS
- /bruessel-2026/ leitet vorerst sicher auf / weiter
- /api/trips/routes liefert den aktuellen Routing-Plan
- publishingEnabled bleibt false

Erst in den Folgeschritten wird eine veröffentlichte Reise unter ihrer eigenen URL direkt gerendert.
