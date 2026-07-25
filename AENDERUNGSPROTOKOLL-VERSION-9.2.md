# Version 9.2 – Feinschliff und Performance

## Sichtbare Verbesserungen
- Sanfte Übergänge beim Wechsel zwischen Reisetagen.
- Aktiver Navigationspunkt wird beim Scrollen hervorgehoben.
- Galerie wechselt beim Filtern ruhiger und lädt Bilder gestaffelt ein.
- Galerie ist zusätzlich per Leertaste bedienbar.
- Karten zeigen während des Ladens einen klaren Ladehinweis.
- Programmstatus „Bestätigt“ und „In Planung“ ist optisch klarer erkennbar.
- Mobile Bedienung von Tabs, Filtern und Navigation verbessert.
- Mobile Navigation schließt nun auch bei Klick außerhalb und mit Escape.
- Animationen werden bei aktivierter Einstellung „Bewegung reduzieren“ deaktiviert.

## Performance
- Vorverbindungen zu Wetter- und Kartenservern ergänzt.
- Bilder nutzen asynchrones Decoding und Lazy Loading an weiteren Stellen.
- Service Worker auf Cache-Version `bsr-travel-v920-polish` aktualisiert.
- Statische Dateien werden schneller aus dem Cache geliefert und im Hintergrund aktualisiert.
- Navigation bleibt bei fehlendem Netzwerk offline erreichbar.

## Geänderte Projektdateien
- `VERSION`
- `app.js`
- `index.html`
- `styles.css`
- `sw.js`
- `public/app.js`
- `public/index.html`
- `public/styles.css`
- `public/sw.js`

## Prüfung
- JavaScript-Syntax geprüft.
- Service-Worker-Syntax geprüft.
- Sämtliche JSON-Dateien validiert.
- Root- und `public`-Dateien miteinander abgeglichen.
