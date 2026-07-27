# Änderungsprotokoll – Version 11.1.2

**Datum:** 27.07.2026  
**Bezeichnung:** Microsoft Graph Verbindungstest und Dashboard-Feinschliff

## Neu

- Eigener API-Endpunkt `/api/microsoft/test` für einen gezielten Microsoft-Graph-Verbindungstest.
- Anzeige von Testzeitpunkt und Antwortdauer auf der Microsoft-365-Seite.
- Systemdiagnose für Microsoft Graph und die vorbereiteten nächsten Integrationsschritte.
- Verständliche Fehlermeldungen bei fehlenden oder ungültigen Cloudflare-Zugangsdaten.

## Korrigiert

- Der Pre-Flight-Check vergleicht die Website-Version nicht mehr irrtümlich mit Version 10.8.2.
- Der Versionsstand wird nun korrekt als erfolgreich erkannt, sobald `version.json` erreichbar ist.
- Die doppelte Überschrift „Website auf einen Blick“ wurde beseitigt.
- Der zweite Dashboard-Bereich heißt nun „Live-Reiseübersicht“.
- Veraltete Modulversionshinweise wie „Live-Reisezentrale 10.7“ wurden entfernt.
- Smart-Journey-Versionsnummern wurden aus den Bereichsüberschriften entfernt.

## Version

- Website-Version auf **11.1.2** aktualisiert.
- Root- und `public`-Dateien synchronisiert.
