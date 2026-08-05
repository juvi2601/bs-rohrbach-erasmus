# Version 12.0.1 – vollständiger Domain-Fix

## Geändert
- CMS-OAuth-Basisadresse auf `https://erasmus-bsrohrbach.eu` umgestellt.
- CMS-Website- und Anzeigeadresse auf die neue Domain umgestellt.
- Aktive Einrichtungsdokumentation und historische Cloudflare-Dokumente von alten `workers.dev`-Adressen bereinigt.
- Keine Inhaltsdateien unter `content/` oder `public/content/` verändert.

## Zusätzlich außerhalb von GitHub erforderlich
In der GitHub OAuth App muss als **Authorization callback URL** eingetragen sein:

`https://erasmus-bsrohrbach.eu/callback`
