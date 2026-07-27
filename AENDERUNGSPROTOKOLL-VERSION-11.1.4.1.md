# Version 11.1.4.1 – Microsoft Forms Diagnose

- Microsoft-Graph-Fehler werden mit Schritt, HTTP-Status, Graph-Code und Request-ID ausgegeben.
- Fehler erscheinen zusätzlich in den Cloudflare-Live-Logs.
- Die Forms-Antwortdatei wird zuerst direkt im bekannten Forms-Ordner gesucht.
- Erst danach wird als Rückfall die OneDrive-Suche verwendet.
- `keep_vars: true` bleibt unverändert aktiv.
- Keine IDs oder Secrets wurden in das Projekt aufgenommen.
