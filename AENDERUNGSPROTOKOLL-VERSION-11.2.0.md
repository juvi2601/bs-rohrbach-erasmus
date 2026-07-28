# Änderungsprotokoll – Version 11.2.0

## Neue Funktion

- Programmsymbole können bei jedem einzelnen Programmpunkt im CMS über ein Dropdown ausgewählt werden.
- Die Auswahl verwendet weiterhin das bestehende einheitliche SVG-Icon-Set.
- Die manuelle Auswahl hat Vorrang vor der automatischen Texterkennung.
- Option **Automatisch erkennen** lässt das bisherige Verhalten unverändert.
- Alte Programmpunkte ohne `icon` bleiben vollständig kompatibel.

## Technische Änderungen

- `public/app.js`: zentrale Zuordnung der CMS-Werte zu den vorhandenen SVG-Icons ergänzt.
- `public/admin/config.yml`: Select-Feld `icon` bei Programmpunkten ergänzt.
- `admin/config.yml`: identische CMS-Konfiguration synchronisiert.
