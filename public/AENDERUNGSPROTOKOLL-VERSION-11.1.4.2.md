# Version 11.1.4.2 – Graph-Token- und OneDrive-Prüfung

- Prüft die tatsächlichen Rollen im Microsoft-Graph-Access-Token.
- Meldet eindeutig, falls `Files.Read.All` im verwendeten Token fehlt.
- Zeigt die App-ID des tatsächlich verwendeten Tokens an.
- Prüft den persönlichen OneDrive-Drive vor der Forms-Dateisuche als eigenen Schritt.
- Zeigt Graph-URL, Graph-Meldung, HTTP-Status und Request-ID direkt im Adminbereich.
- `keep_vars: true` bleibt unverändert erhalten.
