# Änderungsprotokoll – Version 11.2.0

Datum: 28.07.2026

## Neu

- Auswählbare Programmsymbole im CMS
- Auswahl „Automatisch erkennen“ als rückwärtskompatibler Standard
- zentrale Icon-Zuordnung in `public/app.js`

## Technisch

- `eventIcon(event)` berücksichtigt zuerst das manuell gewählte Symbol
- ohne manuelle Auswahl greift weiterhin die bestehende Texterkennung
- Admin-Dashboard und öffentliche Versionsdatei auf 11.2.0 aktualisiert
- Cache-Busting der Admin-Ressourcen auf 11.2.0 erhöht
