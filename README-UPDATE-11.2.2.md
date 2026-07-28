# Update 11.2.2 – CMS-Speicherung repariert

Dieses Update behebt die Ursache dafür, dass Änderungen im Adminbereich zwar in GitHub gespeichert, aber auf der Website nicht angezeigt wurden.

## Ursache

Das CMS schrieb bisher überwiegend in `content/*.json`. Der Cloudflare Worker veröffentlicht jedoch ausschließlich den Ordner `public/` und die Website liest daher `public/content/*.json`.

## Behoben

- Alle CMS-Inhaltsdateien zeigen nun auf `public/content/*.json`.
- Bild-Uploads werden unter `public/images/uploads` gespeichert.
- `site_url` und `display_url` zeigen auf die richtige Workers-Adresse.
- Die zuletzt im CMS gewählten Programmsymbole wurden in `public/content/program.json` übernommen.
- Versionsnummer auf 11.2.2 aktualisiert.

## Installation

1. Den Inhalt dieses Update-Ordners in den Hauptordner `bs-rohrbach-erasmus` kopieren.
2. Vorhandene Dateien ersetzen.
3. GitHub Desktop öffnen.
4. Commit-Nachricht: `Version 11.2.2 – CMS-Speicherung repariert`
5. `Commit to main` und danach `Push origin`.
6. Nach dem Deployment die Website mit `Strg + F5` neu laden.

## Test

1. Im Adminbereich einen Programmpunkt öffnen.
2. Ein anderes Programmsymbol auswählen und veröffentlichen.
3. Kurz warten, die Website öffnen und mit `Strg + F5` neu laden.
4. Die Änderung sollte ohne manuelles Kopieren in `public/content/program.json` sichtbar sein.
