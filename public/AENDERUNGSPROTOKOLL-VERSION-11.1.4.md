# Änderungsprotokoll – Version 11.1.4

## Microsoft Forms – Quellenprüfung und Fotoimport

- Neuer geschützter API-Test `/api/microsoft/source-test`.
- Prüft die Forms-Antwortdatei `Fotos Brüsselreise 2026.xlsx` direkt über Microsoft Graph.
- Prüft den konfigurierten Microsoft-Forms-Uploadordner.
- Ermittelt die Zahl der Forms-Antworten und der gefundenen Dateiuploads.
- Die Microsoft-365-Seite zeigt nun echte Diagnosestatus für OneDrive, Excel und Uploadordner.
- Der Fotoeingang zeigt nach der Synchronisierung, wie viele Antworten, Fotos und übersprungene Dateien verarbeitet wurden.
- Die vorhandene PIN-Sicherung schützt weiterhin Quelle, Synchronisierung und Bildabruf.
- Cloudflare-Schutz bleibt erhalten: `keep_vars: true` wurde unverändert beibehalten.

## Technische Hinweise

- Keine IDs oder Secrets wurden in GitHub gespeichert.
- Die Laufzeitwerte bleiben ausschließlich in Cloudflare unter „Variables and Secrets“.
- Root- und `public`-Dateien wurden synchronisiert.
