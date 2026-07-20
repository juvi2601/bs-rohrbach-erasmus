# BS Rohrbach Erasmus+ – Cloudflare Workers Static Assets

Diese Version ist für die aktuelle Cloudflare-Oberfläche vorbereitet. Cloudflare empfiehlt für neue statische Websites inzwischen **Workers Static Assets**. Deshalb ist der im Dashboard angezeigte Befehl `npx wrangler deploy` hier korrekt.

## Einrichtung im Cloudflare-Dashboard

1. **Compute / Workers & Pages** öffnen.
2. **Create application** und anschließend **Import a repository** wählen.
3. GitHub-Repository `juvi2601/bs-rohrbach-erasmus` auswählen.
4. Projektname exakt: `bs-rohrbach-erasmus`
5. Production branch: `main`
6. Build command: **leer lassen**
7. Deploy command: `npx wrangler deploy`
8. Root directory: `/`
9. **Deploy** anklicken.

Die Datei `wrangler.jsonc` übernimmt alle technischen Einstellungen. Die statischen Dateien werden direkt aus dem Stammverzeichnis veröffentlicht.

## Nach dem ersten Deploy

Die Website ist voraussichtlich unter

`https://bs-rohrbach-erasmus.<dein-workers-subdomain>.workers.dev`

erreichbar. Cloudflare zeigt die genaue Adresse nach dem Deploy an.

## CMS

Die öffentliche Website funktioniert sofort. Der Redaktionsbereich unter `/admin/` braucht zusätzlich einen GitHub-OAuth-Dienst. In `admin/config.yml` ist bereits das richtige Repository eingetragen:

`juvi2601/bs-rohrbach-erasmus`

Vor dem CMS-Login muss nur noch die Zeile

`base_url: https://REPLACE-WITH-CMS-AUTH-WORKER.workers.dev`

mit der Adresse des OAuth-Workers ersetzt werden. Das wird in einem getrennten Schritt eingerichtet, damit keine GitHub-Geheimnisse in der öffentlichen ZIP-Datei landen.
