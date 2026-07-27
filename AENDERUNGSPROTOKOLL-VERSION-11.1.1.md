# Version 11.1.1 – Microsoft Forms Live-Connector

## Neu

- echte Microsoft-Graph-Anmeldung über Cloudflare Worker
- Einlesen der Forms-Antwortdatei `Fotos Brüsselreise 2026.xlsx` aus OneDrive
- serverseitiges Auslesen der XLSX-Datei ohne Excel-Graph-API
- Zuordnung von Reisetag, Ort/Programmpunkt, Beschreibung, Name und Uploadzeit
- geschütztes Laden der hochgeladenen Fotos über den Worker
- eigene Fotoeingang-PIN (`PHOTO_INBOX_PIN`)
- sichtbare Microsoft-Forms-Kachel im Admin-Dashboard
- vollständige Adminseite `/admin/microsoft.html`
- Verbindungstest für Microsoft Graph

## Cloudflare-Variablen und Secrets

Folgende Werte müssen unter **Workers & Pages → bs-rohrbach-erasmus-v2 → Settings → Variables and Secrets** eingetragen werden:

- `MS_TENANT_ID`
- `MS_CLIENT_ID`
- `MS_CLIENT_SECRET` (verschlüsselt)
- `PHOTO_INBOX_PIN` (verschlüsselt; frei wählbare PIN)

## Forms-Quelle

- Besitzer: `j.vierlinger@bs-rohrbach.ac.at`
- Antwortdatei: `Fotos Brüsselreise 2026.xlsx`
- Uploadordner: `Apps/Microsoft Forms/Fotos Brüsselreise 2026/Frage`

## Sicherheit

Zugangsdaten werden nicht im GitHub-Projekt gespeichert. Die Fotos werden nicht über öffentliche OneDrive-Links geladen, sondern nur nach Prüfung der Fotoeingang-PIN durch den Cloudflare Worker ausgeliefert.
