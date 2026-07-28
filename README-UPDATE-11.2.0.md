# Update 11.2.0 – auswählbare Programmsymbole

## Enthaltene Änderungen

- Programmsymbol beim Reiseprogramm als Auswahlfeld im CMS
- zentrale Zuordnung der Auswahl zu den vorhandenen einheitlichen SVG-Icons
- automatische Erkennung bleibt als Standard erhalten
- bestehende Programmpunkte bleiben kompatibel
- Versionsanzeige im Admin-Dashboard auf 11.2.0 aktualisiert
- Versionsanzeige der öffentlichen Website auf 11.2.0 aktualisiert
- Cache-Version für Admin-CSS und Admin-JavaScript aktualisiert

## Installation

1. ZIP entpacken.
2. Den **Inhalt** des Ordners `Update-11.2.0` in den lokalen Repository-Ordner `bs-rohrbach-erasmus` kopieren.
3. Beim Kopieren **Dateien im Ziel ersetzen** bestätigen.
4. In GitHub Desktop prüfen, ob mindestens diese Dateien als geändert erscheinen:
   - `public/app.js`
   - `public/admin/config.yml`
   - `admin/config.yml`
   - `public/admin/index.html`
   - `admin/index.html`
   - `public/version.json`
5. Commit-Nachricht: `Version 11.2.0 – Programmsymbole im CMS`
6. **Commit to main** und danach **Push origin**.
7. Nach dem Cloudflare-Deployment die Admin-Seite mit **Strg + F5** neu laden.

## Kontrolle

Im Admin-Dashboard muss danach **Version 11.2.0** und **28.07.2026** erscheinen. Im CMS befindet sich bei jedem Programmpunkt das Feld **Programmsymbol**.
