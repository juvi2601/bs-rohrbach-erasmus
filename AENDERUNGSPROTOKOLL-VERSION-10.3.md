# Version 10.3 – Medienverwaltung

**Datum:** 26.07.2026  
**Ausgangspunkt:** Version 10.2 STABLE

## Neu

- zentrale Medienübersicht im Adminbereich
- Vorschauraster aller auf der Website verwendeten Bilder
- Suche nach Titel, Bereich, Dateiname oder Bildnachweis
- Filter nach Startseite, Programm, Galerie und Karte
- Anzeige des Bildpfads und Kopierfunktion
- direkter Zugang zur CMS-Mediathek für Uploads
- direkte Zugänge zur Galerie-, Startseiten- und Kartenbildpflege
- Anzeige, wie viele Bilder aus dem CMS-Uploadordner stammen

## Galerie verbessert

- eigenes Feld für Alternativtexte
- eigenes Feld für Bildnachweise
- Hinweise zu Bildformat, Größe und Quellenangabe
- Alternativtexte werden auf der öffentlichen Website verwendet
- Bildnachweise erscheinen in der Galerie und im Lightbox-Dialog

## Technik

- zentrale Versionsdatei `public/version.json`
- Admin-Dashboard und Website-Footer lesen dieselbe Versionsnummer
- Service-Worker-Cache auf Version 10.3 aktualisiert
- vorhandene Inhalte werden nicht überschrieben

## Geänderte bzw. neue Dateien

- `VERSION`
- `app.js`
- `styles.css`
- `sw.js`
- `admin/admin.css`
- `admin/admin.js`
- `admin/cms.html`
- `admin/config.yml`
- `admin/index.html`
- `admin/media.html`
- `admin/media.js`
- `public/app.js`
- `public/styles.css`
- `public/sw.js`
- `public/version.json`
- `public/admin/admin.css`
- `public/admin/admin.js`
- `public/admin/cms.html`
- `public/admin/config.yml`
- `public/admin/index.html`
- `public/admin/media.html`
- `public/admin/media.js`

## Commit-Nachricht

`Version 10.3 – Medienverwaltung`
