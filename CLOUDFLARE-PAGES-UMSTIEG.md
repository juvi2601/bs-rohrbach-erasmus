# BS Rohrbach Erasmus+ – Version 4.0

## Ziel dieser Version

Die Website bleibt optisch und inhaltlich die Brüssel-Seite aus Version 3.0. Geändert wurden nur Branding und die Grundlage für Cloudflare Pages.

## In Cloudflare Pages verbinden

1. Bei Cloudflare anmelden und **Workers & Pages** öffnen.
2. **Create application** → **Pages** → **Connect to Git** wählen.
3. GitHub verbinden und das Repository `juvi2601/bruesselreise-2026` auswählen.
4. Projektname beispielsweise `bruesselreise-2026`.
5. Framework preset: **None**.
6. Build command: leer lassen.
7. Build output directory: `/` bzw. leer lassen, wenn Cloudflare das Stammverzeichnis akzeptiert.
8. Deploy starten.

Die öffentliche Website funktioniert danach als statische Cloudflare-Pages-Seite.

## Wichtiger Hinweis zum CMS

Netlify Identity/Git Gateway funktioniert auf Cloudflare Pages nicht. Die Datei `admin/config.yml` ist bereits auf den GitHub-Backend-Modus vorbereitet. Vor dem produktiven CMS-Login muss noch ein kleiner OAuth-Worker eingerichtet und dessen Adresse bei `base_url` eingesetzt werden. Bis das erledigt ist, funktioniert die Website selbst vollständig, der Redaktionslogin aber noch nicht.

Suche in `admin/config.yml` nach:

`https://REPLACE-WITH-CMS-AUTH-WORKER.workers.dev`

und ersetze die Adresse nach Einrichtung des Workers.

## Bereits enthalten

- Branding **BS Rohrbach Erasmus+**
- weiterhin ausschließlich **Brüssel 2026** im Vordergrund
- bestehendes Design, Fotos und Inhalte aus Version 3.0
- Microsoft-Forms-Link
- SharePoint-Link
- Cloudflare-Headers und Weiterleitung für `/admin`
- vollständige Inhaltsdateien für das CMS
