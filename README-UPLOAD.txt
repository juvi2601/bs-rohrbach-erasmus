KORREKTUR VERSION 4.1.1

1. Den gesamten Inhalt dieses Ordners in das GitHub-Repository hochladen.
2. Vorhandene Dateien package.json und wrangler.jsonc ersetzen.
3. Der neue Ordner public muss direkt in der Hauptansicht des Repositories liegen.
4. Danach in Cloudflare den fehlgeschlagenen Deploy erneut starten.

Die Website-Dateien werden nun ausschließlich aus ./public veröffentlicht.
Dadurch werden alte oder zu große Dateien außerhalb von public beim Deploy ignoriert.
