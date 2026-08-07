BS Rohrbach Erasmus+ – Version 12.1.0 DEV.3

Behoben:
- beschädigte HTML-Struktur der Microsoft-Seite repariert
- MSAL.js auf die von Microsoft dokumentierte v2-CDN-Version 2.35.0 umgestellt
- explizite Prüfung eingebaut, falls MSAL nicht geladen werden kann
- Microsoft-Skripte in korrekter Reihenfolge geladen
- Graph-Scopes auf User.Read und Files.ReadWrite reduziert
- Cache-Buster auf DEV.3 aktualisiert

Test:
https://erasmus-bsrohrbach.eu/admin/microsoft.html

Nach dem Push: Strg+F5, dann Microsoft-Anmeldung testen.
