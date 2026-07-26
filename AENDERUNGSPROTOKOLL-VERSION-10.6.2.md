# Version 10.6.2 – Cloudflare-Veröffentlichung korrigiert

## Ursache des Fehlers

Cloudflare veröffentlicht in diesem Projekt ausschließlich den Ordner `public`. Die Änderungen der Version 10.6.1 waren zwar im Projektstamm vorhanden, aber nicht vollständig in `public/admin` übernommen worden. Deshalb wurde online weiterhin der alte Admin-Code aus Version 10.6 geladen.

## Korrekturen

- Das vollständige System-Dashboard wird nun auch aus `public/admin` ausgeliefert.
- Der Pre-Flight-Check verwendet online tatsächlich die neue Prüflogik.
- Impressum und Datenschutz werden sowohl über die direkten Bereiche in `legal.json` als auch über die Footer-Verknüpfungen erkannt.
- Die Versionsanzeige wurde auf 10.6.2 vereinheitlicht.
- Admin-CSS und Admin-JavaScript erhalten eine Versionskennung in der URL, damit Browser keine ältere Datei aus dem Cache verwenden.
- Der Service-Worker-Cache wurde auf einen neuen Stand angehoben.

## Erwartetes Ergebnis

Nach dem Deployment zeigt das Admin-Dashboard:

- den Bereich „Website auf einen Blick“,
- einen grünen Check für Impressum und Datenschutz,
- Version 10.6.2,
- höchstens einen gelben Hinweis bei den Downloads, solange kein Dokument veröffentlicht ist.
