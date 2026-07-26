# Version 10.4.2 – React-Kompatibilitätsfix Karteneditor

Datum: 26.07.2026

## Behoben

- Absturz des Decap CMS mit „Minified React error #525“ behoben.
- Extern zusätzlich eingebundene React- und ReactDOM-Versionen entfernt.
- Karten-Widget verwendet nun ausschließlich die von Decap CMS bereitgestellten Komponenten `window.h` und `window.createClass`.
- Interaktive Leaflet-Karte, verschiebbarer Marker und Adresssuche bleiben erhalten.
- Versions- und Cache-Angaben auf 10.4.2 aktualisiert.

## Geänderte Dateien

- `admin/cms.html`
- `admin/map-widget.js`
- `public/admin/cms.html`
- `public/admin/map-widget.js`
- `public/version.json`
- `public/sw.js`
- `sw.js`
