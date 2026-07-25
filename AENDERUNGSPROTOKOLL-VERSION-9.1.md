# Version 9.1 – Karten- und Botschaftsupdate

## Änderungen

- Gesamtreise-Karte stabilisiert:
  - OpenStreetMap-Kartenkacheln mit zusätzlichem Ersatz-Kartenserver
  - Karte wird beim Umschalten mehrfach korrekt neu vermessen
  - Ersatzroute wird sofort angezeigt
  - OSRM-Routenabfrage erhält ein Zeitlimit von 8 Sekunden
  - bei Ausfall des Routendienstes bleibt die Verbindung Rohrbach–Brüssel sichtbar
- Falsches Foto bei der Österreichischen Botschaft ersetzt.
- Neues aktuelles Foto des Österreichhauses Brüssel eingebunden.
- Bildnachweis im Kartendetail ergänzt: © ÖV Brüssel / BMEIA.
- Service-Worker-Cache auf `bsr-travel-v910-map-fix` erhöht.

## Geänderte Dateien

- `app.js`
- `styles.css`
- `sw.js`
- `content/places.json`
- `images/oesterreichhaus-bruessel.jpg`
- `public/app.js`
- `public/styles.css`
- `public/sw.js`
- `public/content/places.json`
- `public/images/oesterreichhaus-bruessel.jpg`

## Prüfungen

- JavaScript-Syntax geprüft
- JSON-Syntax geprüft
- Root- und `public`-Kopien synchronisiert
- Bilddatei geprüft

## Bildquelle

Offizielles Foto der Ständigen Vertretung Österreichs bei der EU / Österreichhaus Brüssel, BMEIA. Bildnachweis: © ÖV Brüssel.
